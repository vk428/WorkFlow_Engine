"""
Workflow URLs — nested routing
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedDefaultRouter
from .views import WorkflowViewSet, WorkflowStepViewSet

router = DefaultRouter()
router.register(r'', WorkflowViewSet, basename='workflow')

# Nested router for steps: /workflows/{workflow_id}/steps/
workflow_router = NestedDefaultRouter(router, r'', lookup='workflow')
workflow_router.register(r'steps', WorkflowStepViewSet, basename='workflow-steps')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(workflow_router.urls)),
]
