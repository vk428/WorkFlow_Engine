"""
Approval Service
"""
import logging
from django.utils import timezone
from django.db import transaction
from apps.core.audit import AuditLog
from apps.core.exceptions import ApprovalError
from .models import Approval

logger = logging.getLogger('apps.approvals')


class ApprovalService:

    @staticmethod
    @transaction.atomic
    def create_approval(step, step_exec, context: dict) -> Approval:
        """
        Create an approval record for an approval-type step.
        The step config drives who needs to approve.
        """
        config = step.config or {}
        approval_mode = config.get('approval_mode', Approval.ApprovalMode.ANY_ONE)

        approval = Approval.objects.create(
            step_execution=step_exec,
            workflow_execution=step_exec.workflow_execution,
            assigned_to=step.assigned_user,
            assigned_role=step.assigned_role,
            approval_mode=approval_mode,
            step_name=step.name,
            workflow_name=step_exec.workflow_execution.workflow_version.workflow.name,
            context_snapshot=context,
            due_at=config.get('due_in_hours') and (
                timezone.now() + timezone.timedelta(hours=config['due_in_hours'])
            ),
        )

        # Send notification to approver
        from apps.notifications.services import NotificationService
        NotificationService.dispatch(
            template='approval_request',
            recipients=[step.assigned_user] if step.assigned_user else [],
            context={
                'approval_id': str(approval.id),
                'step_name': step.name,
                'workflow_name': approval.workflow_name,
                **context,
            },
            step_exec=step_exec,
        )

        logger.info(f"Approval {approval.id} created for {step.name}")
        return approval

    @staticmethod
    @transaction.atomic
    def approve(approval_id: str, user, comments: str = '') -> Approval:
        """Approve an approval request and resume the workflow."""
        try:
            approval = Approval.objects.select_related('workflow_execution').get(id=approval_id)
        except Approval.DoesNotExist:
            raise ApprovalError(f"Approval {approval_id} not found.")

        if approval.status != Approval.Status.PENDING:
            raise ApprovalError(f"Approval is already {approval.status}.")

        approval.status = Approval.Status.APPROVED
        approval.resolved_by = user
        approval.resolved_at = timezone.now()
        approval.comments = comments
        approval.save(update_fields=['status', 'resolved_by', 'resolved_at', 'comments'])

        AuditLog.log(
            action=AuditLog.ActionType.APPROVE,
            actor=user,
            instance=approval,
            description=f"Approved: {approval.step_name}",
        )

        # Resume workflow execution
        from apps.executions.tasks import resume_workflow_execution
        resume_workflow_execution.delay(str(approval.workflow_execution_id))

        logger.info(f"Approval {approval_id} approved by {user.email}")
        return approval

    @staticmethod
    @transaction.atomic
    def reject(approval_id: str, user, reason: str = '') -> Approval:
        """Reject an approval and fail the workflow step."""
        try:
            approval = Approval.objects.select_related('workflow_execution').get(id=approval_id)
        except Approval.DoesNotExist:
            raise ApprovalError(f"Approval {approval_id} not found.")

        if approval.status != Approval.Status.PENDING:
            raise ApprovalError(f"Approval is already {approval.status}.")

        approval.status = Approval.Status.REJECTED
        approval.resolved_by = user
        approval.resolved_at = timezone.now()
        approval.rejection_reason = reason
        approval.save(update_fields=['status', 'resolved_by', 'resolved_at', 'rejection_reason'])

        # Fail the workflow execution
        from apps.executions.models import WorkflowExecution
        execution = approval.workflow_execution
        execution.status = WorkflowExecution.Status.FAILED
        execution.error_message = f"Rejected at step '{approval.step_name}': {reason}"
        execution.completed_at = timezone.now()
        execution.save(update_fields=['status', 'error_message', 'completed_at'])

        AuditLog.log(
            action=AuditLog.ActionType.REJECT,
            actor=user,
            instance=approval,
            description=f"Rejected: {approval.step_name}. Reason: {reason}",
        )

        logger.info(f"Approval {approval_id} rejected by {user.email}")
        return approval
