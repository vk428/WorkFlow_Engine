"""
Custom exception handler and domain-specific exceptions
"""
import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger('apps.core')


# ---------------------------------------------------------------------------
# Domain Exceptions
# ---------------------------------------------------------------------------

class WorkflowPlatformError(Exception):
    """Base exception for all platform errors."""
    default_message = 'An unexpected error occurred.'
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, message=None, extra=None):
        self.message = message or self.default_message
        self.extra = extra or {}
        super().__init__(self.message)


class WorkflowNotFoundError(WorkflowPlatformError):
    default_message = 'Workflow not found.'
    status_code = status.HTTP_404_NOT_FOUND


class WorkflowNotPublishedError(WorkflowPlatformError):
    default_message = 'Workflow must be published before it can be executed.'


class WorkflowExecutionError(WorkflowPlatformError):
    default_message = 'Workflow execution failed.'


class StepExecutionError(WorkflowPlatformError):
    default_message = 'Step execution failed.'


class RuleEvaluationError(WorkflowPlatformError):
    default_message = 'Rule evaluation failed.'


class ApprovalError(WorkflowPlatformError):
    default_message = 'Approval action failed.'


class NotificationError(WorkflowPlatformError):
    default_message = 'Notification delivery failed.'


class InsufficientPermissionsError(WorkflowPlatformError):
    default_message = 'You do not have permission to perform this action.'
    status_code = status.HTTP_403_FORBIDDEN


class InvalidConditionError(WorkflowPlatformError):
    default_message = 'Invalid condition configuration.'


# ---------------------------------------------------------------------------
# DRF Custom Handler
# ---------------------------------------------------------------------------

def custom_exception_handler(exc, context):
    """
    Wraps all exceptions (Django + custom) in a consistent JSON response:
    {
        "success": false,
        "error": {
            "code": "WORKFLOW_EXECUTION_ERROR",
            "message": "...",
            "details": {}
        }
    }
    """
    # Let DRF handle standard exceptions first
    response = exception_handler(exc, context)

    if response is not None:
        # Reformat DRF responses
        response.data = {
            'success': False,
            'error': {
                'code': _get_error_code(exc),
                'message': _extract_message(response.data),
                'details': response.data if isinstance(response.data, dict) else {},
            }
        }
        return response

    # Handle our custom domain exceptions
    if isinstance(exc, WorkflowPlatformError):
        logger.error(f"Domain exception: {type(exc).__name__}: {exc.message}", exc_info=True)
        return Response(
            {
                'success': False,
                'error': {
                    'code': type(exc).__name__.upper(),
                    'message': exc.message,
                    'details': exc.extra,
                }
            },
            status=exc.status_code,
        )

    # Unhandled exception — 500
    logger.exception(f"Unhandled exception in {context.get('view', 'unknown')}: {exc}")
    return Response(
        {
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': 'An internal server error occurred. Please contact support.',
                'details': {},
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _get_error_code(exc):
    class_name = type(exc).__name__
    # Convert CamelCase to UPPER_SNAKE
    import re
    return re.sub(r'(?<!^)(?=[A-Z])', '_', class_name).upper()


def _extract_message(data):
    if isinstance(data, dict):
        if 'detail' in data:
            return str(data['detail'])
        if 'non_field_errors' in data:
            return str(data['non_field_errors'][0])
    if isinstance(data, list) and data:
        return str(data[0])
    return 'An error occurred.'
