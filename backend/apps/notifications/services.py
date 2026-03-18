"""
Notification Service
"""
import logging
from apps.core.audit import AuditLog
from .models import Notification

logger = logging.getLogger('apps.notifications')

TEMPLATES = {
    'approval_request': {
        'title': '⏳ Action Required: Approval Needed',
        'message': 'You have a pending approval request for step "{step_name}" in workflow "{workflow_name}".',
        'type': Notification.Type.APPROVAL_REQUEST,
    },
    'approval_approved': {
        'title': '✅ Approval Granted',
        'message': 'Your approval request for "{step_name}" was approved.',
        'type': Notification.Type.APPROVAL_RESOLVED,
    },
    'approval_rejected': {
        'title': '❌ Approval Rejected',
        'message': 'Your approval request for "{step_name}" was rejected.',
        'type': Notification.Type.APPROVAL_RESOLVED,
    },
    'workflow_completed': {
        'title': '🎉 Workflow Completed',
        'message': 'Workflow "{workflow_name}" has completed successfully.',
        'type': Notification.Type.WORKFLOW_COMPLETED,
    },
    'workflow_failed': {
        'title': '🚨 Workflow Failed',
        'message': 'Workflow "{workflow_name}" failed. Please check the execution log.',
        'type': Notification.Type.WORKFLOW_FAILED,
    },
    'generic': {
        'title': '📢 Notification',
        'message': '{message}',
        'type': Notification.Type.GENERIC,
    },
}


class NotificationService:

    @classmethod
    def dispatch(cls, template: str, recipients, context: dict, step_exec=None):
        """
        Create in-app notification records for all recipients.
        Also pushes via WebSocket if channel layer is available.
        """
        tmpl = TEMPLATES.get(template, TEMPLATES['generic'])
        title = tmpl['title'].format_map(cls._safe_format(context))
        message = tmpl['message'].format_map(cls._safe_format(context))
        notif_type = tmpl['type']

        notifications = []
        for recipient in recipients:
            if not recipient:
                continue
            notif = Notification.objects.create(
                recipient=recipient,
                notification_type=notif_type,
                channel=Notification.Channel.IN_APP,
                title=title,
                message=message,
                metadata=context,
                workflow_execution=getattr(step_exec, 'workflow_execution', None) if step_exec else None,
                is_sent=True,
            )
            notifications.append(notif)
            cls._push_ws(recipient, notif)
            logger.info(f"Notification sent to {recipient}: {title}")

        return notifications

    @classmethod
    def _push_ws(cls, recipient, notif: Notification):
        """Push notification to user's personal WS channel."""
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"notifications_{recipient.id}",
                    {
                        'type': 'new_notification',
                        'notification_id': str(notif.id),
                        'title': notif.title,
                        'message': notif.message,
                        'notification_type': notif.notification_type,
                    }
                )
        except Exception as e:
            logger.warning(f"WS notification push failed: {e}")

    @staticmethod
    def _safe_format(context: dict):
        """Return a defaultdict-like object so missing keys don't crash format_map."""
        class SafeDict(dict):
            def __missing__(self, key):
                return f'{{{key}}}'
        return SafeDict(context)
