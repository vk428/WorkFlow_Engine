"""
Analytics API Views
"""
from datetime import timedelta
from django.db import models
from django.db.models import Count, Avg, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import IsAdmin
from apps.workflows.models import Workflow
from apps.executions.models import WorkflowExecution
from apps.approvals.models import Approval
from apps.authentication.models import User


class AnalyticsOverviewView(APIView):
    """
    GET /analytics/overview
    
    Returns overall analytics metrics from PostgreSQL.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # Get date range from query params (default: last 30 days)
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        # Workflow metrics
        total_workflows = Workflow.objects.count()
        active_workflows = Workflow.objects.filter(status='published').count()

        # Execution metrics
        executions_qs = WorkflowExecution.objects.filter(created_at__gte=start_date)
        total_executions = executions_qs.count()
        completed_executions = executions_qs.filter(status='completed').count()
        failed_executions = executions_qs.filter(status='failed').count()
        active_executions = executions_qs.filter(status__in=['running', 'waiting', 'pending']).count()

        # Approval metrics
        approvals_qs = Approval.objects.filter(created_at__gte=start_date)
        pending_approvals = approvals_qs.filter(status='pending').count()
        total_approvals = approvals_qs.count()
        
        # User metrics
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()

        # Calculate success rate
        success_rate = 0.0
        if total_executions > 0:
            success_rate = round((completed_executions / total_executions) * 100, 2)

        # Calculate average execution time (completed executions only)
        avg_duration = WorkflowExecution.objects.filter(
            status='completed',
            started_at__isnull=False,
            completed_at__isnull=False
        ).annotate(
            duration=models.F('completed_at') - models.F('started_at')
        ).aggregate(avg_duration=Avg('duration'))

        avg_execution_time = 0.0
        if avg_duration['avg_duration']:
            avg_execution_time = round(avg_duration['avg_duration'].total_seconds(), 2)

        return Response({
            'workflows': {
                'total': total_workflows,
                'active': active_workflows
            },
            'executions': {
                'total': total_executions,
                'completed': completed_executions,
                'failed': failed_executions,
                'active': active_executions
            },
            'approvals': {
                'total': total_approvals,
                'pending': pending_approvals
            },
            'users': {
                'total': total_users,
                'active': active_users
            },
            'metrics': {
                'success_rate': success_rate,
                'average_execution_time': avg_execution_time
            }
        })


class AnalyticsExecutionsView(APIView):
    """
    GET /analytics/executions
    
    Returns execution trends over time.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        # Get execution counts grouped by date
        executions_by_date = WorkflowExecution.objects.filter(
            created_at__gte=start_date
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            total=Count('id'),
            completed=Count('id', filter=Q(status='completed')),
            failed=Count('id', filter=Q(status='failed')),
            running=Count('id', filter=Q(status='running'))
        ).order_by('date')

        # Format for chart
        chart_data = []
        current_date = start_date.date()
        end_date = timezone.now().date()
        
        # Create a map of date -> data
        data_map = {e['date']: e for e in executions_by_date}
        
        while current_date <= end_date:
            data = data_map.get(current_date, {
                'date': current_date,
                'total': 0,
                'completed': 0,
                'failed': 0,
                'running': 0
            })
            chart_data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'total': data['total'],
                'completed': data['completed'],
                'failed': data['failed'],
                'running': data['running']
            })
            current_date += timedelta(days=1)

        return Response({
            'chart_data': chart_data,
            'summary': {
                'total': sum(d['total'] for d in chart_data),
                'completed': sum(d['completed'] for d in chart_data),
                'failed': sum(d['failed'] for d in chart_data)
            }
        })


class AnalyticsApprovalsView(APIView):
    """
    GET /analytics/approvals
    
    Returns approval rate metrics over time.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        # Get approval counts grouped by date
        approvals_by_date = Approval.objects.filter(
            created_at__gte=start_date
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            total=Count('id'),
            pending=Count('id', filter=Q(status='pending')),
            approved=Count('id', filter=Q(status='approved')),
            rejected=Count('id', filter=Q(status='rejected'))
        ).order_by('date')

        # Format for chart
        chart_data = []
        data_map = {a['date']: a for a in approvals_by_date}
        
        current_date = start_date.date()
        end_date = timezone.now().date()
        
        while current_date <= end_date:
            data = data_map.get(current_date, {
                'date': current_date,
                'total': 0,
                'pending': 0,
                'approved': 0,
                'rejected': 0
            })
            chart_data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'total': data['total'],
                'pending': data['pending'],
                'approved': data['approved'],
                'rejected': data['rejected']
            })
            current_date += timedelta(days=1)

        # Calculate approval rate
        total_approvals = Approval.objects.filter(created_at__gte=start_date).count()
        approved = Approval.objects.filter(created_at__gte=start_date, status='approved').count()
        rejected = Approval.objects.filter(created_at__gte=start_date, status='rejected').count()
        
        approval_rate = 0.0
        rejection_rate = 0.0
        if total_approvals > 0:
            approval_rate = round((approved / total_approvals) * 100, 2)
            rejection_rate = round((rejected / total_approvals) * 100, 2)

        return Response({
            'chart_data': chart_data,
            'summary': {
                'total': total_approvals,
                'approved': approved,
                'rejected': rejected,
                'pending': Approval.objects.filter(status='pending').count(),
                'approval_rate': approval_rate,
                'rejection_rate': rejection_rate
            }
        })


class AnalyticsUsersView(APIView):
    """
    GET /analytics/users
    
    Returns user activity metrics.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        # User role distribution
        role_distribution = User.objects.values('role').annotate(
            count=Count('id')
        )

        # Users who triggered executions in the period
        active_execution_users = WorkflowExecution.objects.filter(
            created_at__gte=start_date,
            triggered_by__isnull=False
        ).values('triggered_by').distinct().count()

        # Users who have pending approvals
        pending_approval_users = Approval.objects.filter(
            status='pending'
        ).values('assigned_to').distinct().count()

        # New users in period
        new_users = User.objects.filter(created_at__gte=start_date).count()

        return Response({
            'role_distribution': list(role_distribution),
            'active_execution_users': active_execution_users,
            'pending_approval_users': pending_approval_users,
            'new_users': new_users,
            'total_users': User.objects.count(),
            'active_users': User.objects.filter(is_active=True).count()
        })


class AnalyticsWorkflowUsageView(APIView):
    """
    GET /analytics/workflow-usage
    
    Returns workflow usage frequency.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        # Get execution counts per workflow
        workflow_usage = WorkflowExecution.objects.filter(
            created_at__gte=start_date
        ).values(
            'workflow_version__workflow__id',
            'workflow_version__workflow__name'
        ).annotate(
            execution_count=Count('id'),
            completed_count=Count('id', filter=Q(status='completed')),
            failed_count=Count('id', filter=Q(status='failed'))
        ).order_by('-execution_count')[:10]

        return Response({
            'workflow_usage': list(workflow_usage)
        })
