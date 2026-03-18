"""
Approval Serializers
"""
from rest_framework import serializers
from .models import Approval
from apps.authentication.serializers import UserSerializer


class ApprovalSerializer(serializers.ModelSerializer):
    assigned_to_detail = UserSerializer(source='assigned_to', read_only=True)
    resolved_by_detail = UserSerializer(source='resolved_by', read_only=True)

    class Meta:
        model = Approval
        fields = [
            'id', 'step_execution', 'workflow_execution',
            'step_name', 'workflow_name',
            'assigned_to', 'assigned_to_detail', 'assigned_role',
            'approval_mode', 'status',
            'resolved_by', 'resolved_by_detail', 'resolved_at',
            'comments', 'rejection_reason',
            'due_at', 'context_snapshot',
            'created_at',
        ]
        read_only_fields = [
            'id', 'step_name', 'workflow_name', 'status',
            'resolved_by', 'resolved_at', 'created_at',
        ]


class ApproveSerializer(serializers.Serializer):
    comments = serializers.CharField(required=False, allow_blank=True, default='')


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, min_length=1)
