"""
Rule Evaluation Engine
=======================
Evaluates JSON-DSL conditions against a dynamic execution context.

Supported Operators:
  eq, neq, gt, gte, lt, lte,
  in, not_in, contains, not_contains,
  starts_with, ends_with, regex,
  is_null, is_not_null

Condition DSL (stored in DB):
{
  "operator": "AND",           # top-level combinator
  "conditions": [
    {
      "field": "expense_amount",
      "op": "gt",
      "value": 10000
    },
    {
      "operator": "OR",         # nested group
      "conditions": [
        {"field": "department", "op": "eq", "value": "Engineering"},
        {"field": "department", "op": "eq", "value": "Marketing"}
      ]
    }
  ]
}
"""
import re
import logging
from typing import Any, Optional
from apps.core.exceptions import RuleEvaluationError

logger = logging.getLogger('apps.rules')


class RuleEvaluator:
    """
    Stateless, pure-function rule evaluator.
    All methods are classmethods — no instance state.
    """

    SUPPORTED_OPERATORS = {
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
        'in', 'not_in', 'contains', 'not_contains',
        'starts_with', 'ends_with', 'regex',
        'is_null', 'is_not_null',
    }

    @classmethod
    def evaluate(cls, condition_dsl: dict, context: dict) -> bool:
        """
        Entry point. Evaluates a full condition DSL tree.

        Args:
            condition_dsl: The JSON DSL from WorkflowRule.condition
            context: The execution context dict (key-value store)

        Returns:
            bool — whether the condition passes
        """
        if not condition_dsl:
            return True  # Empty condition → always passes

        try:
            return cls._evaluate_node(condition_dsl, context)
        except RuleEvaluationError:
            raise
        except Exception as e:
            logger.exception(f"Rule evaluation error: {e}")
            raise RuleEvaluationError(f"Unexpected error during rule evaluation: {str(e)}")

    @classmethod
    def _evaluate_node(cls, node: dict, context: dict) -> bool:
        """Recursively evaluate a condition node (group or leaf)."""
        if 'operator' in node and 'conditions' in node:
            # Composite node (AND/OR group)
            return cls._evaluate_group(node, context)
        elif 'field' in node or 'op' in node:
            # Leaf node (single comparison)
            return cls._evaluate_leaf(node, context)
        else:
            raise RuleEvaluationError(f"Invalid condition node structure: {node}")

    @classmethod
    def _evaluate_group(cls, group: dict, context: dict) -> bool:
        """Evaluate AND/OR group of conditions."""
        combinator = group.get('operator', 'AND').upper()
        conditions = group.get('conditions', [])

        if not conditions:
            return True

        if combinator == 'AND':
            return all(cls._evaluate_node(c, context) for c in conditions)
        elif combinator == 'OR':
            return any(cls._evaluate_node(c, context) for c in conditions)
        elif combinator == 'NOT':
            # Unary NOT — expects a single condition
            if len(conditions) != 1:
                raise RuleEvaluationError("NOT operator expects exactly one condition.")
            return not cls._evaluate_node(conditions[0], context)
        else:
            raise RuleEvaluationError(f"Unknown combinator: {combinator}")

    @classmethod
    def _evaluate_leaf(cls, leaf: dict, context: dict) -> bool:
        """Evaluate a single field comparison."""
        field = leaf.get('field')
        operator = leaf.get('op') or leaf.get('operator')
        expected_value = leaf.get('value')
        negate = leaf.get('negate', False)

        if not field or not operator:
            raise RuleEvaluationError(f"Leaf condition missing 'field' or 'op': {leaf}")

        if operator not in cls.SUPPORTED_OPERATORS:
            raise RuleEvaluationError(f"Unsupported operator: {operator}")

        # Resolve field value from context (supports dot notation)
        actual_value = cls._resolve_field(field, context)

        result = cls._compare(operator, actual_value, expected_value)
        return (not result) if negate else result

    @classmethod
    def _resolve_field(cls, field_path: str, context: dict) -> Any:
        """
        Resolve a dot-notation field path from context.
        E.g. "request.total_amount" resolves context['request']['total_amount']
        """
        parts = field_path.split('.')
        value = context
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None
        return value

    @classmethod
    def _compare(cls, operator: str, actual: Any, expected: Any) -> bool:
        """Perform the actual comparison."""
        try:
            if operator == 'is_null':
                return actual is None
            if operator == 'is_not_null':
                return actual is not None

            # Type coercion for numeric comparisons
            if operator in ('gt', 'gte', 'lt', 'lte') and actual is not None:
                actual = cls._coerce_number(actual)
                expected = cls._coerce_number(expected)

            if operator == 'eq':
                return actual == expected
            elif operator == 'neq':
                return actual != expected
            elif operator == 'gt':
                return actual > expected
            elif operator == 'gte':
                return actual >= expected
            elif operator == 'lt':
                return actual < expected
            elif operator == 'lte':
                return actual <= expected
            elif operator == 'in':
                return actual in (expected if isinstance(expected, list) else [expected])
            elif operator == 'not_in':
                return actual not in (expected if isinstance(expected, list) else [expected])
            elif operator == 'contains':
                return expected in str(actual)
            elif operator == 'not_contains':
                return expected not in str(actual)
            elif operator == 'starts_with':
                return str(actual).startswith(str(expected))
            elif operator == 'ends_with':
                return str(actual).endswith(str(expected))
            elif operator == 'regex':
                return bool(re.match(str(expected), str(actual)))
            return False
        except (TypeError, ValueError) as e:
            logger.warning(f"Comparison error [{operator}] {actual} vs {expected}: {e}")
            return False

    @staticmethod
    def _coerce_number(value: Any) -> float:
        """Attempt to coerce a value to float for numeric comparisons."""
        try:
            return float(value)
        except (TypeError, ValueError):
            raise RuleEvaluationError(f"Cannot coerce '{value}' to a number for comparison.")


class ConditionGroupEvaluator:
    """
    Evaluates WorkflowCondition model instances (DB-backed conditions).
    Groups conditions by their 'group' field and evaluates:
      - Within a group: AND logic
      - Across groups: OR logic
    """

    @staticmethod
    def evaluate(conditions, context: dict) -> bool:
        """
        Args:
            conditions: QuerySet or list of WorkflowCondition instances
            context: execution context dict

        Returns:
            bool — True if ANY group passes (OR of ANDs)
        """
        if not conditions:
            return True

        # Group by group number
        groups: dict[int, list] = {}
        for cond in conditions:
            groups.setdefault(cond.group, []).append(cond)

        # Evaluate each group (AND within group)
        def evaluate_group(group_conditions) -> bool:
            for cond in group_conditions:
                leaf = {
                    'field': cond.field,
                    'op': cond.operator,
                    'value': cond.value,
                    'negate': cond.negate,
                }
                if not RuleEvaluator._evaluate_leaf(leaf, context):
                    return False
            return True

        # OR across groups
        return any(evaluate_group(group_conds) for group_conds in groups.values())
