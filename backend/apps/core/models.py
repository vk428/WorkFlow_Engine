"""
Base models providing common fields for all domain models.
Every entity gets:
  - UUID primary key
  - created_at / updated_at timestamps
  - created_by / updated_by user references
  - soft-delete support
  - is_active flag
"""
import uuid
import logging
from django.db import models
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('apps.core')


class UUIDModel(models.Model):
    """Abstract model that uses UUID as primary key."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(UUIDModel):
    """Abstract model with auto-managed timestamps."""
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']


class AuditedModel(TimeStampedModel):
    """Abstract model that tracks who created and last modified a record."""
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='%(app_label)s_%(class)s_created',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='%(app_label)s_%(class)s_updated',
    )

    class Meta:
        abstract = True


class SoftDeleteManager(models.Manager):
    """Default manager that excludes soft-deleted records."""
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class AllObjectsManager(models.Manager):
    """Manager that includes soft-deleted records."""
    pass


class SoftDeleteModel(AuditedModel):
    """
    Adds soft-delete capability.
    Records are never permanently removed by default — they are 'archived'.
    """
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='%(app_label)s_%(class)s_deleted',
    )

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True

    def soft_delete(self, user=None):
        """Mark the record as deleted."""
        self.deleted_at = timezone.now()
        if user:
            self.deleted_by = user
        self.save(update_fields=['deleted_at', 'deleted_by'])
        logger.info(f"{self.__class__.__name__} {self.pk} soft-deleted by {user}")

    def restore(self):
        """Restore a soft-deleted record."""
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=['deleted_at', 'deleted_by'])

    @property
    def is_deleted(self):
        return self.deleted_at is not None


class StatusModel(models.Model):
    """Provides a standardized is_active flag."""
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        abstract = True


class SystemSetting(models.Model):
    """
    Key-value store for system-wide settings.
    Used for configurable platform parameters.
    """
    key = models.CharField(max_length=100, unique=True, db_index=True)
    value = models.JSONField(default=dict)
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'system_settings'
        verbose_name = 'System Setting'
        verbose_name_plural = 'System Settings'

    def __str__(self):
        return self.key
