"""
Celery Tasks for Execution Engine
"""
import logging
from celery import shared_task
from apps.core.audit import AuditLog

logger = logging.getLogger('apps.executions')


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def run_workflow_execution(self, execution_id: str):
    """
    Background task that runs a workflow execution.
    Retries up to 3 times on unexpected failure.
    """
    from .engine import WorkflowEngine
    try:
        logger.info(f"Celery task: starting execution {execution_id}")
        WorkflowEngine.run(execution_id)
    except Exception as exc:
        logger.exception(f"Execution {execution_id} failed in Celery task: {exc}")
        raise self.retry(exc=exc)


@shared_task
def resume_workflow_execution(execution_id: str):
    """
    Resume a paused execution after approval.
    Called by the ApprovalService when an approval is resolved.
    """
    from .engine import WorkflowEngine
    from .models import WorkflowExecution
    try:
        execution = WorkflowExecution.objects.get(id=execution_id)
        if execution.status == WorkflowExecution.Status.WAITING:
            logger.info(f"Celery: resuming execution {execution_id}")
            WorkflowEngine.run(execution_id)
    except WorkflowExecution.DoesNotExist:
        logger.error(f"Cannot resume: execution {execution_id} not found.")


@shared_task
def cleanup_stale_executions():
    """
    Periodic task — mark executions as FAILED if they've been running too long.
    Scheduled via Celery Beat.
    """
    from django.utils import timezone
    from datetime import timedelta
    from .models import WorkflowExecution
    from django.conf import settings

    timeout = getattr(settings, 'WORKFLOW_SETTINGS', {}).get('STEP_EXECUTION_TIMEOUT', 300)
    cutoff = timezone.now() - timedelta(seconds=timeout * 2)

    stale = WorkflowExecution.objects.filter(
        status=WorkflowExecution.Status.RUNNING,
        started_at__lt=cutoff,
    )
    count = stale.count()
    if count:
        stale.update(
            status=WorkflowExecution.Status.FAILED,
            error_message='Execution timed out — stale cleanup.',
        )
        logger.warning(f"Cleaned up {count} stale executions.")
    return count
