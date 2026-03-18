"""
Execution URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkflowExecutionViewSet, AllExecutionsViewSet, StepExecutionViewSet

router = DefaultRouter()
router.register(r'my', WorkflowExecutionViewSet, basename='my-execution')
router.register(r'all', AllExecutionsViewSet, basename='all-execution')
router.register(r'steps', StepExecutionViewSet, basename='step-execution')

urlpatterns = [
    path('', include(router.urls)),
]
