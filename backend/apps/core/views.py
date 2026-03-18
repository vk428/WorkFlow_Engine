"""
Core Views — AuditLog, Dashboard Stats, and Settings
"""
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from django.contrib.auth import get_user_model
from .audit import AuditLog
from .serializers import AuditLogSerializer
from .pagination import StandardResultsPagination
from .permissions import IsAdmin
from apps.workflows.models import Workflow
from apps.executions.models import WorkflowExecution
from apps.approvals.models import Approval

User = get_user_model()


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for audit logs.
    Only accessible to admins.
    """
    serializer_class = AuditLogSerializer
    pagination_class = StandardResultsPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['action', 'actor']
    search_fields = ['description', 'metadata']
    ordering_fields = ['created_at', 'action']

    def get_queryset(self):
        return AuditLog.objects.select_related('actor', 'content_type').all()

    def get_permissions(self):
        return [permissions.IsAuthenticated(), IsAdmin()]


class DashboardStatsView(APIView):
    """
    Provides statistics for the Dashboard.
    Different data returned for Admin vs User.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        is_admin = user.role == 'admin'
        
        if is_admin:
            return self._get_admin_stats()
        else:
            return self._get_user_stats(user)

    def _get_admin_stats(self):
        # Admin: Platform-wide analytics
        total_workflows = Workflow.objects.count()
        active_executions = WorkflowExecution.objects.filter(status='running').count()
        pending_approvals = Approval.objects.filter(status='pending').count()
        
        total_execs = WorkflowExecution.objects.count()
        success_execs = WorkflowExecution.objects.filter(status='completed').count()
        success_rate = round((success_execs / total_execs * 100), 1) if total_execs > 0 else 100.0

        from datetime import timedelta
        from django.utils import timezone
        
        # Calculate dynamic trends based on the last 7 days of executions
        now = timezone.now()
        trends = []
        for i in range(6, -1, -1):
            day = now - timedelta(days=i)
            day_name = day.strftime('%a')
            
            start_of_day = day.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = start_of_day + timedelta(days=1)
            
            # Use created_at if started_at might be null
            execs_that_day = WorkflowExecution.objects.filter(created_at__gte=start_of_day, created_at__lt=end_of_day)
            
            trends.append({
                'name': day_name,
                'value': execs_that_day.count(),
                'failed': execs_that_day.filter(status='failed').count()
            })

        recent_logs = AuditLog.objects.select_related('actor').order_by('-created_at')[:8]
        recent_activity = self._format_activity(recent_logs)

        return Response({
            'success': True,
            'role': 'admin',
            'data': {
                'total_workflows': total_workflows,
                'active_executions': active_executions,
                'pending_approvals': pending_approvals,
                'success_rate': success_rate,
                'trends': trends,
                'recent_activity': recent_activity
            }
        })

    def _get_user_stats(self, user):
        # User: Personal task-focused data
        my_executions = WorkflowExecution.objects.filter(triggered_by=user)
        pending_tasks = Approval.objects.filter(assigned_to=user, status='pending').count()
        completed_tasks = Approval.objects.filter(assigned_to=user, status='approved').count()
        
        total_my_execs = my_executions.count()
        success_my_execs = my_executions.filter(status='completed').count()
        success_rate = round((success_my_execs / total_my_execs * 100), 1) if total_my_execs > 0 else 100.0

        recent_my_logs = AuditLog.objects.filter(actor=user).order_by('-created_at')[:5]
        recent_activity = self._format_activity(recent_my_logs)

        from datetime import timedelta
        from django.utils import timezone
        
        now = timezone.now()
        trends = []
        for i in range(6, -1, -1):
            day = now - timedelta(days=i)
            day_name = day.strftime('%a')
            start_of_day = day.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = start_of_day + timedelta(days=1)
            
            execs_that_day = my_executions.filter(created_at__gte=start_of_day, created_at__lt=end_of_day)
            
            trends.append({
                'name': day_name,
                'value': execs_that_day.count(),
                'failed': execs_that_day.filter(status='failed').count()
            })

        return Response({
            'success': True,
            'role': 'user',
            'data': {
                'pending_tasks': pending_tasks,
                'completed_tasks': completed_tasks,
                'active_executions': my_executions.filter(status='running').count(),
                'success_rate': success_rate,
                'recent_activity': recent_activity,
                'trends': trends
            }
        })

    def _format_activity(self, logs):
        activity = []
        for log in logs:
            # Get target name from content_object if available
            target = 'System'
            if log.content_object:
                try:
                    target = str(log.content_object)
                except Exception:
                    target = log.content_type.name if log.content_type else 'System'
            
            activity.append({
                'id': str(log.id),
                'action': log.description or log.action,
                'target': target,
                'user': log.actor.full_name if log.actor else 'System',
                'time': 'Recent',
                'status': 'success' if log.action != 'FAIL' else 'failed'
            })
        return activity


