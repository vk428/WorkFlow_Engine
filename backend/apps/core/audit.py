"""
Audit Log Model — tracks every significant event in the platform
"""
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from .models import TimeStampedModel


class AuditLog(TimeStampedModel):
    """
    Polymorphic audit trail for all domain events.
    Uses Django's GenericForeignKey to link to any model instance.
    """

    class ActionType(models.TextChoices):
        CREATE = 'CREATE', 'Created'
        UPDATE = 'UPDATE', 'Updated'
        DELETE = 'DELETE', 'Deleted'
        EXECUTE = 'EXECUTE', 'Executed'
        APPROVE = 'APPROVE', 'Approved'
        REJECT = 'REJECT', 'Rejected'
        SKIP = 'SKIP', 'Skipped'
        RETRY = 'RETRY', 'Retried'
        FAIL = 'FAIL', 'Failed'
        COMPLETE = 'COMPLETE', 'Completed'
        LOGIN = 'LOGIN', 'Login'
        LOGOUT = 'LOGOUT', 'Logout'
        SIMULATE = 'SIMULATE', 'Simulated'
        PUBLISH = 'PUBLISH', 'Published'

    action = models.CharField(
        max_length=20,
        choices=ActionType.choices,
        db_index=True,
    )

    # Polymorphic FK — links to ANY model
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    object_id = models.UUIDField(null=True, blank=True, db_index=True)
    content_object = GenericForeignKey('content_type', 'object_id')

    actor = models.ForeignKey(
        'authentication.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs',
    )

    # Snapshot of important metadata at time of event
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['action', 'created_at']),
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['actor', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.action}] {self.description or self.object_id} at {self.created_at}"

    @classmethod
    def log(cls, action, actor=None, instance=None, metadata=None, description='',
            ip_address=None, user_agent=''):
        """
        Convenience factory method for logging audit events.
        Usage:
            AuditLog.log(
                action=AuditLog.ActionType.EXECUTE,
                actor=request.user,
                instance=workflow_execution,
                metadata={'step': 'manager_approval'},
                description='Workflow execution started',
            )
        """
        ct = None
        obj_id = None
        if instance:
            ct = ContentType.objects.get_for_model(instance)
            obj_id = instance.pk

        return cls.objects.create(
            action=action,
            actor=actor,
            content_type=ct,
            object_id=obj_id,
            metadata=metadata or {},
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
        )
