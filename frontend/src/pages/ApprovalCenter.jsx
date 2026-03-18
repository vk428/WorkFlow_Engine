import React, { useState, useEffect } from 'react';
import {
  AlertCircle, CheckCircle, XCircle, RefreshCw,
  ListChecks, ArrowRight, User, Calendar,
  MessageSquare, History, Info
} from 'lucide-react';
import clsx from 'clsx';
import api from '../api';

export default function ApprovalCenter() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/approvals/pending/');
      // Handle unwrapped response from the interceptor
      const approvalData = res?.results || res || [];
      setApprovals(Array.isArray(approvalData) ? approvalData : []);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleAction = async (id, action) => {
    try {
      if (action === 'approve') {
        const comments = prompt('Any comments for this approval? (Optional):') || 'Approved via Governance Portal';
        await api.post(`/approvals/${id}/approve/`, { comments });
      } else {
        const reason = prompt('CRITICAL: Please provide a rejection reason for the audit trail:');
        if (!reason) return;
        await api.post(`/approvals/${id}/reject/`, { reason });
      }
      fetchApprovals();
    } catch (e) {
      alert('Action Authorization Failed: ' + e);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
      <div className="w-10 h-10 border-4 border-warning border-t-transparent rounded-full animate-spin"></div>
      <p className="text-textMuted font-medium italic">Scanning Governance Queue...</p>
    </div>
  );

  return (
    <div className="max-w-5xl flex flex-col gap-8 w-full mx-auto pb-10">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-warning/10 border border-warning/20 text-warning">
              <ListChecks size={16} />
            </div>
            <span className="text-[10px] font-bold text-warning uppercase tracking-[0.2em]">Manual Governance</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Task Approvals</h1>
          <p className="text-textMuted text-sm">Action pending authorizations assigned to your personnel profile.</p>
        </div>
        <button onClick={fetchApprovals} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-bold transition-all uppercase tracking-widest">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Sync Queue
        </button>
      </div>

      {approvals.length === 0 ? (
        <div className="text-center py-24 glass-panel border-dashed border-white/10 bg-surface/20 flex flex-col items-center">
          <div className="w-16 h-16 rounded-3xl bg-success/10 border border-success/20 flex items-center justify-center text-success mb-6 shadow-2xl shadow-success/10">
            <CheckCircle size={32} strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Queue Fully Optimized</h3>
          <p className="text-textMuted text-sm max-w-xs mx-auto">No pending authorization requests were found. You are completely up to date with your governance duties.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {approvals.map(app => (
            <div key={app.id} className="glass-panel group relative overflow-hidden flex flex-col md:flex-row border-white/5 hover:border-white/20 transition-all bg-surface/30">
              {/* Visual Status Marker */}
              <div className="absolute top-0 left-0 w-1 h-full bg-warning"></div>

              {/* Main Content Area */}
              <div className="p-6 flex-1 flex flex-col gap-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning shadow-lg">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white leading-tight group-hover:text-warning transition-colors">{app.step_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{app.workflow_name || 'System Workflow'}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider flex items-center gap-1">
                          <Calendar size={10} /> {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-[10px] font-black text-warning uppercase tracking-widest bg-warning/10 px-2 py-0.5 rounded border border-warning/20">Awaiting Decision</span>
                    <span className="text-[9px] text-textMuted mt-1 uppercase font-bold tracking-tighter italic">Priority: Medium</span>
                  </div>
                </div>

                {/* Data Snapshot Grid */}
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Info size={12} className="text-slate-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Execution Context Snapshot</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(app.context_snapshot || {}).length > 0 ? Object.entries(app.context_snapshot).map(([k, v]) => (
                      <div key={k} className="flex flex-col">
                        <p className="text-[9px] text-textMuted uppercase font-black truncate">{k}</p>
                        <p className="text-xs font-mono text-slate-200 truncate mt-0.5">{String(v)}</p>
                      </div>
                    )) : (
                      <p className="col-span-full text-[10px] text-slate-600 italic">No supplemental context provided for this stage.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Action Sidebar */}
              <div className="p-6 bg-black/40 md:w-64 flex flex-col gap-3 justify-center border-l border-white/5">
                <button
                  onClick={() => handleAction(app.id, 'approve')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-success/20 hover:bg-success text-success hover:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all border border-success/30"
                >
                  <CheckCircle size={14} /> Authorize Stage
                </button>
                <button
                  onClick={() => handleAction(app.id, 'reject')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all border border-rose-500/20"
                >
                  <XCircle size={14} /> Flag & Reject
                </button>
                <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                  <button className="text-[9px] font-black text-slate-500 hover:text-primary transition-colors uppercase tracking-tighter flex items-center gap-1.5 justify-center">
                    <History size={10} /> View Pipeline History
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
