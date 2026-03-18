"""
Core URL — exposes audit logs and settings endpoints
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AuditLogViewSet, DashboardStatsView, SettingsView, UserManagementView, UpdateUserRoleView

router = DefaultRouter()
router.register(r'logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('', include(router.urls)),
    path('stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('settings/', SettingsView.as_view(), name='settings'),
    path('settings/users/', UserManagementView.as_view(), name='user-management'),
    path('settings/users/<uuid:user_id>/role/', UpdateUserRoleView.as_view(), name='update-user-role'),
]
