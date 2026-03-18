"""
Workflow Domain Models
======================
Schema:

  Workflow (master definition, multi-version)
    └─ WorkflowVersion (snapshot per publish)
         └─ WorkflowStep (ordered steps within a version)
              ├─ WorkflowCondition (entry conditions for a step)
              └─ WorkflowRule (exit rules / branching after step)
"""
from django.db import models
from django.conf import settings
from apps.core.models import SoftDeleteModel


class Workflow(SoftDeleteModel):
    """
    Top-level workflow definition.
    A workflow is a reusable template that can have multiple versions.
    Only one version can be 'active' at a time.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    tags = models.JSONField(default=list, blank=True)
    icon = models.CharField(max_length=50, default='workflow', blank=True)
    color = models.CharField(max_length=7, default='#6366f1', blank=True)

    # The currently active (published) version
    active_version = models.ForeignKey(
        'WorkflowVersion',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='active_for_workflow',
    )

    class Meta:
        db_table = 'workflows'
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return f"{self.name} [{self.status}]"


class WorkflowVersion(SoftDeleteModel):
    """
    Immutable snapshot of a workflow at a point in time.
    Each publish creates a new version. Versions are never edited, only added.
    """
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    version_number = models.PositiveIntegerField(default=1)
    changelog = models.TextField(blank=True, help_text='What changed in this version?')
    is_active = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='published_versions',
    )

    # Snapshot of the entire workflow config at publish time
    snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text='Full serialized workflow state at time of publish.',
    )

    class Meta:
        db_table = 'workflow_versions'
        unique_together = [('workflow', 'version_number')]
        ordering = ['-version_number']

    def __str__(self):
        return f"{self.workflow.name} v{self.version_number}"


class WorkflowStep(SoftDeleteModel):
    """
    A single step within a workflow version.
    Steps execute in order (order field), but can be conditionally skipped.
    """

    class StepType(models.TextChoices):
        TASK = 'task', 'Task'
        APPROVAL = 'approval', 'Approval'
        NOTIFICATION = 'notification', 'Notification'
        CONDITION = 'condition', 'Condition Gateway'
        DELAY = 'delay', 'Delay / Timer'
        WEBHOOK = 'webhook', 'Webhook / API Call'
        SCRIPT = 'script', 'Script / Automation'
        END = 'end', 'End'

    # Role constants
    ROLE_ADMIN = 'admin'
    ROLE_USER = 'user'
    ROLE_MANAGER = 'manager'
    ROLE_HR = 'hr'
    ROLE_CEO = 'ceo'
    ROLE_FINANCE = 'finance'

    ROLE_CHOICES = [
        (ROLE_ADMIN, 'Admin'),
        (ROLE_USER, 'User'),
        (ROLE_MANAGER, 'Manager'),
        (ROLE_HR, 'HR'),
        (ROLE_CEO, 'CEO'),
        (ROLE_FINANCE, 'Finance'),
    ]

    workflow_version = models.ForeignKey(
        WorkflowVersion,
        on_delete=models.CASCADE,
        related_name='steps',
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    step_type = models.CharField(
        max_length=20,
        choices=StepType.choices,
        default=StepType.TASK,
        db_index=True,
    )
    order = models.PositiveIntegerField(default=0, db_index=True)

    # Visual canvas position (for the frontend drag-and-drop builder)
    position_x = models.FloatField(default=0)
    position_y = models.FloatField(default=0)

    # Simple linear flow: next step on success
    next_step = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='previous_steps',
        help_text='Next step in linear flow (for simple workflows)'
    )

    # Rejection path: where to go when approval/condition fails
    rejection_step = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='rejected_from_steps',
        help_text='Step to go to when rejected (for approval steps)'
    )

    # Who is this step assigned to?
    assigned_role = models.CharField(max_length=50, blank=True, choices=ROLE_CHOICES)
    assigned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_steps',
    )

    # Step metadata — varies by step_type
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            'Type-specific config. Examples:\n'
            '  task: {form_schema: {...}}\n'
            '  webhook: {url, method, headers, body_template}\n'
            '  delay: {duration_seconds: 3600}\n'
            '  approval: {approval_mode: "any_one|all"}'
        ),
    )

    # Retry settings
    max_retries = models.PositiveSmallIntegerField(default=0)
    retry_delay_seconds = models.PositiveIntegerField(default=60)
    timeout_seconds = models.PositiveIntegerField(
        default=300,
        help_text='Auto-fail if step takes longer than this.',
    )
    is_optional = models.BooleanField(default=False)

    class Meta:
        db_table = 'workflow_steps'
        ordering = ['order']
        indexes = [
            models.Index(fields=['workflow_version', 'order']),
            models.Index(fields=['step_type']),
        ]

    def __str__(self):
        return f"[{self.step_type.upper()}] {self.name} (order={self.order})"


class WorkflowCondition(SoftDeleteModel):
    """
    Entry conditions for a step.
    ALL conditions in a group must pass (AND logic) for the step to execute.
    Multiple groups are evaluated with OR logic.
    """

    class Operator(models.TextChoices):
        EQ = 'eq', 'Equals'
        NEQ = 'neq', 'Not Equals'
        GT = 'gt', 'Greater Than'
        GTE = 'gte', 'Greater Than or Equal'
        LT = 'lt', 'Less Than'
        LTE = 'lte', 'Less Than or Equal'
        IN = 'in', 'In List'
        NOT_IN = 'not_in', 'Not In List'
        CONTAINS = 'contains', 'Contains'
        NOT_CONTAINS = 'not_contains', 'Not Contains'
        STARTS_WITH = 'starts_with', 'Starts With'
        ENDS_WITH = 'ends_with', 'Ends With'
        REGEX = 'regex', 'Matches Regex'
        IS_NULL = 'is_null', 'Is Null'
        IS_NOT_NULL = 'is_not_null', 'Is Not Null'

    step = models.ForeignKey(
        WorkflowStep,
        on_delete=models.CASCADE,
        related_name='conditions',
    )
    group = models.PositiveSmallIntegerField(
        default=0,
        help_text='Conditions in the same group are ANDed. Groups are ORed.',
    )
    field = models.CharField(
        max_length=255,
        help_text='Dot-notation path into execution context. E.g. "expense_amount"',
    )
    operator = models.CharField(max_length=20, choices=Operator.choices)
    value = models.JSONField(
        help_text='The comparison value. Can be a scalar or list.',
    )
    negate = models.BooleanField(
        default=False,
        help_text='If true, inverses the evaluation result.',
    )

    class Meta:
        db_table = 'workflow_conditions'
        ordering = ['group', 'id']

    def __str__(self):
        neg = 'NOT ' if self.negate else ''
        return f"[G{self.group}] {neg}{self.field} {self.operator} {self.value}"


class WorkflowRule(SoftDeleteModel):
    """
    Exit rules evaluated AFTER a step completes.
    Used for branching / conditional routing to the next step.
    Rules are evaluated in priority order; first match wins.
    """

    class ActionType(models.TextChoices):
        ROUTE = 'route', 'Route to Step'
        SKIP = 'skip', 'Skip Steps'
        TERMINATE = 'terminate', 'Terminate Workflow'
        COMPLETE = 'complete', 'Complete Workflow'
        LOOP = 'loop', 'Loop Back'

    step = models.ForeignKey(
        WorkflowStep,
        on_delete=models.CASCADE,
        related_name='rules',
    )
    name = models.CharField(max_length=100, blank=True)
    priority = models.PositiveSmallIntegerField(default=0)

    # JSON DSL for the condition (same fields/operators as WorkflowCondition)
    condition = models.JSONField(
        default=dict,
        help_text=(
            'JSON-DSL condition. Example:\n'
            '{"operator": "AND", "conditions": [\n'
            '  {"field": "expense_amount", "op": "gt", "value": 10000}\n'
            ']}'
        ),
    )

    action_type = models.CharField(
        max_length=20,
        choices=ActionType.choices,
        default=ActionType.ROUTE,
    )
    target_step = models.ForeignKey(
        WorkflowStep,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='incoming_rules',
    )
    action_config = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional action data, e.g. {"message": "Rejected"}',
    )

    class Meta:
        db_table = 'workflow_rules'
        ordering = ['priority']

    def __str__(self):
        return f"Rule[{self.priority}] → {self.action_type} @ {self.step.name}"
