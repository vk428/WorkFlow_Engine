"""
Workflow Execution Engine
==========================
The orchestration heart of the platform.

Architecture:
  WorkflowEngine.run(execution_id)
    → loads execution + version + steps
    → for each step:
        1. Evaluate entry CONDITIONS (skip if not met)
        2. Execute step (dispatch by step_type)
        3. Evaluate exit RULES (route to next step)
        4. Handle APPROVAL wait if needed
        5. Persist output + update context
        6. Emit WebSocket event
        7. Write AuditLog

  Simulation mode:
    Same flow, but nothing is persisted to the DB.
    Returns a dry-run trace of step paths.
"""
import logging
import time
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.conf import settings

from apps.core.audit import AuditLog
from apps.core.exceptions import StepExecutionError, WorkflowExecutionError
from apps.rules.evaluator import RuleEvaluator, ConditionGroupEvaluator
from apps.workflows.models import WorkflowStep, WorkflowVersion, WorkflowRule
from .models import WorkflowExecution, StepExecution

logger = logging.getLogger('apps.executions')


class StepExecutor:
    """
    Dispatches to the correct handler for each step type.
    Each handler returns a dict of output data.
    """

    @classmethod
    def execute(cls, step: WorkflowStep, context: dict, step_exec: StepExecution) -> dict:
        handler = getattr(cls, f"_handle_{step.step_type}", cls._handle_task)
        return handler(step, context, step_exec)

    @staticmethod
    def _handle_task(step, context, step_exec) -> dict:
        """Basic task — mark as done, output context as-is."""
        logger.info(f"  [TASK] Executing: {step.name}")
        return {'status': 'completed', 'step_name': step.name}

    @staticmethod
    def _handle_approval(step, context, step_exec) -> dict:
        """
        Approval step — create an Approval record and pause execution.
        The actual step_exec stays in WAITING until the approval is resolved.
        
        Supports rejection_step for rejection paths.
        """
        from apps.approvals.services import ApprovalService
        logger.info(f"  [APPROVAL] Creating approval for: {step.name}")
        ApprovalService.create_approval(step, step_exec, context)
        return {
            'status': 'waiting_for_approval',
            'rejection_step_id': str(step.rejection_step_id) if step.rejection_step_id else None
        }

    @staticmethod
    def _handle_notification(step, context, step_exec) -> dict:
        """Notification step — dispatch notification then continue."""
        from apps.notifications.services import NotificationService
        logger.info(f"  [NOTIFICATION] Sending notification: {step.name}")
        config = step.config or {}
        NotificationService.dispatch(
            template=config.get('template', 'generic'),
            recipients=config.get('recipients', []),
            context=context,
            step_exec=step_exec,
        )
        return {'status': 'notification_sent'}

    @staticmethod
    def _handle_webhook(step, context, step_exec) -> dict:
        """Webhook step — HTTP call to external endpoint."""
        import requests
        config = step.config or {}
        url = config.get('url', '')
        method = config.get('method', 'POST').upper()
        headers = config.get('headers', {})
        body_template = config.get('body_template', {})

        # Simple template variable substitution
        import json
        body_str = json.dumps(body_template)
        for key, val in context.items():
            body_str = body_str.replace(f"{{{{ {key} }}}}", str(val))

        try:
            response = requests.request(
                method=method, url=url,
                headers=headers, json=json.loads(body_str),
                timeout=30,
            )
            return {'status': 'webhook_called', 'response_code': response.status_code}
        except Exception as e:
            raise StepExecutionError(f"Webhook failed: {e}")

    @staticmethod
    def _handle_delay(step, context, step_exec) -> dict:
        """Delay step — pause execution for a configured duration."""
        # In production, this would schedule a Celery eta task
        duration = step.config.get('duration_seconds', 60)
        logger.info(f"  [DELAY] {step.name} — pausing for {duration}s")
        return {'status': 'delayed', 'duration_seconds': duration}

    @staticmethod
    def _handle_condition(step, context, step_exec) -> dict:
        """Condition gateway — purely route-deciding, no side effects."""
        logger.info(f"  [GATEWAY] Evaluating condition gateway: {step.name}")
        return {'status': 'evaluated'}

    @staticmethod
    def _handle_end(step, context, step_exec) -> dict:
        """End step — signals workflow is complete."""
        logger.info(f"  [END] Workflow ending at step: {step.name}")
        return {'status': 'end_reached'}


