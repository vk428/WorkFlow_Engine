import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, BackgroundVariant,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Play, Save, CheckCircle, Layers, Settings2, Plus, ArrowLeft,
  AlertTriangle, Check, X, GitBranch, Clock, Bell, Terminal,
  Send, Flag, ChevronDown, Trash2
} from 'lucide-react';
import clsx from 'clsx';
import StepNode from '../components/StepNode';
import api from '../api';

const nodeTypes = {
  customStep: StepNode,
};

// Step type configurations
const STEP_TYPES = [
  { value: 'task', label: 'Task', icon: CheckCircle, color: 'emerald', description: 'Basic automation step' },
  { value: 'approval', label: 'Approval', icon: Clock, color: 'warning', description: 'Requires human approval' },
  { value: 'condition', label: 'Condition', icon: GitBranch, color: 'indigo', description: 'Branch based on rules' },
  { value: 'notification', label: 'Notification', icon: Bell, color: 'purple', description: 'Send notifications' },
  { value: 'webhook', label: 'Webhook', icon: Terminal, color: 'sky', description: 'External API call' },
  { value: 'delay', label: 'Delay', icon: Clock, color: 'slate', description: 'Wait for duration' },
  { value: 'end', label: 'End', icon: Flag, color: 'danger', description: 'Workflow end point' },
];

// Role options
const ROLES = [
  { value: '', label: 'Select Role...' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'ceo', label: 'CEO' },
  { value: 'finance', label: 'Finance' },
];

// Condition operators
const OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not Equals' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less or Equal' },
  { value: 'in', label: 'In List' },
  { value: 'contains', label: 'Contains' },
];

// Rule action types
const RULE_ACTIONS = [
  { value: 'route', label: 'Route to Step' },
  { value: 'complete', label: 'Complete Workflow' },
  { value: 'terminate', label: 'Terminate Workflow' },
];

