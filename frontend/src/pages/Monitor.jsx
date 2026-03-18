import React, { useState, useEffect } from 'react';
import {
  PlayCircle, Clock, AlertTriangle, CheckCircle,
  Search, RefreshCw, Activity, ShieldAlert,
  Terminal, History, ExternalLink, Zap
} from 'lucide-react';
import clsx from 'clsx';
import api from '../api';
import { useAuthStore } from '../store/authStore';

export default function Monitor() {
  const { user } = useAuthStore();
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const isAdmin = user?.role === 'admin';

  const fetchExecutions = async () => {
    try {
      const endpoint = isAdmin ? '/executions/all/' : '/executions/my/';
      const res = await api.get(endpoint);
      setExecutions(res?.results || res || []);
    } catch (err) {
      console.error('Failed to fetch executions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
    const interval = setInterval(fetchExecutions, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredExecutions = executions.filter(ex =>
    ex.workflow_name?.toLowerCase().includes(search.toLowerCase()) ||
    ex.id?.toString().includes(search)
  );

  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'running': return <PlayCircle className="text-primary animate-pulse w-5 h-5 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />;
      case 'waiting': return <Clock className="text-warning w-5 h-5" />;
      case 'completed': return <CheckCircle className="text-success w-5 h-5" />;
      case 'failed': return <AlertTriangle className="text-danger w-5 h-5" />;
      default: return <Clock className="text-slate-400 w-5 h-5" />;
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-warning/10 border border-warning/20 text-warning">
              <ShieldAlert size={16} />
            </div>
            <span className="text-[10px] font-bold text-warning uppercase tracking-[0.2em]">Real-time Oversight</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">System Monitor</h1>
          <p className="text-textMuted text-sm">Orchestration engine status and live execution telemetry.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchExecutions} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-sm font-bold transition-all">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Forced Sync
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Global Pool" value={executions.length} icon={<Terminal size={14} />} color="slate" />
        <SummaryCard label="Executing" value={executions.filter(e => e.status === 'running').length} icon={<Zap size={14} />} color="primary" glow />
        <SummaryCard label="Critical Wait" value={executions.filter(e => e.status === 'waiting' || e.status === 'pending_approval').length} icon={<Clock size={14} />} color="warning" />
        <SummaryCard label="Fatal Errors" value={executions.filter(e => e.status === 'failed').length} icon={<AlertTriangle size={14} />} color="danger" />
      </div>

      {/* Main Table Container */}
      <div className="glass-panel overflow-hidden border-white/5 shadow-2xl bg-surface/30">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex flex-col md:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted" />
            <input
              type="text"
              placeholder="Search by Trace ID or Workflow Name..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-2 pl-12 pr-4 text-sm text-white placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select className="bg-white/5 border border-white/10 text-textMuted rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wider focus:outline-none focus:text-white transition-colors">
              <option>All Pipelines</option>
              <option>Failed Only</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.01] text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 whitespace-nowrap">
                <th className="px-6 py-4">Status & Trace ID</th>
                <th className="px-6 py-4">Orchestration Name</th>
                <th className="px-6 py-4">Active Stage</th>
                <th className="px-6 py-4">Pipeline Load</th>
                <th className="px-6 py-4">Telemetry Time</th>
                <th className="px-6 py-4 text-right">Initiator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredExecutions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-textMuted italic font-medium">No active execution threads detected...</td>
                </tr>
              ) : filteredExecutions.map(ex => (
                <tr key={ex.id} className="hover:bg-white/[0.03] transition-colors cursor-pointer group whitespace-nowrap">
                  <td className="px-6 py-5 flex items-center gap-4">
                    <StatusIcon status={ex.status} />
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-white group-hover:text-primary transition-colors font-mono tracking-tighter uppercase">{String(ex.id).split('-')[0]}</span>
                      <span className="text-[9px] text-textMuted font-bold uppercase opacity-50">Instance UUID</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-bold text-white group-hover:underline underline-offset-4 decoration-primary/50">{ex.workflow_name || 'Legacy Workflow'}</p>
                    <p className="text-[10px] text-textMuted mt-0.5">V{ex.version_number || '1.0'}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
                      <span className="text-xs font-semibold text-slate-300 truncate max-w-[150px]">{ex.current_step || 'Finalizing'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-2 w-32">
                      <div className="flex justify-between items-center text-[10px] font-black group-hover:text-white transition-colors">
                        <span className="uppercase text-textMuted">Progress</span>
                        <span>{ex.progress_percent || 0}%</span>
                      </div>
                      <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden relative border border-white/[0.02]">
                        <div className={clsx(
                          "absolute top-0 bottom-0 left-0 transition-all duration-1000 ease-out",
                          ex.status === 'failed' ? 'bg-danger shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
                            ex.status === 'completed' ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
                              'bg-primary shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                        )} style={{ width: `${ex.progress_percent || 0}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-xs text-textMuted font-medium italic">
                    {new Date(ex.created_at).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="flex flex-col text-right">
                        <span className="text-xs font-bold text-slate-300">{ex.triggered_by_detail?.full_name || 'Core Engine'}</span>
                        <span className="text-[9px] text-textMuted uppercase tracking-wider">{ex.triggered_by_detail?.role || 'SYSTEM'}</span>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-surface border border-white/10 flex items-center justify-center text-[10px] font-black text-primary">
                        {ex.triggered_by_detail?.full_name?.charAt(0) || 'S'}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, glow }) {
  const colorMap = {
    slate: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
    primary: 'text-primary bg-primary/10 border-primary/20',
    warning: 'text-warning bg-warning/10 border-warning/20',
    danger: 'text-danger bg-danger/10 border-danger/20',
  };
  return (
    <div className={clsx(
      "glass-panel px-4 py-3 flex flex-col gap-1 border transition-all",
      colorMap[color],
      glow && "shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]"
    )}>
      <div className="flex items-center gap-2 opacity-60">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-2xl font-black text-white tracking-tighter">{value}</span>
    </div>
  );
}
