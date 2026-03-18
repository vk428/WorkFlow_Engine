"""
Analytics Models
"""
from django.db import models


class AnalyticsSnapshot(models.Model):
    """
    Stores daily analytics snapshots for historical data.
    """
    date = models.DateField(unique=True, db_index=True)
    
    # Workflow metrics
    total_workflows = models.IntegerField(default=0)
    active_workflows = models.IntegerField(default=0)
    
    # Execution metrics
    total_executions = models.IntegerField(default=0)
    completed_executions = models.IntegerField(default=0)
    failed_executions = models.IntegerField(default=0)
    active_executions = models.IntegerField(default=0)
    
    # Approval metrics
    total_approvals = models.IntegerField(default=0)
    pending_approvals = models.IntegerField(default=0)
    approved_approvals = models.IntegerField(default=0)
    rejected_approvals = models.IntegerField(default=0)
    
    # User metrics
    total_users = models.IntegerField(default=0)
    active_users = models.IntegerField(default=0)
    
    # Calculated metrics
    success_rate = models.FloatField(default=0.0)
    average_execution_time = models.FloatField(default=0.0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'analytics_snapshots'
        ordering = ['-date']

    def __str__(self):
        return f"Analytics {self.date}"
