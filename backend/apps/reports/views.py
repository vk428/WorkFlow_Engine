"""
Reports API Views
"""
import csv
import io
from datetime import datetime
from django.db.models import Q
from django.http import HttpResponse
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


class ExecutionReportView(APIView):
    """
    GET /reports/executions
    
    Returns execution report with filters and export options.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # Get filter parameters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        workflow_id = request.query_params.get('workflow_id')
        user_id = request.query_params.get('user_id')
        status_filter = request.query_params.get('status')
        export_format = request.query_params.get('export')

        # Build query
        queryset = WorkflowExecution.objects.select_related(
            'workflow_version__workflow',
            'triggered_by'
        ).order_by('-created_at')

        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)
        if workflow_id:
            queryset = queryset.filter(workflow_version__workflow_id=workflow_id)
        if user_id:
            queryset = queryset.filter(triggered_by_id=user_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Export handling
        if export_format == 'csv':
            return self.export_csv(queryset)
        
        # Paginated response
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        total = queryset.count()
        items = queryset[start_idx:end_idx]

        data = [{
            'id': str(e.id),
            'workflow_name': e.workflow_version.workflow.name,
            'status': e.status,
            'triggered_by': e.triggered_by.full_name if e.triggered_by else None,
            'started_at': e.started_at.isoformat() if e.started_at else None,
            'completed_at': e.completed_at.isoformat() if e.completed_at else None,
            'duration_seconds': e.duration_seconds,
            'error_message': e.error_message[:100] if e.error_message else None,
            'created_at': e.created_at.isoformat()
        } for e in items]

        return Response({
            'results': data,
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size
        })

    def export_csv(self, queryset):
        """Export executions to CSV."""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            'ID', 'Workflow', 'Status', 'Triggered By', 
            'Started At', 'Completed At', 'Duration (s)', 
            'Error Message', 'Created At'
        ])
        
        # Data
        for e in queryset:
            writer.writerow([
                str(e.id),
                e.workflow_version.workflow.name,
                e.status,
                e.triggered_by.full_name if e.triggered_by else '',
                e.started_at.isoformat() if e.started_at else '',
                e.completed_at.isoformat() if e.completed_at else '',
                e.duration_seconds or '',
                e.error_message or '',
                e.created_at.isoformat()
            ])
        
        output.seek(0)
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="executions_{datetime.now().strftime("%Y%m%d")}.csv"'
        return response


class WorkflowReportView(APIView):
    """
    GET /reports/workflows
    
    Returns workflow report with filters and export options.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        category = request.query_params.get('category')
        status_filter = request.query_params.get('status')
        export_format = request.query_params.get('export')

        queryset = Workflow.objects.all().order_by('-created_at')

        if category:
            queryset = queryset.filter(category=category)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if export_format == 'csv':
            return self.export_csv(queryset)

        # Get execution counts for each workflow
        data = []
        for w in queryset:
            execution_count = WorkflowExecution.objects.filter(
                workflow_version__workflow=w
            ).count()
            
            data.append({
                'id': str(w.id),
                'name': w.name,
                'description': w.description[:100],
                'category': w.category,
                'status': w.status,
                'tags': w.tags,
                'execution_count': execution_count,
                'created_at': w.created_at.isoformat(),
                'updated_at': w.updated_at.isoformat()
            })

        return Response({'results': data, 'count': len(data)})

    def export_csv(self, queryset):
        """Export workflows to CSV."""
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(['ID', 'Name', 'Category', 'Status', 'Tags', 'Created At'])
        
        for w in queryset:
            writer.writerow([
                str(w.id),
                w.name,
                w.category,
                w.status,
                ','.join(w.tags) if w.tags else '',
                w.created_at.isoformat()
            ])
        
        output.seek(0)
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="workflows_{datetime.now().strftime("%Y%m%d")}.csv"'
        return response


class ApprovalReportView(APIView):
    """
    GET /reports/approvals
    
    Returns approval report with filters and export options.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        status_filter = request.query_params.get('status')
        user_id = request.query_params.get('user_id')
        workflow_id = request.query_params.get('workflow_id')
        export_format = request.query_params.get('export')

        queryset = Approval.objects.select_related(
            'workflow_execution__workflow_version__workflow',
            'assigned_to',
            'resolved_by'
        ).order_by('-created_at')

        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if user_id:
            queryset = queryset.filter(assigned_to_id=user_id)
        if workflow_id:
            queryset = queryset.filter(
                workflow_execution__workflow_version__workflow_id=workflow_id
            )

        if export_format == 'csv':
            return self.export_csv(queryset)

        # Paginated response
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        total = queryset.count()
        items = queryset[start_idx:end_idx]

        data = [{
            'id': str(a.id),
            'step_name': a.step_name,
            'workflow_name': a.workflow_execution.workflow_version.workflow.name if a.workflow_execution else '',
            'status': a.status,
            'assigned_to': a.assigned_to.full_name if a.assigned_to else None,
            'resolved_by': a.resolved_by.full_name if a.resolved_by else None,
            'resolved_at': a.resolved_at.isoformat() if a.resolved_at else None,
            'comments': a.comments[:100] if a.comments else None,
            'rejection_reason': a.rejection_reason[:100] if a.rejection_reason else None,
            'created_at': a.created_at.isoformat()
        } for a in items]

        return Response({
            'results': data,
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size
        })

    def export_csv(self, queryset):
        """Export approvals to CSV."""
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            'ID', 'Step Name', 'Workflow', 'Status', 
            'Assigned To', 'Resolved By', 'Resolved At',
            'Comments', 'Created At'
        ])
        
        for a in queryset:
            writer.writerow([
                str(a.id),
                a.step_name,
                a.workflow_execution.workflow_version.workflow.name if a.workflow_execution else '',
                a.status,
                a.assigned_to.full_name if a.assigned_to else '',
                a.resolved_by.full_name if a.resolved_by else '',
                a.resolved_at.isoformat() if a.resolved_at else '',
                a.comments or '',
                a.created_at.isoformat()
            ])
        
        output.seek(0)
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="approvals_{datetime.now().strftime("%Y%m%d")}.csv"'
        return response


class ReportFiltersView(APIView):
    """
    GET /reports/filters
    
    Returns filter options for reports.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # Get all workflows
        workflows = Workflow.objects.all().values('id', 'name', 'category')
        
        # Get all users
        users = User.objects.all().values('id', 'first_name', 'last_name', 'email')
        
        # Get categories
        categories = Workflow.objects.values_list('category', flat=True).distinct()
        
        return Response({
            'workflows': list(workflows),
            'users': [{
                'id': str(u['id']),
                'name': f"{u['first_name']} {u['last_name']}",
                'email': u['email']
            } for u in users],
            'categories': [c for c in categories if c],
            'execution_statuses': [s[0] for s in WorkflowExecution.Status.choices],
            'approval_statuses': [s[0] for s in Approval.Status.choices],
            'workflow_statuses': [s[0] for s in Workflow.Status.choices]
        })
