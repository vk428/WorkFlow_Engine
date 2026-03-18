import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CheckCircle, Clock, Bell, Settings, Play, SquareTerminal, GitBranch, Timer } from 'lucide-react';
import clsx from 'clsx';

const ICONS = {
  task: CheckCircle,
  approval: Clock,
  notification: Bell,
  condition: GitBranch,
  delay: Timer,
  webhook: SquareTerminal,
  script: SquareTerminal,
  end: Play,
};

const COLORS = {
  task: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  approval: 'text-warning bg-warning/10 border-warning/30',
  notification: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  condition: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30',
  delay: 'text-slate-400 bg-slate-400/10 border-slate-400/30',
  webhook: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  script: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  end: 'text-red-400 bg-red-400/10 border-red-400/30',
};

export default memo(({ data, selected }) => {
  const isSelected = selected;
  const t = data.step_type || 'task';
  const Icon = ICONS[t] || Settings;
  const styleStr = COLORS[t] || COLORS.task;

  return (
    <div className={clsx(
      "relative min-w-[200px] rounded-xl border border-white/10 glass-panel shadow-2xl transition-all duration-200 overflow-hidden group",
      isSelected ? "ring-2 ring-primary/60 border-primary/50" : "hover:border-white/20 hover:shadow-primary/10"
    )}>
      {/* Node Drag Handle */}
      <div className={clsx("h-1.5 w-full bg-gradient-to-r via-slate-500",
        t === 'task' ? 'from-emerald-500' :
          t === 'approval' ? 'from-warning' :
            t === 'condition' ? 'from-indigo-500' :
              t === 'notification' ? 'from-purple-500' :
                t === 'webhook' ? 'from-sky-500' :
                  t === 'delay' ? 'from-slate-500' :
                    t === 'end' ? 'from-red-500' : 'from-slate-500'
      )}></div>

      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={clsx("p-1.5 rounded-lg border", styleStr)}>
            <Icon size={14} />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t}
          </div>
        </div>

        <div className="text-slate-100 font-medium text-sm leading-tight pr-4">
          {data.name || 'Unnamed Step'}
        </div>

        {data.assigned_role && (
          <div className="mt-2 text-xs text-slate-400 bg-surface/50 inline-block px-2 py-0.5 rounded border border-white/5">
            @ {data.assigned_role}
          </div>
        )}

        {/* Show if there's a next step or rejection step */}
        {(data.next_step_name || data.rejection_step_name) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.next_step_name && (
              <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                → {data.next_step_name}
              </span>
            )}
            {data.rejection_step_name && (
              <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                ↵ {data.rejection_step_name}
              </span>
            )}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-surface !border-2 !border-slate-500 hover:!border-primary !transition-colors" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-surface !border-2 !border-slate-500 hover:!border-primary !transition-colors" />
    </div>
  );
});