# Settings Management Views

class SettingsView(APIView):
    """
    GET /settings - Get all system settings
    PUT /settings - Update system settings
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        from .models import SystemSetting
        
        # Get all settings
        settings = SystemSetting.objects.all()
        settings_data = {}
        for s in settings:
            settings_data[s.key] = s.value
        
        # Default settings if not exist
        defaults = {
            'notifications_enabled': settings_data.get('notifications_enabled', True),
            'email_config': settings_data.get('email_config', {
                'smtp_host': '',
                'smtp_port': 587,
                'smtp_user': '',
                'smtp_password': '',
                'use_tls': True,
                'from_email': 'noreply@halleyx.com'
            }),
            'workflow_defaults': settings_data.get('workflow_defaults', {
                'default_status': 'draft',
                'auto_archive_completed': True,
                'archive_after_days': 30
            }),
            'system_maintenance': settings_data.get('system_maintenance', {
                'enabled': False,
                'message': ''
            })
        }
        
        return Response({
            'success': True,
            'data': defaults
        })

    def put(self, request):
        from .models import SystemSetting
        
        data = request.data
        
        # Update notifications setting
        if 'notifications_enabled' in data:
            SystemSetting.objects.update_or_create(
                key='notifications_enabled',
                defaults={'value': data['notifications_enabled'], 'description': 'Enable/disable notifications'}
            )
        
        # Update email config
        if 'email_config' in data:
            SystemSetting.objects.update_or_create(
                key='email_config',
                defaults={'value': data['email_config'], 'description': 'Email configuration'}
            )
        
        # Update workflow defaults
        if 'workflow_defaults' in data:
            SystemSetting.objects.update_or_create(
                key='workflow_defaults',
                defaults={'value': data['workflow_defaults'], 'description': 'Default workflow settings'}
            )
        
        # Update system maintenance
        if 'system_maintenance' in data:
            SystemSetting.objects.update_or_create(
                key='system_maintenance',
                defaults={'value': data['system_maintenance'], 'description': 'System maintenance mode'}
            )
        
        return Response({'success': True, 'message': 'Settings updated successfully'})


class UserManagementView(APIView):
    """
    API for managing users (create, delete, update roles)
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        users = User.objects.all().values(
            'id', 'email', 'first_name', 'last_name', 
            'role', 'department', 'is_active', 'created_at'
        )
        return Response({
            'success': True,
            'data': list(users)
        })

    def post(self, request):
        data = request.data
        
        # Validate required fields
        required = ['email', 'first_name', 'last_name', 'password']
        for field in required:
            if field not in data:
                return Response(
                    {'success': False, 'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Check if user exists
        if User.objects.filter(email=data['email']).exists():
            return Response(
                {'success': False, 'error': 'Email already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create user
        user = User.objects.create_user(
            email=data['email'],
            password=data['password'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            role=data.get('role', 'user'),
            department=data.get('department', '')
        )
        
        return Response({
            'success': True,
            'data': {
                'id': str(user.id),
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role
            }
        }, status=status.HTTP_201_CREATED)

    def delete(self, request):
        user_id = request.query_params.get('user_id')
        
        if not user_id:
            return Response(
                {'success': False, 'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'success': False, 'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Prevent deleting self
        if user == request.user:
            return Response(
                {'success': False, 'error': 'Cannot delete your own account'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user_email = user.email
        print(f"DEBUG: Deleting user {user_email} (ID: {user_id})")
        user.delete()
        AuditLog.log(
            action=AuditLog.ActionType.DELETE,
            actor=request.user,
            description=f'User deleted by admin: {user_email}',
        )
        return Response({'success': True, 'message': 'User deleted successfully'})


class UpdateUserRoleView(APIView):
    """
    PUT /settings/users/{user_id}/role - Update user role
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def put(self, request, user_id):
        new_role = request.data.get('role')
        
        if new_role not in ['admin', 'user']:
            return Response(
                {'success': False, 'error': 'Invalid role. Must be admin or user'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'success': False, 'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user.role = new_role
        user.save()
        
        return Response({
            'success': True,
            'data': {
                'id': str(user.id),
                'email': user.email,
                'role': user.role
            }
        })
