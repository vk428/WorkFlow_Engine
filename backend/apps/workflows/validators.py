"""
Workflow Validation Service
==========================
Validates workflow definitions to ensure they are executable.
"""
from typing import List, Dict, Any, Optional
from .models import WorkflowStep, WorkflowRule


class WorkflowValidationError(Exception):
    """Raised when workflow validation fails."""
    def __init__(self, errors: List[Dict[str, Any]]):
        self.errors = errors
        super().__init__(str(errors))


class WorkflowValidator:
    """
    Validates workflow definitions for structural integrity.
    
    Rules:
    - Must have at least one step
    - Must have a start step (order=0)
    - Must have an end step
    - No disconnected steps
    - All steps must have a valid next path (via next_step or rules)
    - Approval steps must have assigned_role
    - Condition steps must have rules
    """

    @classmethod
    def validate(cls, workflow_version) -> List[Dict[str, Any]]:
        """
        Validate a workflow version.
        
        Returns:
            List of error dictionaries. Empty list means valid.
        """
        errors = []
        steps = list(workflow_version.steps.all())
        
        if not steps:
            errors.append({
                'type': 'no_steps',
                'message': 'Workflow must have at least one step',
                'severity': 'error'
            })
            return errors

        # Check for start step
        start_steps = [s for s in steps if s.order == 0]
        if not start_steps:
            errors.append({
                'type': 'no_start_step',
                'message': 'Workflow must have a step with order=0 (start step)',
                'severity': 'error'
            })

        # Check for end step
        end_steps = [s for s in steps if s.step_type == WorkflowStep.StepType.END]
        if not end_steps:
            errors.append({
                'type': 'no_end_step',
                'message': 'Workflow must have at least one END step',
                'severity': 'warning'
            })

        # Build step lookup
        step_by_id = {str(s.id): s for s in steps}
        step_ids = set(step_by_id.keys())

        # Check for disconnected steps and validate transitions
        connected_ids = set()
        
        # Start from order=0 steps
        for start in start_steps:
            cls._collect_reachable_steps(start, step_by_id, connected_ids)

        # Find disconnected steps
        disconnected = step_ids - connected_ids
        for step_id in disconnected:
            step = step_by_id[step_id]
            errors.append({
                'type': 'disconnected_step',
                'step_id': step_id,
                'step_name': step.name,
                'message': f'Step "{step.name}" is not reachable from start',
                'severity': 'warning'
            })

        # Validate each step
        for step in steps:
            step_errors = cls._validate_step(step, step_by_id)
            errors.extend(step_errors)

        # Check for circular references
        cycle_errors = cls._check_cycles(steps, step_by_id)
        errors.extend(cycle_errors)

        return errors

    @classmethod
    def _collect_reachable_steps(cls, step: WorkflowStep, step_by_id: Dict, visited: set):
        """Recursively collect all reachable steps from a given step."""
        step_id = str(step.id)
        if step_id in visited:
            return
        visited.add(step_id)

        # Check next_step (linear flow)
        if step.next_step_id:
            next_step = step_by_id.get(str(step.next_step_id))
            if next_step:
                cls._collect_reachable_steps(next_step, step_by_id, visited)

        # Check rejection_step
        if step.rejection_step_id:
            rej_step = step_by_id.get(str(step.rejection_step_id))
            if rej_step:
                cls._collect_reachable_steps(rej_step, step_by_id, visited)

        # Check rules for routing
        for rule in step.rules.all():
            if rule.target_step_id:
                target = step_by_id.get(str(rule.target_step_id))
                if target:
                    cls._collect_reachable_steps(target, step_by_id, visited)

    @classmethod
    def _validate_step(cls, step: WorkflowStep, step_by_id: Dict) -> List[Dict[str, Any]]:
        """Validate a single step's configuration."""
        errors = []

        # Approval steps must have assigned_role
        if step.step_type == WorkflowStep.StepType.APPROVAL:
            if not step.assigned_role:
                errors.append({
                    'type': 'missing_assignment',
                    'step_id': str(step.id),
                    'step_name': step.name,
                    'message': f'Approval step "{step.name}" must have an assigned role',
                    'severity': 'error'
                })

        # Condition gateway steps should have rules for branching
        if step.step_type == WorkflowStep.StepType.CONDITION:
            if not step.rules.exists():
                errors.append({
                    'type': 'no_branching_rules',
                    'step_id': str(step.id),
                    'step_name': step.name,
                    'message': f'Condition step "{step.name}" should have at least one rule for branching',
                    'severity': 'warning'
                })

        # Validate next_step references
        if step.next_step_id:
            if str(step.next_step_id) not in step_by_id:
                errors.append({
                    'type': 'invalid_reference',
                    'step_id': str(step.id),
                    'step_name': step.name,
                    'message': f'Step "{step.name}" references non-existent next_step',
                    'severity': 'error'
                })

        # Validate rejection_step references
        if step.rejection_step_id:
            if str(step.rejection_step_id) not in step_by_id:
                errors.append({
                    'type': 'invalid_reference',
                    'step_id': str(step.id),
                    'step_name': step.name,
                    'message': f'Step "{step.name}" references non-existent rejection_step',
                    'severity': 'error'
                })

        # Validate rule target references
        for rule in step.rules.all():
            if rule.target_step_id:
                if str(rule.target_step_id) not in step_by_id:
                    errors.append({
                        'type': 'invalid_rule_target',
                        'step_id': str(step.id),
                        'step_name': step.name,
                        'rule_id': str(rule.id),
                        'message': f'Rule in "{step.name}" references non-existent target step',
                        'severity': 'error'
                    })

        return errors

    @classmethod
    def _check_cycles(cls, steps: List[WorkflowStep], step_by_id: Dict) -> List[Dict[str, Any]]:
        """Check for circular references in the workflow."""
        errors = []
        
        def has_path_to(start_id: str, target_id: str, visited: set) -> bool:
            """Check if there's a path from start_id to target_id."""
            if start_id == target_id:
                return True
            if start_id in visited:
                return False
            
            visited.add(start_id)
            step = step_by_id.get(start_id)
            if not step:
                return False

            # Check next_step
            if step.next_step_id and has_path_to(str(step.next_step_id), target_id, visited.copy()):
                return True

            # Check rejection_step
            if step.rejection_step_id and has_path_to(str(step.rejection_step_id), target_id, visited.copy()):
                return True

            # Check rules
            for rule in step.rules.all():
                if rule.target_step_id and has_path_to(str(rule.target_step_id), target_id, visited.copy()):
                    return True

            return False

        # For each step, check if it can reach itself via any path
        for step in steps:
            step_id = str(step.id)
            
            # Check next_step chain for cycles
            if step.next_step_id:
                visited = set()
                current = step.next_step_id
                while current:
                    if str(current) == step_id:
                        errors.append({
                            'type': 'circular_reference',
                            'step_id': step_id,
                            'step_name': step.name,
                            'message': f'Circular reference detected: "{step.name}" can reach itself',
                            'severity': 'error'
                        })
                        break
                    if current in visited:
                        break
                    visited.add(current)
                    next_step = step_by_id.get(str(current))
                    current = next_step.next_step_id if next_step else None

        return errors


def validate_workflow(workflow_version) -> List[Dict[str, Any]]:
    """
    Convenience function to validate a workflow version.
    
    Raises:
        WorkflowValidationError if there are critical errors.
    """
    errors = WorkflowValidator.validate(workflow_version)
    
    # Separate errors from warnings
    critical_errors = [e for e in errors if e['severity'] == 'error']
    warnings = [e for e in errors if e['severity'] == 'warning']
    
    if critical_errors:
        raise WorkflowValidationError(critical_errors)
    
    return warnings
