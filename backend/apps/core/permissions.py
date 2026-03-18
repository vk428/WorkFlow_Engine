"""
Core Permissions — Simplified RBAC for Enterprise Standards
"""
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Full platform access."""
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'admin'
        )


class IsStandardUser(BasePermission):
    """Basic access for workflow participants."""
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'user'
        )


class IsOwnerOrAdmin(BasePermission):
    """Object-level permission: owner or admin."""
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
            
        if request.user.role == 'admin':
            return True
        
        # Check if object has 'created_by', 'user', or 'owner' field
        owner = getattr(obj, 'created_by', getattr(obj, 'user', getattr(obj, 'owner', None)))
        return owner == request.user
