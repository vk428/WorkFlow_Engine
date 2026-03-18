"""
Approval Views
"""
from django.db import models
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.core.pagination import StandardResultsPagination
from .models import Approval
from .serializers import ApprovalSerializer, ApproveSerializer, RejectSerializer
from .services import ApprovalService


class ApprovalViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Approval management.
    Users see approvals assigned to them.
    """
    serializer_class = ApprovalSerializer
    pagination_class = StandardResultsPagination
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # Admins see all approvals
        if user.role == 'admin':
            return (
                Approval.objects
                .select_related('assigned_to', 'resolved_by', 'step_execution', 'workflow_execution')
                .order_by('-created_at')
            )
        
        # Regular users see only their assigned approvals
        return (
            Approval.objects
            .select_related('assigned_to', 'resolved_by', 'step_execution', 'workflow_execution')
            .filter(assigned_to=user)
            .order_by('-created_at')
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """POST /approvals/{id}/approve/"""
        serializer = ApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        approval = ApprovalService.approve(
            pk, request.user,
            comments=serializer.validated_data.get('comments', ''),
        )
        return Response({
            'success': True,
            'message': 'Approval granted. Workflow will resume.',
            'data': ApprovalSerializer(approval).data,
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """POST /approvals/{id}/reject/"""
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        approval = ApprovalService.reject(
            pk, request.user,
            reason=serializer.validated_data['reason'],
        )
        return Response({
            'success': True,
            'message': 'Approval rejected. Workflow has been stopped.',
            'data': ApprovalSerializer(approval).data,
        })

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """GET /approvals/pending/ — quick access to pending approvals."""
        qs = self.get_queryset().filter(status=Approval.Status.PENDING)
        serializer = self.get_serializer(qs, many=True)
        return Response({'success': True, 'count': qs.count(), 'data': serializer.data})

    @action(detail=False, methods=['get'])
    def my_tasks(self, request):
        """
        GET /approvals/my_tasks/ — Get all tasks for current user.
        Combines pending approvals and pending task executions.
        """
        user = request.user
        user_role = user.role if hasattr(user, 'role') else 'user'
        
        # Get pending approvals assigned to user or user's role
        approvals = Approval.objects.filter(
            status=Approval.Status.PENDING
        ).filter(
            models.Q(assigned_to=user) | models.Q(assigned_role=user_role) | models.Q(assigned_role='')
        ).select_related(
            'workflow_execution__workflow_version__workflow',
            'step_execution__step'
        ).order_by('-created_at')
        
        # Get pending task executions assigned to user or user's role
        from apps.executions.models import StepExecution
        task_executions = StepExecution.objects.filter(
            status=StepExecution.Status.PENDING
        ).filter(
            models.Q(step__assigned_to=user) | models.Q(step__assigned_role=user_role) | models.Q(step__assigned_role='')
        ).select_related(
            'workflow_execution__workflow_version__workflow',
            'step'
        ).order_by('-created_at')
        
        # Combine into unified task list
        tasks = []
        
        # Add approvals as tasks
        for approval in approvals:
            tasks.append({
                'id': str(approval.id),
                'type': 'approval',
                'title': f'Approval Required: {approval.step_name}',
                'description': f'Workflow: {approval.workflow_name}',
                'status': approval.status,
                'step_name': approval.step_name,
                'workflow_name': approval.workflow_name,
                'workflow_id': str(approval.workflow_execution.workflow_version.workflow.id),
                'execution_id': str(approval.workflow_execution.id),
                'context': approval.context_snapshot,
                'created_at': approval.created_at.isoformat(),
                'due_at': approval.due_at.isoformat() if approval.due_at else None,
            })
        
        # Add task executions as tasks
        for task_exec in task_executions:
            tasks.append({
                'id': str(task_exec.id),
                'type': 'task',
                'title': f'Task: {task_exec.step.name}',
                'description': task_exec.step.description or f'Workflow: {task_exec.workflow_execution.workflow_version.workflow.name}',
                'status': task_exec.status,
                'step_name': task_exec.step.name,
                'workflow_name': task_exec.workflow_execution.workflow_version.workflow.name,
                'workflow_id': str(task_exec.workflow_execution.workflow_version.workflow.id),
                'execution_id': str(task_exec.workflow_execution.id),
                'context': task_exec.input_context,
                'created_at': task_exec.created_at.isoformat(),
                'due_at': None,
            })
        
        # Sort by creation date
        tasks.sort(key=lambda x: x['created_at'], reverse=True)
        
        return Response({
            'success': True,
            'count': len(tasks),
            'data': tasks
        })
