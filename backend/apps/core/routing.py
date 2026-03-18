"""
WebSocket URL routing for the platform.
Consumers are registered here and mounted in config/asgi.py.
"""
from django.urls import re_path
from apps.executions import consumers as execution_consumers
from apps.notifications import consumers as notification_consumers

websocket_urlpatterns = [
    # Real-time execution updates per execution ID
    re_path(
        r'ws/executions/(?P<execution_id>[0-9a-f-]+)/$',
        execution_consumers.ExecutionConsumer.as_asgi(),
    ),
    # User notification stream
    re_path(
        r'ws/notifications/$',
        notification_consumers.NotificationConsumer.as_asgi(),
    ),
]
