"""
Execution Views
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.core.pagination import StandardResultsPagination
from apps.core.permissions import IsAdmin
from .models import WorkflowExecution, StepExecution
from .serializers import WorkflowExecutionSerializer, StepExecutionSerializer
from .services import ExecutionService


class WorkflowExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for reading execution state.
    Executions are started via POST /workflows/{id}/execute/
    """
    serializer_class = WorkflowExecutionSerializer
    pagination_class = StandardResultsPagination
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            WorkflowExecution.objects
            .select_related('workflow_version__workflow', 'triggered_by', 'current_step')
            .prefetch_related('step_executions__step', 'step_executions__applied_rule')
            .filter(triggered_by=self.request.user)
            .order_by('-created_at')
        )

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """GET /executions/{id}/timeline/ — chronological step execution list."""
        execution = self.get_object()
        step_execs = execution.step_executions.select_related('step').order_by('created_at')
        return Response({
            'success': True,
            'execution_id': str(execution.id),
            'status': execution.status,
            'timeline': StepExecutionSerializer(step_execs, many=True).data,
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """POST /executions/{id}/cancel/"""
        execution = ExecutionService.cancel(pk, request.user)
        return Response({
            'success': True,
            'message': 'Execution cancelled.',
            'data': WorkflowExecutionSerializer(execution).data,
        })


class StepExecutionViewSet(viewsets.ViewSet):
    """
    ViewSet for task/step completion actions.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        POST /step_executions/{id}/complete/ — Complete a pending task.
        """
        try:
            step_exec = StepExecution.objects.select_related(
                'workflow_execution__workflow_version__workflow',
                'step'
            ).get(id=pk)
        except StepExecution.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Step execution not found.'
            }, status=status.HTTP_404_NOT_FOUND)

        if step_exec.status != StepExecution.Status.PENDING:
            return Response({
                'success': False,
                'message': f'Cannot complete step in {step_exec.status} status.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Mark as completed
        from django.utils import timezone
        step_exec.status = StepExecution.Status.COMPLETED
        step_exec.completed_at = timezone.now()
        step_exec.output_data = request.data.get('output_data', {})
        step_exec.save(update_fields=['status', 'completed_at', 'output_data'])

        # Trigger workflow to continue
        from .tasks import resume_workflow_execution
        resume_workflow_execution.delay(str(step_exec.workflow_execution_id))

        return Response({
            'success': True,
            'message': 'Task completed. Workflow is continuing.',
            'data': StepExecutionSerializer(step_exec).data,
        })


class AllExecutionsViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin view of ALL executions."""
    serializer_class = WorkflowExecutionSerializer
    pagination_class = StandardResultsPagination
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        return (
            WorkflowExecution.objects
            .select_related('workflow_version__workflow', 'triggered_by')
            .prefetch_related('step_executions')
            .all()
            .order_by('-created_at')
        )
