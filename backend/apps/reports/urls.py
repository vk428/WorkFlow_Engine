"""
Reports URL Configuration
"""
from django.urls import path
from .views import (
    ExecutionReportView,
    WorkflowReportView,
    ApprovalReportView,
    ReportFiltersView,
)

urlpatterns = [
    path('executions', ExecutionReportView.as_view(), name='report-executions'),
    path('workflows', WorkflowReportView.as_view(), name='report-workflows'),
    path('approvals', ApprovalReportView.as_view(), name='report-approvals'),
    path('filters', ReportFiltersView.as_view(), name='report-filters'),
]
