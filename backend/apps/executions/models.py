"""
Execution Domain Models
========================
WorkflowExecution — one run of a workflow version
StepExecution    — one run of a single step within that execution
"""
from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedModel


class WorkflowExecution(TimeStampedModel):
    """
    Represents a single live run of a workflow version.
    Contains the dynamic context (data bag) that flows through all steps.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        WAITING = 'waiting', 'Waiting for Approval'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'
        SIMULATING = 'simulating', 'Simulating'

    workflow_version = models.ForeignKey(
        'workflows.WorkflowVersion',
        on_delete=models.PROTECT,
        related_name='executions',
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='triggered_executions',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    # The dynamic key-value data bag — grows as steps add their outputs
    context = models.JSONField(
        default=dict,
        blank=True,
        help_text='Dynamic execution context. Populated from input + step outputs.',
    )

    # Execution metadata
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    is_simulation = models.BooleanField(default=False)

    # Current step pointer
    current_step = models.ForeignKey(
        'workflows.WorkflowStep',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='current_executions',
    )

    class Meta:
        db_table = 'workflow_executions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['workflow_version', 'status']),
            models.Index(fields=['triggered_by', 'created_at']),
        ]

    def __str__(self):
        return f"Execution[{self.status}] for {self.workflow_version}"

    @property
    def duration_seconds(self):
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None


class StepExecution(TimeStampedModel):
    """
    Represents a single step being executed within a WorkflowExecution.
    Tracks status, input/output, retries, and timing.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        SKIPPED = 'skipped', 'Skipped'
        WAITING = 'waiting', 'Waiting for Approval'
        RETRYING = 'retrying', 'Retrying'
        TIMED_OUT = 'timed_out', 'Timed Out'

    workflow_execution = models.ForeignKey(
        WorkflowExecution,
        on_delete=models.CASCADE,
        related_name='step_executions',
    )
    step = models.ForeignKey(
        'workflows.WorkflowStep',
        on_delete=models.PROTECT,
        related_name='executions',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    # Snapshot of context at time of step execution
    input_context = models.JSONField(default=dict, blank=True)
    output_data = models.JSONField(default=dict, blank=True)

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    retry_count = models.PositiveSmallIntegerField(default=0)
    error_message = models.TextField(blank=True)

    # Which rule routed execution to the next step?
    applied_rule = models.ForeignKey(
        'workflows.WorkflowRule',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='applied_executions',
    )

    class Meta:
        db_table = 'step_executions'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['workflow_execution', 'status']),
            models.Index(fields=['step', 'status']),
        ]

    def __str__(self):
        return f"StepExec[{self.status}] {self.step.name}"

    @property
    def duration_seconds(self):
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