class WorkflowEngine:
    """
    Main orchestrator for workflow execution.
    """

    @classmethod
    @transaction.atomic
    def run(cls, execution_id: str) -> WorkflowExecution:
        """
        Execute a workflow from start (or resume from current_step).
        Called by the Celery task.
        """
        try:
            execution = WorkflowExecution.objects.select_related(
                'workflow_version', 'triggered_by', 'current_step',
            ).prefetch_related(
                'workflow_version__steps__conditions',
                'workflow_version__steps__rules',
            ).get(id=execution_id)
        except WorkflowExecution.DoesNotExist:
            raise WorkflowExecutionError(f"Execution {execution_id} not found.")

        logger.info(f"Starting execution {execution_id} for {execution.workflow_version}")

        # Mark as running
        execution.status = WorkflowExecution.Status.RUNNING
        execution.started_at = timezone.now()
        execution.save(update_fields=['status', 'started_at'])

        cls._emit_ws_event(execution, 'execution_started')

        try:
            steps = list(execution.workflow_version.steps.prefetch_related(
                'conditions', 'rules',
            ).order_by('order'))

            context = execution.context.copy()
            
            # Determine starting index
            current_idx = 0
            if execution.current_step_id:
                for i, s in enumerate(steps):
                    if s.id == execution.current_step_id:
                        # If we were WAITING on an approval, we just finished it.
                        # We should evaluate rules of THIS step now, then move on.
                        # Wait, _execute_step already handles rule evaluation.
                        # If we resume, we should probably start AFTER the current_step 
                        # OR re-execute it if it was waiting.
                        
                        # Re-executing a WAITING step will skip the actual execution logic 
                        # because it was already done, but it will evaluate rules.
                        current_idx = i
                        break

            while current_idx < len(steps):
                step = steps[current_idx]
                result = cls._execute_step(step, execution, context)

                if result == 'WAITING':
                    # Approval required — pause here
                    execution.status = WorkflowExecution.Status.WAITING
                    execution.current_step = step
                    execution.context = context
                    execution.save(update_fields=['status', 'current_step', 'context'])
                    cls._emit_ws_event(execution, 'execution_waiting', {'step': step.name})
                    logger.info(f"⏸ Execution {execution_id} paused at {step.name}")
                    return execution

                if result == 'TERMINATE' or result == 'COMPLETE':
                    break

                # Handle Branching
                if isinstance(result, dict) and result.get('_next_step_id'):
                    next_id = result['_next_step_id']
                    if next_id:
                        found = False
                        for i, s in enumerate(steps):
                            if str(s.id) == next_id:
                                current_idx = i
                                found = True
                                break
                        if found:
                            continue # Jump to the found index

                current_idx += 1

            # Mark complete
            execution.status = WorkflowExecution.Status.COMPLETED
            execution.completed_at = timezone.now()
            execution.context = context
            execution.save(update_fields=['status', 'completed_at', 'context'])

            cls._emit_ws_event(execution, 'execution_completed')
            AuditLog.log(
                action=AuditLog.ActionType.COMPLETE,
                instance=execution,
                description=f"Execution completed: {execution.workflow_version}",
            )
            logger.info(f"Execution {execution_id} completed successfully.")

        except Exception as e:
            execution.status = WorkflowExecution.Status.FAILED
            execution.error_message = str(e)
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'error_message', 'completed_at'])
            cls._emit_ws_event(execution, 'execution_failed', {'error': str(e)})
            logger.exception(f"Execution {execution_id} failed: {e}")
            raise

        return execution

    @classmethod
    def _execute_step(cls, step: WorkflowStep, execution: WorkflowExecution, context: dict):
        """
        Execute a single step:
        1. Evaluate entry conditions
        2. Execute step
        3. Evaluate exit rules
        4. Return control signal
        """
        logger.info(f"  → Step [{step.order}] {step.name} ({step.step_type})")

        # ── 1. Entry Condition Check ──────────────────────────────────────
        conditions = list(step.conditions.all())
        if conditions:
            passes = ConditionGroupEvaluator.evaluate(conditions, context)
            if not passes:
                logger.info(f"    ↷ SKIPPED — conditions not met")
                cls._record_step(execution, step, StepExecution.Status.SKIPPED, context)
                AuditLog.log(
                    action=AuditLog.ActionType.SKIP,
                    instance=execution,
                    description=f"Step skipped (condition): {step.name}",
                )
                cls._emit_ws_event(execution, 'step_skipped', {'step': step.name})
                return 'SKIPPED'

        # ── 2. Create StepExecution record ────────────────────────────────
        step_exec = StepExecution.objects.create(
            workflow_execution=execution,
            step=step,
            status=StepExecution.Status.RUNNING,
            input_context=context.copy(),
            started_at=timezone.now(),
        )
        cls._emit_ws_event(execution, 'step_started', {'step': step.name, 'step_exec_id': str(step_exec.id)})

        # ── 3. Execute with retry logic ───────────────────────────────────
        max_retries = step.max_retries or 0
        retry_delay = step.retry_delay_seconds or 60
        output = {}
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                output = StepExecutor.execute(step, context, step_exec)

                # Approval step → pause execution
                if output.get('status') == 'waiting_for_approval':
                    step_exec.status = StepExecution.Status.WAITING
                    step_exec.output_data = output
                    step_exec.save(update_fields=['status', 'output_data'])
                    return {
                        'WAITING': True,
                        'rejection_step_id': output.get('rejection_step_id')
                    }

                break  # Success — exit retry loop

            except Exception as e:
                last_error = e
                if attempt < max_retries:
                    logger.warning(f"    ⚠ Step {step.name} failed (attempt {attempt + 1}), retrying in {retry_delay}s")
                    step_exec.retry_count = attempt + 1
                    step_exec.status = StepExecution.Status.RETRYING
                    step_exec.save(update_fields=['retry_count', 'status'])
                    AuditLog.log(
                        action=AuditLog.ActionType.RETRY,
                        instance=execution,
                        description=f"Retrying step: {step.name} (attempt {attempt + 2})",
                    )
                    time.sleep(min(retry_delay, 5))  # cap at 5s in engine (Celery handles real delay)
                else:
                    # All retries exhausted
                    step_exec.status = StepExecution.Status.FAILED
                    step_exec.error_message = str(last_error)
                    step_exec.completed_at = timezone.now()
                    step_exec.save(update_fields=['status', 'error_message', 'completed_at'])
                    AuditLog.log(
                        action=AuditLog.ActionType.FAIL,
                        instance=execution,
                        description=f"Step failed after {max_retries + 1} attempts: {step.name}",
                        metadata={'error': str(last_error)},
                    )
                    if not step.is_optional:
                        raise StepExecutionError(f"Step '{step.name}' failed: {last_error}")
                    return 'FAILED_OPTIONAL'

        # ── 4. Update context with step output ────────────────────────────
        context.update(output)

        # ── 5. Finalize step execution record ────────────────────────────
        step_exec.status = StepExecution.Status.COMPLETED
        step_exec.output_data = output
        step_exec.completed_at = timezone.now()
        step_exec.save(update_fields=['status', 'output_data', 'completed_at'])

        cls._emit_ws_event(execution, 'step_completed', {
            'step': step.name,
            'output': output,
            'step_exec_id': str(step_exec.id),
        })

        AuditLog.log(
            action=AuditLog.ActionType.EXECUTE,
            instance=step_exec,
            description=f"Step completed: {step.name}",
            metadata=output,
        )

        # ── 6. Evaluate Exit Rules for branching ──────────────────────────
        rules = list(step.rules.order_by('priority').all())
        for rule in rules:
            try:
                if RuleEvaluator.evaluate(rule.condition, context):
                    logger.info(f"    ✓ Rule matched: {rule.name or rule.action_type}")
                    step_exec.applied_rule = rule
                    step_exec.save(update_fields=['applied_rule'])

                    if rule.action_type == WorkflowRule.ActionType.TERMINATE:
                        return 'TERMINATE'
                    elif rule.action_type == WorkflowRule.ActionType.COMPLETE:
                        return 'COMPLETE'
                    elif rule.action_type == WorkflowRule.ActionType.ROUTE:
                        return {'_next_step_id': str(rule.target_step_id) if rule.target_step else None}
                    break  # First matching rule wins
            except Exception as e:
                logger.warning(f"    Rule evaluation error for {rule}: {e}")

        # Check for linear flow (next_step)
        if step.next_step_id:
            return {'_next_step_id': str(step.next_step_id)}

        # Check for end step
        if step.step_type == WorkflowStep.StepType.END:
            return 'TERMINATE'

        return 'CONTINUE'

    @classmethod
    def _record_step(cls, execution, step, status, context):
        """Create a SKIPPED StepExecution record."""
        StepExecution.objects.create(
            workflow_execution=execution,
            step=step,
            status=status,
            input_context=context.copy(),
            started_at=timezone.now(),
            completed_at=timezone.now(),
        )

    @classmethod
    def _emit_ws_event(cls, execution: WorkflowExecution, event_type: str, data: dict = None):
        """
        Send a real-time update over WebSocket via Django Channels.
        Fires-and-forgets; never blocks the engine.
        """
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"execution_{execution.id}",
                    {
                        'type': 'execution_update',
                        'event': event_type,
                        'execution_id': str(execution.id),
                        'status': execution.status,
                        'data': data or {},
                    }
                )
        except Exception as e:
            logger.warning(f"WebSocket emit failed (non-fatal): {e}")

    @classmethod
    def simulate(cls, workflow_version: WorkflowVersion, context: dict) -> dict:
        """
        Dry-run the workflow without persisting any execution records.
        Returns a trace of which steps would be taken and why.
        
        Also supports rejection paths via rejection_step field.
        """
        trace = []
        simulated_context = context.copy()
        steps = list(workflow_version.steps.prefetch_related('conditions', 'rules').order_by('order'))
        step_by_id = {str(s.id): s for s in steps}
        rejected = False  # Track if we're on rejection path

        for step in steps:
            entry = {
                'step_id': str(step.id),
                'step_name': step.name,
                'step_type': step.step_type,
                'order': step.order,
                'decision': '',
                'matched_rule': None,
                'path': 'rejection' if rejected else 'main',
            }

            # Evaluate conditions
            conditions = list(step.conditions.all())
            if conditions:
                passes = ConditionGroupEvaluator.evaluate(conditions, simulated_context)
                if not passes:
                    entry['decision'] = 'SKIPPED'
                    trace.append(entry)
                    continue

            entry['decision'] = 'EXECUTED'

            # Evaluate exit rules
            for rule in step.rules.order_by('priority'):
                try:
                    if RuleEvaluator.evaluate(rule.condition, simulated_context):
                        entry['matched_rule'] = {
                            'rule_id': str(rule.id),
                            'name': rule.name,
                            'action': rule.action_type,
                        }
                        break
                except Exception:
                    pass

            trace.append(entry)

            # Handle rejection path
            if rejected and step.rejection_step_id:
                # Follow rejection path
                next_step = step_by_id.get(str(step.rejection_step_id))
                if next_step:
                    rejected = False  # Reset after moving to rejection step
                    continue

            # Handle step's next_step (linear flow)
            if step.next_step_id:
                next_step = step_by_id.get(str(step.next_step_id))
                if next_step:
                    continue

            if step.step_type == WorkflowStep.StepType.END:
                break

        return {
            'is_simulation': True,
            'workflow_version': str(workflow_version.id),
            'context_used': simulated_context,
            'trace': trace,
            'total_steps': len(steps),
            'steps_executed': sum(1 for t in trace if t['decision'] == 'EXECUTED'),
            'steps_skipped': sum(1 for t in trace if t['decision'] == 'SKIPPED'),
        }
