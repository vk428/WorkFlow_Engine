"""
Execution Service Layer
"""
import logging
from django.utils import timezone
from django.db import transaction
from apps.core.audit import AuditLog
from apps.core.exceptions import WorkflowExecutionError
from apps.workflows.models import WorkflowVersion
from .models import WorkflowExecution

logger = logging.getLogger('apps.executions')


class ExecutionService:

    @staticmethod
    @transaction.atomic
    def start(workflow_version: WorkflowVersion, triggered_by, context: dict) -> WorkflowExecution:
        """
        Create an execution record and dispatch the Celery task.
        Returns immediately — execution happens asynchronously.
        """
        execution = WorkflowExecution.objects.create(
            workflow_version=workflow_version,
            triggered_by=triggered_by,
            status=WorkflowExecution.Status.PENDING,
            context=context,
        )

        AuditLog.log(
            action=AuditLog.ActionType.EXECUTE,
            actor=triggered_by,
            instance=execution,
            description=f"Workflow execution started: {workflow_version}",
            metadata={'context_keys': list(context.keys())},
        )

        # Dispatch to Celery
        from .tasks import run_workflow_execution
        run_workflow_execution.delay(str(execution.id))

        logger.info(f"Execution {execution.id} queued for {workflow_version}")
        return execution

    @staticmethod
    def cancel(execution_id: str, user) -> WorkflowExecution:
        """Cancel a running or pending execution."""
        try:
            execution = WorkflowExecution.objects.get(id=execution_id)
        except WorkflowExecution.DoesNotExist:
            raise WorkflowExecutionError(f"Execution {execution_id} not found.")

        if execution.status in (WorkflowExecution.Status.COMPLETED, WorkflowExecution.Status.FAILED):
            raise WorkflowExecutionError("Cannot cancel a completed or failed execution.")

        execution.status = WorkflowExecution.Status.CANCELLED
        execution.completed_at = timezone.now()
        execution.save(update_fields=['status', 'completed_at'])

        AuditLog.log(
            action=AuditLog.ActionType.UPDATE,
            actor=user,
            instance=execution,
            description=f"Execution cancelled: {execution_id}",
        )
        return execution
