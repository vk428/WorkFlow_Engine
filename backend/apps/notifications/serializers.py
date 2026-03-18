"""
Notification Serializer
"""
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'channel', 'title', 'message',
            'is_read', 'read_at', 'metadata',
            'workflow_execution', 'approval',
            'created_at',
        ]
        read_only_fields = fields
