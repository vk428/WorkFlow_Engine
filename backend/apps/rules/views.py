"""
Rules Views — rule testing endpoint
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .evaluator import RuleEvaluator
from apps.core.exceptions import RuleEvaluationError


class RuleTestView(APIView):
    """
    POST /rules/test/
    Test a rule condition against a given context without executing a workflow.
    Useful for the Rule Builder UI.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        condition = request.data.get('condition', {})
        context = request.data.get('context', {})

        try:
            result = RuleEvaluator.evaluate(condition, context)
            return Response({
                'success': True,
                'result': result,
                'condition': condition,
                'context': context,
            })
        except RuleEvaluationError as e:
            return Response({'success': False, 'error': str(e)}, status=400)
