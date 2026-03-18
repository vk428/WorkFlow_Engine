"""
Core Middleware
- AuditLogMiddleware: captures request metadata for audit logs
"""
import logging

logger = logging.getLogger('apps.core')


class AuditLogMiddleware:
    """Attach request metadata to the current thread for use in audit logging."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Stash IP and user agent on request for later use
        request.audit_ip = self._get_client_ip(request)
        request.audit_user_agent = request.META.get('HTTP_USER_AGENT', '')
        response = self.get_response(request)
        return response

    @staticmethod
    def _get_client_ip(request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
