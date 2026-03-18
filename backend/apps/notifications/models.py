"""
Notification Model
"""
from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedModel


class Notification(TimeStampedModel):
    """
    In-app notification for a user.
    Also serves as a log for email/webhook notifications.
    """

    class Type(models.TextChoices):
        APPROVAL_REQUEST = 'approval_request', 'Approval Request'
        APPROVAL_RESOLVED = 'approval_resolved', 'Approval Resolved'
        WORKFLOW_COMPLETED = 'workflow_completed', 'Workflow Completed'
        WORKFLOW_FAILED = 'workflow_failed', 'Workflow Failed'
        STEP_ASSIGNED = 'step_assigned', 'Step Assigned'
        GENERIC = 'generic', 'Generic'

    class Channel(models.TextChoices):
        IN_APP = 'in_app', 'In-App'
        EMAIL = 'email', 'Email'
        WEBHOOK = 'webhook', 'Webhook'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    notification_type = models.CharField(
        max_length=30,
        choices=Type.choices,
        default=Type.GENERIC,
        db_index=True,
    )
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        default=Channel.IN_APP,
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)

    # Link to source execution / approval
    workflow_execution = models.ForeignKey(
        'executions.WorkflowExecution',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='notifications',
    )
    approval = models.ForeignKey(
        'approvals.Approval',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='notifications',
    )

    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    is_sent = models.BooleanField(default=False)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'created_at']),
        ]

    def __str__(self):
        return f"Notif[{self.notification_type}] → {self.recipient}"