export default function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [workflow, setWorkflow] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validating, setValidating] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // Condition builder state
  const [conditions, setConditions] = useState([]);
  const [newCondition, setNewCondition] = useState({ field: '', operator: 'eq', value: '' });

  useEffect(() => {
    if (id === 'new') {
      setLoading(false);
      return;
    }

    api.get(`/workflows/${id}/`).then(data => {
      setWorkflow(data);
      const version = data.active_version_detail || data.versions?.[0];
      if (version && version.steps) {
        const initialNodes = version.steps.map(step => ({
          id: String(step.id),
          type: 'customStep',
          position: { x: step.position_x || 250, y: step.position_y || 100 },
          data: { ...step }
        }));

        const initialEdges = [];
        version.steps.forEach(step => {
          // From rules
          if (step.rules) {
            step.rules.forEach(rule => {
              if (rule.target_step) {
                initialEdges.push({
                  id: `e${step.id}-${rule.target_step}`,
                  source: String(step.id),
                  target: String(rule.target_step),
                  label: rule.name || rule.action_type,
                  type: 'smoothstep',
                  markerEnd: { type: MarkerType.ArrowClosed },
                  style: { stroke: '#6366f1', strokeWidth: 2 }
                });
              }
            });
          }
          // From next_step (linear flow)
          if (step.next_step) {
            const exists = initialEdges.find(e => e.source === String(step.id) && e.target === String(step.next_step));
            if (!exists) {
              initialEdges.push({
                id: `e${step.id}-next-${step.next_step}`,
                source: String(step.id),
                target: String(step.next_step),
                label: 'Next',
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: '#22c55e', strokeWidth: 2, strokeDasharray: '5,5' }
              });
            }
          }
        });

        setNodes(initialNodes);
        setEdges(initialEdges);
      }
    }).catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id, setNodes, setEdges]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({
    ...params,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#6366f1', strokeWidth: 2 }
  }, eds)), [setEdges]);

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
    setPanelOpen(true);
    // Load conditions
    if (node.data.conditions && node.data.conditions.length > 0) {
      setConditions(node.data.conditions);
    } else {
      setConditions([]);
    }
    setNewCondition({ field: '', operator: 'eq', value: '' });
  };

  const handleSave = async () => {
    try {
      // Save metadata first
      await api.patch(`/workflows/${id}/`, {
        name: workflow.name,
        category: workflow.category,
        description: workflow.description
      });
      // Then save canvas
      await api.post(`/workflows/${id}/update_canvas/`, { nodes, edges });
      alert('Workflow saved successfully!');
    } catch (err) {
      alert('Save failed: ' + err);
    }
  };

  const handlePublish = async () => {
    try {
      // Validate first
      const validation = await api.get(`/workflows/${id}/validate/`);
      if (!validation.success && validation.error_count > 0) {
        setValidationErrors(validation.errors);
        setShowValidation(true);
        if (!confirm(`Workflow has ${validation.error_count} error(s). Publish anyway?`)) {
          return;
        }
      }
      await api.post(`/workflows/${id}/publish/`, { changelog: 'Updated via Builder' });
      alert('Published!');
      navigate('/workflows');
    } catch (err) {
      alert('Publish failed: ' + err);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const result = await api.get(`/workflows/${id}/validate/`);
      setValidationErrors(result.errors || []);
      setShowValidation(true);
    } catch (err) {
      alert('Validation failed: ' + err);
    } finally {
      setValidating(false);
    }
  };

  const handleAddStep = async (type) => {
    let currentId = id;

    if (currentId === 'new') {
      try {
        const wf = await api.post('/workflows/', {
          name: 'Untitled Workflow',
          category: 'General',
          description: 'New workflow created via builder.'
        });
        currentId = wf.id;
        setWorkflow(wf);
        window.history.replaceState(null, '', `/workflows/build/${wf.id}`);
        navigate(`/workflows/build/${wf.id}`, { replace: true });
      } catch (err) {
        alert('Failed to initialize workflow: ' + err);
        return;
      }
    }

    try {
      const res = await api.post(`/workflows/${currentId}/steps/`, {
        name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        step_type: type,
        config: {},
        position_x: 250,
        position_y: 250
      });

      const newNode = {
        id: String(res.id),
        type: 'customStep',
        position: { x: res.position_x, y: res.position_y },
        data: { ...res }
      };

      setNodes(nds => nds.concat(newNode));
    } catch (err) {
      alert('Failed to add step: ' + err);
    }
  };

  const updateNodeData = (key, value) => {
    const updatedData = { ...selectedNode.data, [key]: value };
    setSelectedNode(prev => ({ ...prev, data: updatedData }));
    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: updatedData } : n));
  };

  const addCondition = () => {
    if (!newCondition.field || !newCondition.value) return;
    const condition = {
      ...newCondition,
      value: isNaN(newCondition.value) ? newCondition.value : Number(newCondition.value),
      group: 0,
      negate: false
    };
    setConditions([...conditions, condition]);
    setNewCondition({ field: '', operator: 'eq', value: '' });
  };

  const removeCondition = (index) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const saveStepConfig = async () => {
    try {
      await api.patch(`/workflows/${id}/steps/${selectedNode.id}/`, {
        ...selectedNode.data,
        conditions
      });
      setPanelOpen(false);
      alert('Step configuration saved.');
    } catch (err) {
      alert('Config save failed: ' + err);
    }
  };

  if (loading) return <div className="p-10 text-white">Loading Workflow...</div>;

  return (
    <div className="h-full flex flex-col w-full relative -m-6" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Builder Toolbar */}
      <div className="absolute top-4 left-6 right-6 z-10 glass-panel h-16 px-6 flex items-center justify-between border !border-white/10 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/workflows')} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <input
                type="text"
                className="bg-transparent border-none text-xl font-bold text-white p-0 focus:ring-0 w-64"
                value={workflow?.name || ''}
                placeholder="Workflow Name"
                onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
              />
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-warning/20 text-warning border border-warning/30">
                {workflow?.status || 'Draft'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                className="bg-transparent border-none text-xs text-slate-400 p-0 focus:ring-0 w-32"
                value={workflow?.category || ''}
                placeholder="Category"
                onChange={(e) => setWorkflow(prev => ({ ...prev, category: e.target.value }))}
              />
              <span className="text-slate-600">•</span>
              <p className="text-xs text-slate-500">Version: {workflow?.active_version_detail?.version_number || 1}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleValidate}
            className="btn-secondary text-sm !border-white/10 flex items-center gap-2"
            disabled={validating}
          >
            <AlertTriangle size={16} />
            {validating ? 'Validating...' : 'Validate'}
          </button>
          <button onClick={handleSave} className="btn-secondary text-sm !border-white/10"><Save size={16} /> Save</button>
          <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
          <button onClick={handlePublish} className="btn-success text-sm !py-1.5"><CheckCircle size={16} /> Publish</button>
          <button className="btn-primary text-sm shadow-primary/40" onClick={() => api.post(`/workflows/${id}/execute/`).then(() => navigate('/monitor'))}><Play size={16} fill="currentColor" /> Execute</button>
        </div>
      </div>

      {/* Floating Action Menu for Steps */}
      <div className="absolute left-6 top-24 z-10 glass-panel p-2 flex flex-col gap-2">
        {STEP_TYPES.slice(0, 4).map(type => {
          const Icon = type.icon;
          return (
            <button
              key={type.value}
              onClick={() => handleAddStep(type.value)}
              className="w-10 h-10 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors group"
              title={type.label}
            >
              <Icon size={20} className={`group-hover:text-${type.color}-400 transition-colors`} />
            </button>
          );
        })}
      </div>

      {/* ReactFlow Canvas */}
      <div className="flex-1 w-full bg-[#0B1120]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-transparent"
        >
          <Background color="#1e293b" gap={24} size={2} variant={BackgroundVariant.Dots} />
          <Controls className="!bg-[#1e293b] !border-white/10 !fill-white" />
          <MiniMap className="!bg-[#0f172a] !border !border-white/5 !rounded-lg overflow-hidden" maskColor="rgba(15, 23, 42, 0.8)" nodeColor="#6366f1" />
        </ReactFlow>
      </div>

      {/* Validation Panel */}
      {showValidation && (
        <div className="absolute bottom-4 left-6 right-6 z-10 glass-panel p-4 max-h-48 overflow-y-auto border !border-white/10">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-white">Validation Results</h4>
            <button onClick={() => setShowValidation(false)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          {validationErrors.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <Check size={16} />
              <span className="text-sm">Workflow is valid!</span>
            </div>
          ) : (
            <div className="space-y-2">
              {validationErrors.map((err, idx) => (
                <div key={idx} className={clsx(
                  "flex items-start gap-2 text-sm p-2 rounded",
                  err.severity === 'error' ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"
                )}>
                  {err.severity === 'error' ? <AlertTriangle size={14} className="mt-0.5" /> : <Check size={14} className="mt-0.5" />}
                  <span>{err.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Side Settings Panel */}
      <div className={clsx(
        "absolute right-0 top-0 bottom-0 w-[420px] glass-panel border-r-0 border-y-0 !rounded-none transition-transform duration-300 z-20 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)]",
        panelOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-surface/50">
          <h3 className="font-semibold text-white truncate pr-2">{selectedNode?.data?.name || 'Step Config'}</h3>
          <button onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-white pb-1 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Step Type */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-400">Step Type</label>
            <div className="grid grid-cols-4 gap-2">
              {STEP_TYPES.map(type => {
                const Icon = type.icon;
                const isSelected = selectedNode?.data?.step_type === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() => updateNodeData('step_type', type.value)}
                    className={clsx(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                      isSelected
                        ? `border-${type.color}-500 bg-${type.color}-500/10`
                        : "border-white/10 hover:border-white/30"
                    )}
                  >
                    <Icon size={18} className={isSelected ? `text-${type.color}-400` : "text-slate-400"} />
                    <span className="text-[10px] text-slate-400">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-400">Step Name</label>
            <input
              type="text"
              className="input-field"
              value={selectedNode?.data?.name || ''}
              onChange={(e) => updateNodeData('name', e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-400">Description</label>
            <textarea
              className="input-field min-h-[60px]"
              value={selectedNode?.data?.description || ''}
              onChange={(e) => updateNodeData('description', e.target.value)}
            />
          </div>

          {/* Role Assignment (for approval steps) */}
          {selectedNode?.data?.step_type === 'approval' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-400">Assigned Role</label>
              <select
                className="input-field cursor-pointer"
                value={selectedNode?.data?.assigned_role || ''}
                onChange={(e) => updateNodeData('assigned_role', e.target.value)}
              >
                {ROLES.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Linear Flow - Next Step */}
          {selectedNode?.data?.step_type !== 'end' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-400">Next Step (Linear Flow)</label>
              <select
                className="input-field cursor-pointer"
                value={selectedNode?.data?.next_step || ''}
                onChange={(e) => updateNodeData('next_step', e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">None (use rules or order)</option>
                {nodes.filter(n => n.id !== selectedNode?.id).map(n => (
                  <option key={n.id} value={n.id}>{n.data.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Rejection Path (for approval steps) */}
          {selectedNode?.data?.step_type === 'approval' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-400">On Rejection Go To</label>
              <select
                className="input-field cursor-pointer"
                value={selectedNode?.data?.rejection_step || ''}
                onChange={(e) => updateNodeData('rejection_step', e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">None (end workflow)</option>
                {nodes.filter(n => n.id !== selectedNode?.id).map(n => (
                  <option key={n.id} value={n.id}>{n.data.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Condition Builder (for condition steps) */}
          {selectedNode?.data?.step_type === 'condition' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-400">Conditions</label>

              {/* Existing conditions */}
              {conditions.map((cond, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-surface/50 p-2 rounded border border-white/10">
                  <span className="text-sm text-slate-300 flex-1">
                    {cond.field} {cond.operator} {cond.value}
                  </span>
                  <button onClick={() => removeCondition(idx)} className="text-red-400 hover:text-red-300">
                    <X size={14} />
                  </button>
                </div>
              ))}

              {/* Add new condition */}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field !py-1.5 flex-1"
                  placeholder="Field name"
                  value={newCondition.field}
                  onChange={(e) => setNewCondition({ ...newCondition, field: e.target.value })}
                />
                <select
                  className="input-field !py-1.5 w-24"
                  value={newCondition.operator}
                  onChange={(e) => setNewCondition({ ...newCondition, operator: e.target.value })}
                >
                  {OPERATORS.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="input-field !py-1.5 w-20"
                  placeholder="Value"
                  value={newCondition.value}
                  onChange={(e) => setNewCondition({ ...newCondition, value: e.target.value })}
                />
                <button onClick={addCondition} className="btn-primary !py-1.5 px-3">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Advanced Config */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <h4 className="text-sm font-medium text-slate-200">Advanced Config</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Max Retries</label>
                <input
                  type="number"
                  className="input-field !py-1.5"
                  defaultValue={selectedNode?.data?.max_retries || 0}
                  onChange={(e) => updateNodeData('max_retries', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Timeout (s)</label>
                <input
                  type="number"
                  className="input-field !py-1.5"
                  defaultValue={selectedNode?.data?.timeout_seconds || 300}
                  onChange={(e) => updateNodeData('timeout_seconds', parseInt(e.target.value))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="optional"
                checked={selectedNode?.data?.is_optional || false}
                onChange={(e) => updateNodeData('is_optional', e.target.checked)}
                className="rounded bg-surface border-white/10"
              />
              <label htmlFor="optional" className="text-sm text-slate-400">Optional step (don't fail workflow on error)</label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex gap-3 bg-surface/80">
          <button className="btn-secondary flex-1" onClick={() => setPanelOpen(false)}>Cancel</button>
          {selectedNode && (
            <button
              className="btn-danger flex-1 flex items-center justify-center gap-1"
              onClick={async () => {
                if (confirm(`Are you sure you want to delete "${selectedNode.data.name}"?`)) {
                  try {
                    await api.delete(`/workflows/${id}/steps/${selectedNode.id}/`);
                    setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
                    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
                    setPanelOpen(false);
                  } catch (err) {
                    alert('Delete failed: ' + err);
                  }
                }
              }}
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
          <button className="btn-primary flex-1" onClick={saveStepConfig}>Save Config</button>
        </div>
      </div>
    </div>
  );
}
