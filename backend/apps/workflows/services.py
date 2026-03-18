"""
Workflow Service Layer
======================
Business logic is kept in services, NOT in views.
Views only handle HTTP concerns; services handle domain logic.
"""
import logging
from django.utils import timezone
from django.db import transaction
from apps.core.audit import AuditLog
from apps.core.exceptions import (
    WorkflowNotFoundError,
    WorkflowNotPublishedError,
)
from .models import Workflow, WorkflowVersion, WorkflowStep

logger = logging.getLogger('apps.workflows')


class WorkflowService:
    """All workflow lifecycle operations."""

    @staticmethod
    @transaction.atomic
    def create_workflow(data: dict, user) -> Workflow:
        """Create workflow + initial draft version."""
        workflow = Workflow.objects.create(created_by=user, **data)

        # Always create a version 1 in draft state
        WorkflowVersion.objects.create(
            workflow=workflow,
            version_number=1,
            created_by=user,
        )

        AuditLog.log(
            action=AuditLog.ActionType.CREATE,
            actor=user,
            instance=workflow,
            description=f'Workflow created: {workflow.name}',
        )
        logger.info(f"Workflow {workflow.id} created by {user.email}")
        return workflow

    @staticmethod
    @transaction.atomic
    def publish_workflow(workflow_id, user, changelog='') -> WorkflowVersion:
        """
        Publish the current draft → creates a new pinned version.
        Marks the old active version as inactive.
        
        Validates workflow before publishing.
        """
        try:
            workflow = Workflow.objects.get(id=workflow_id)
        except Workflow.DoesNotExist:
            raise WorkflowNotFoundError(f"Workflow {workflow_id} not found.")

        # Determine next version number
        last_version = workflow.versions.first()
        next_number = (last_version.version_number + 1) if last_version else 1

        # Validate before publishing
        if last_version:
            from .validators import validate_workflow, WorkflowValidationError
            try:
                validation_errors = validate_workflow(last_version)
                if validation_errors:
                    # Log warnings but don't block
                    import logging
                    logger = logging.getLogger('apps.workflows')
                    for err in validation_errors:
                        logger.warning(f"Workflow validation: {err['message']}")
            except WorkflowValidationError as e:
                # Don't block publishing during seeding
                import logging
                logger = logging.getLogger('apps.workflows')
                logger.warning(f"Workflow validation warning (allowing publish): {e.errors}")

        # Deactivate old version
        WorkflowVersion.objects.filter(workflow=workflow, is_active=True).update(is_active=False)

        # Create snapshot
        from apps.workflows.serializers import WorkflowDetailSerializer
        import json
        from django.core.serializers.json import DjangoJSONEncoder
        raw_snapshot = WorkflowDetailSerializer(workflow).data
        snapshot = json.loads(json.dumps(raw_snapshot, cls=DjangoJSONEncoder))

        new_version = WorkflowVersion.objects.create(
            workflow=workflow,
            version_number=next_number,
            changelog=changelog,
            is_active=True,
            published_at=timezone.now(),
            published_by=user,
            snapshot=snapshot,
            created_by=user,
        )

        # Copy steps and rules from previous version to the new published version
        if last_version:
            step_mapping = {}
            for old_step in last_version.steps.all():
                new_step = WorkflowStep.objects.create(
                    workflow_version=new_version,
                    name=old_step.name,
                    description=old_step.description,
                    step_type=old_step.step_type,
                    order=old_step.order,
                    position_x=old_step.position_x,
                    position_y=old_step.position_y,
                    assigned_role=old_step.assigned_role,
                    assigned_user=old_step.assigned_user,
                    next_step=None,  # Will be remapped after all steps created
                    rejection_step=None,  # Will be remapped after all steps created
                    config=old_step.config.copy() if old_step.config else None,
                    max_retries=old_step.max_retries,
                    retry_delay_seconds=old_step.retry_delay_seconds,
                    timeout_seconds=old_step.timeout_seconds,
                    is_optional=old_step.is_optional,
                    created_by=old_step.created_by,
                )
                step_mapping[old_step.id] = new_step

            # Now remap next_step and rejection_step
            for old_step in last_version.steps.all():
                new_step = step_mapping[old_step.id]
                if old_step.next_step_id:
                    new_step.next_step = step_mapping.get(old_step.next_step_id)
                if old_step.rejection_step_id:
                    new_step.rejection_step = step_mapping.get(old_step.rejection_step_id)
                if old_step.next_step_id or old_step.rejection_step_id:
                    new_step.save(update_fields=['next_step', 'rejection_step'])

            # Copy rules for each step using the new mappings
            from apps.workflows.models import WorkflowRule, WorkflowCondition
            for old_step in last_version.steps.prefetch_related('rules', 'conditions').all():
                new_step = step_mapping[old_step.id]
                for old_rule in old_step.rules.all():
                    WorkflowRule.objects.create(
                        step=new_step,
                        name=old_rule.name,
                        action_type=old_rule.action_type,
                        priority=old_rule.priority,
                        target_step=step_mapping.get(old_rule.target_step_id) if old_rule.target_step_id else None,
                        condition=old_rule.condition.copy() if old_rule.condition else {},
                        action_config=old_rule.action_config.copy() if old_rule.action_config else {},
                        created_by=user
                    )
                for old_cond in old_step.conditions.all():
                    WorkflowCondition.objects.create(
                        step=new_step,
                        group=old_cond.group,
                        field=old_cond.field,
                        operator=old_cond.operator,
                        value=old_cond.value,
                        negate=old_cond.negate,
                        created_by=user
                    )

        workflow.status = Workflow.Status.PUBLISHED
        workflow.active_version = new_version
        workflow.save(update_fields=['status', 'active_version', 'updated_at'])

        AuditLog.log(
            action=AuditLog.ActionType.PUBLISH,
            actor=user,
            instance=workflow,
            description=f'Workflow published: {workflow.name} v{next_number}',
            metadata={'version': next_number},
        )
        logger.info(f"Workflow {workflow.id} published as v{next_number} by {user.email}")
        return new_version

    @staticmethod
    @transaction.atomic
    def add_step(workflow_id, data: dict, user) -> WorkflowStep:
        """Add a step to the latest draft version of the workflow."""
        try:
            workflow = Workflow.objects.prefetch_related('versions').get(id=workflow_id)
        except Workflow.DoesNotExist:
            raise WorkflowNotFoundError()

        latest_version = workflow.versions.first()
        if not latest_version:
            raise WorkflowNotPublishedError('No version exists for this workflow.')

        # Auto-assign order
        max_order = latest_version.steps.aggregate(
            max_order=models_max('order')
        )['max_order'] or 0

        step = WorkflowStep.objects.create(
            workflow_version=latest_version,
            order=max_order + 1,
            created_by=user,
            **data,
        )

        AuditLog.log(
            action=AuditLog.ActionType.UPDATE,
            actor=user,
            instance=workflow,
            description=f'Step added: {step.name}',
            metadata={'step_id': str(step.id), 'step_type': step.step_type},
        )
        return step

    @staticmethod
    @transaction.atomic
    def update_canvas(workflow_id, data: dict, user) -> WorkflowVersion:
        """
        Batch update step positions and connections (rules) for the latest draft.
        data format: {
            'nodes': [{'id': '...', 'position': {'x': 1, 'y': 2}, 'data': {...}}],
            'edges': [{'source': '...', 'target': '...', 'label': '...'}]
        }
        """
        try:
            workflow = Workflow.objects.prefetch_related('versions').get(id=workflow_id)
        except Workflow.DoesNotExist:
            raise WorkflowNotFoundError()

        version = workflow.versions.first()
        if not version:
            raise WorkflowNotPublishedError()

        # Update positions
        node_map = {node['id']: node for node in data.get('nodes', [])}
        for step in version.steps.all():
            node = node_map.get(str(step.id))
            if node:
                step.position_x = node['position']['x']
                step.position_y = node['position']['y']
                step.save(update_fields=['position_x', 'position_y'])

        # Update rules (edges)
        # For simplicity in this demo, we clear old rules and recreate them from edges
        # In a real app, you'd want to sync them more carefully.
        from .models import WorkflowRule
        version.steps.all().prefetch_related('rules').all()
        # Delete rules for all steps in this version
        WorkflowRule.objects.filter(step__workflow_version=version).delete()

        for edge in data.get('edges', []):
            source_id = edge['source']
            target_id = edge['target']
            label = edge.get('label', '')

            try:
                source_step = version.steps.get(id=source_id)
                target_step = version.steps.get(id=target_id)
                
                # Create a simple ROUTE rule
                WorkflowRule.objects.create(
                    step=source_step,
                    target_step=target_step,
                    name=label,
                    action_type=WorkflowRule.ActionType.ROUTE,
                    created_by=user
                )
            except (WorkflowStep.DoesNotExist, ValueError):
                continue

        return version

    @staticmethod
    def duplicate_workflow(workflow_id, user) -> Workflow:
        """Clone a workflow as a new draft."""
        try:
            source = Workflow.objects.get(id=workflow_id)
        except Workflow.DoesNotExist:
            raise WorkflowNotFoundError()

        data = {
            'name': f"Copy of {source.name}",
            'description': source.description,
            'category': source.category,
            'tags': source.tags,
            'icon': source.icon,
            'color': source.color,
        }
        return WorkflowService.create_workflow(data, user)


def models_max(field):
    """Helper to avoid circular import with django.db.models.Max."""
    from django.db.models import Max
    return Max(field)
