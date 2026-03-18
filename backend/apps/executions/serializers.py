"""
Execution Serializers
"""
from rest_framework import serializers
from .models import WorkflowExecution, StepExecution
from apps.authentication.serializers import UserSerializer
from apps.workflows.serializers import WorkflowStepSerializer


class StepExecutionSerializer(serializers.ModelSerializer):
    step_detail = WorkflowStepSerializer(source='step', read_only=True)
    duration_seconds = serializers.ReadOnlyField()

    class Meta:
        model = StepExecution
        fields = [
            'id', 'step', 'step_detail', 'status',
            'input_context', 'output_data',
            'started_at', 'completed_at', 'duration_seconds',
            'retry_count', 'error_message', 'applied_rule',
            'created_at',
        ]


class WorkflowExecutionSerializer(serializers.ModelSerializer):
    step_executions = StepExecutionSerializer(many=True, read_only=True)
    triggered_by_detail = UserSerializer(source='triggered_by', read_only=True)
    workflow_name = serializers.SerializerMethodField()
    duration_seconds = serializers.ReadOnlyField()
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowExecution
        fields = [
            'id', 'workflow_version', 'workflow_name',
            'triggered_by', 'triggered_by_detail',
            'status', 'context',
            'started_at', 'completed_at', 'duration_seconds',
            'error_message', 'is_simulation',
            'current_step',
            'step_executions', 'progress_percent',
            'created_at',
        ]
        read_only_fields = [
            'id', 'status', 'started_at', 'completed_at',
            'error_message', 'created_at',
        ]

    def get_workflow_name(self, obj):
        return obj.workflow_version.workflow.name if obj.workflow_version else None

    def get_progress_percent(self, obj):
        total = obj.workflow_version.steps.count()
        if total == 0:
            return 0
        done = obj.step_executions.filter(
            status__in=[StepExecution.Status.COMPLETED, StepExecution.Status.SKIPPED]
        ).count()
        return round((done / total) * 100)
