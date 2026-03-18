"""
Analytics URL Configuration
"""
from django.urls import path
from .views import (
    AnalyticsOverviewView,
    AnalyticsExecutionsView,
    AnalyticsApprovalsView,
    AnalyticsUsersView,
    AnalyticsWorkflowUsageView,
)

urlpatterns = [
    path('overview', AnalyticsOverviewView.as_view(), name='analytics-overview'),
    path('executions', AnalyticsExecutionsView.as_view(), name='analytics-executions'),
    path('approvals', AnalyticsApprovalsView.as_view(), name='analytics-approvals'),
    path('users', AnalyticsUsersView.as_view(), name='analytics-users'),
    path('workflow-usage', AnalyticsWorkflowUsageView.as_view(), name='analytics-workflow-usage'),
]
