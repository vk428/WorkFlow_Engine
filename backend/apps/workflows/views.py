"""
Workflow Views (DRF ViewSets)
"""
import logging
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.core.permissions import IsAdmin
from apps.core.pagination import StandardResultsPagination
from apps.core.exceptions import WorkflowNotPublishedError
from .models import Workflow, WorkflowStep
from .serializers import (
    WorkflowListSerializer,
    WorkflowDetailSerializer,
    WorkflowCreateSerializer,
    WorkflowVersionSerializer,
    WorkflowStepSerializer,
    WorkflowStepWriteSerializer,
    WorkflowConditionSerializer,
    WorkflowRuleSerializer,
)
from .services import WorkflowService

logger = logging.getLogger('apps.workflows')


class WorkflowViewSet(viewsets.ModelViewSet):
    """
    Full CRUD + custom actions for workflows.
    """
    pagination_class = StandardResultsPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'category']
    search_fields = ['name', 'description', 'tags']
    ordering_fields = ['created_at', 'name', 'status']

    def get_queryset(self):
        return (
            Workflow.objects
            .select_related('active_version', 'created_by')
            .prefetch_related('versions')
            .all()
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return WorkflowListSerializer
        if self.action in ['create']:
            return WorkflowCreateSerializer
        return WorkflowDetailSerializer

    def get_permissions(self):
        # Admin-only for structural changes
        if self.action in [
            'create', 'update', 'partial_update', 'destroy', 
            'publish', 'duplicate', 'simulate', 'update_canvas'
        ]:
            return [IsAdmin()]
        
        # Step management (POST) is for admins only
        if self.action == 'steps' and self.request.method == 'POST':
            return [IsAdmin()]
            
        return [permissions.IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        serializer = WorkflowCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workflow = WorkflowService.create_workflow(serializer.validated_data, request.user)
        return Response(
            {'success': True, 'data': WorkflowDetailSerializer(workflow).data},
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete(user=request.user)
        return Response({'success': True, 'message': 'Workflow deleted.'}, status=204)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def publish(self, request, pk=None):
        """POST /workflows/{id}/publish/ — Publish a draft workflow."""
        changelog = request.data.get('changelog', '')
        version = WorkflowService.publish_workflow(pk, request.user, changelog)
        return Response({
            'success': True,
            'message': f'Workflow published as version {version.version_number}.',
            'data': WorkflowVersionSerializer(version).data,
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def duplicate(self, request, pk=None):
        """POST /workflows/{id}/duplicate/ — Clone workflow."""
        new_workflow = WorkflowService.duplicate_workflow(pk, request.user)
        return Response({
            'success': True,
            'data': WorkflowDetailSerializer(new_workflow).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def simulate(self, request, pk=None):
        """POST /workflows/{id}/simulate/ — Dry-run workflow."""
        from apps.executions.engine import WorkflowEngine
        workflow = self.get_object()
        if not workflow.active_version:
            raise WorkflowNotPublishedError()
        context = request.data.get('context', {})
        result = WorkflowEngine.simulate(workflow.active_version, context)
        return Response({'success': True, 'simulation': result})

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """POST /workflows/{id}/execute/ — Start a live execution."""
        from apps.executions.services import ExecutionService
        workflow = self.get_object()
        if not workflow.active_version:
            raise WorkflowNotPublishedError()
        
        # Validate workflow has steps
        step_count = workflow.active_version.steps.count()
        if step_count == 0:
            return Response({
                'success': False,
                'message': 'Cannot execute workflow with 0 steps.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        context = request.data.get('context', {})
        execution = ExecutionService.start(
            workflow_version=workflow.active_version,
            triggered_by=request.user,
            context=context,
        )
        from apps.executions.serializers import WorkflowExecutionSerializer
        return Response({
            'success': True,
            'data': WorkflowExecutionSerializer(execution).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def execute_form(self, request, pk=None):
        """GET /workflows/{id}/execute_form/ — Get input form schema."""
        workflow = self.get_object()
        if not workflow.active_version:
            return Response({
                'success': False,
                'message': 'Workflow has no published version.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get steps to build form schema
        steps = workflow.active_version.steps.all()
        form_fields = []
        
        for step in steps:
            config = step.config or {}
            if config.get('input_fields'):
                for field in config['input_fields']:
                    form_fields.append({
                        'name': field.get('name'),
                        'label': field.get('label', field.get('name')),
                        'type': field.get('type', 'text'),
                        'required': field.get('required', False),
                        'options': field.get('options', []),
                        'step_name': step.name,
                    })
        
        # If no custom fields, generate basic fields from workflow
        if not form_fields:
            form_fields = [
                {'name': 'requestor_name', 'label': 'Your Name', 'type': 'text', 'required': True},
                {'name': 'department', 'label': 'Department', 'type': 'text', 'required': True},
                {'name': 'description', 'label': 'Description', 'type': 'textarea', 'required': False},
            ]
        
        return Response({
            'success': True,
            'data': {
                'workflow_name': workflow.name,
                'workflow_id': str(workflow.id),
                'version': workflow.active_version.version_number,
                'step_count': steps.count(),
                'fields': form_fields,
            }
        })

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """GET /workflows/{id}/versions/ — List all versions."""
        workflow = self.get_object()
        versions = workflow.versions.all()
        serializer = WorkflowVersionSerializer(versions, many=True)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=True, methods=['get', 'post'], url_path='steps')
    def steps(self, request, pk=None):
        """GET/POST /workflows/{id}/steps/"""
        workflow = self.get_object()
        latest_version = workflow.versions.first()
        if request.method == 'GET':
            steps = latest_version.steps.all() if latest_version else []
            return Response({
                'success': True,
                'data': WorkflowStepSerializer(steps, many=True).data,
            })
        if request.method == 'POST':
            # This is also protected by get_permissions -> IsAdmin
            serializer = WorkflowStepWriteSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            step = WorkflowService.add_step(pk, serializer.validated_data, request.user)
            return Response({
                'success': True,
                'data': WorkflowStepSerializer(step).data,
            }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def update_canvas(self, request, pk=None):
        """POST /workflows/{id}/update_canvas/ — Sync UI nodes/edges to DB."""
        version = WorkflowService.update_canvas(pk, request.data, request.user)
        return Response({
            'success': True,
            'message': 'Canvas updated.',
            'data': WorkflowVersionSerializer(version).data
        })

    @action(detail=True, methods=['get'])
    def validate(self, request, pk=None):
        """GET /workflows/{id}/validate/ — Validate workflow structure."""
        from .validators import WorkflowValidator
        workflow = self.get_object()
        latest_version = workflow.versions.first()
        if not latest_version:
            return Response({
                'success': False,
                'message': 'No version exists for this workflow.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        errors = WorkflowValidator.validate(latest_version)
        has_errors = any(e['severity'] == 'error' for e in errors)
        
        return Response({
            'success': not has_errors,
            'errors': errors,
            'error_count': len([e for e in errors if e['severity'] == 'error']),
            'warning_count': len([e for e in errors if e['severity'] == 'warning']),
        })

    @action(detail=False, methods=['get'])
    def request_types(self, request):
        """
        GET /workflows/request_types/ — Get available request types for users.
        Returns published workflows that users can submit requests against.
        """
        # Get only published workflows with active versions
        workflows = (
            Workflow.objects
            .filter(status=Workflow.Status.PUBLISHED)
            .exclude(active_version__isnull=True)
            .select_related('active_version')
            .prefetch_related('active_version__steps')
            .order_by('name')
        )
        
        request_types = []
        for wf in workflows:
            step_count = wf.active_version.steps.count() if wf.active_version else 0
            
            # Determine request type category based on workflow name
            name_lower = wf.name.lower()
            if 'expense' in name_lower or 'reimbursement' in name_lower:
                category = 'expense'
                display_name = 'Expense Request'
                icon = 'receipt'
            elif 'leave' in name_lower or 'vacation' in name_lower or 'time off' in name_lower:
                category = 'leave'
                display_name = 'Leave Request'
                icon = 'calendar'
            elif 'onboard' in name_lower or 'joining' in name_lower:
                category = 'onboarding'
                display_name = 'Onboarding Request'
                icon = 'user-plus'
            else:
                category = 'general'
                display_name = wf.name
                icon = 'file-text'
            
            request_types.append({
                'id': str(wf.id),
                'name': wf.name,
                'display_name': display_name,
                'description': wf.description or f'Submit a {wf.name} request',
                'category': category,
                'icon': icon,
                'color': wf.color or '#6366f1',
                'step_count': step_count,
                'version': wf.active_version.version_number if wf.active_version else 1,
            })
        
        return Response({
            'success': True,
            'data': request_types,
            'count': len(request_types),
        })


class WorkflowStepViewSet(viewsets.ModelViewSet):
    """CRUD for individual steps."""
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return (
            WorkflowStep.objects
            .prefetch_related('conditions', 'rules')
            .filter(workflow_version__workflow_id=self.kwargs.get('workflow_pk'))
        )

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return WorkflowStepWriteSerializer
        return WorkflowStepSerializer

    @action(detail=True, methods=['post'])
    def add_condition(self, request, pk=None, workflow_pk=None):
        step = self.get_object()
        serializer = WorkflowConditionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        condition = serializer.save(step=step)
        return Response({'success': True, 'data': WorkflowConditionSerializer(condition).data})

    @action(detail=True, methods=['post'])
    def add_rule(self, request, pk=None, workflow_pk=None):
        step = self.get_object()
        serializer = WorkflowRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = serializer.save(step=step)
        return Response({'success': True, 'data': WorkflowRuleSerializer(rule).data})
