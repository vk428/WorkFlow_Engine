"""
Core Serializers
"""
from rest_framework import serializers
from .audit import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()
    entity_type = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'description', 'metadata',
            'actor', 'actor_email', 'entity_type', 'object_id',
            'ip_address', 'created_at',
        ]
        read_only_fields = fields

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor else None

    def get_entity_type(self, obj):
        return obj.content_type.model if obj.content_type else None
