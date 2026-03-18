import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, MoreVertical, Edit2, Archive, Copy, GitMerge, Search, Filter, Activity, Layers } from 'lucide-react';
import clsx from 'clsx';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import ExecuteWorkflowModal from '../components/ExecuteWorkflowModal';

export default function WorkflowList() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = () => {
    setLoading(true);
    api.get('/workflows/')
      .then(res => {
        setWorkflows(res.results || []);
      })
      .catch(err => console.error('API Error:', err))
      .finally(() => setLoading(false));
  };

  const handleExecuteClick = (workflow) => {
    if (!workflow.can_execute) {
      alert('This workflow cannot be executed. Make sure it is published and has steps.');
      return;
    }
    setSelectedWorkflow(workflow);
    setShowExecuteModal(true);
  };

  const handleExecuteSuccess = (execution) => {
    setShowExecuteModal(false);
    setSelectedWorkflow(null);
    navigate('/monitor');
  };

  const filteredWorkflows = workflows.filter(wf =>
    (wf.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (wf.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-textMuted font-medium italic">Scanning Workflow Repository...</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <GitMerge size={16} />
            </div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{isAdmin ? 'Enterprise Assets' : 'My Portal'}</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            {isAdmin ? 'Workflow Management' : 'Request Types'}
          </h1>
          <p className="text-textMuted text-sm">
            {isAdmin
              ? 'Deploy, manage, and execute automation blueprints across the organization.'
              : 'Browse available request types and submit new requests.'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => navigate('/workflows/build/new')}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus size={18} strokeWidth={3} /> New Configuration
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted" size={18} />
          <input
            type="text"
            placeholder="Search blueprints by name or category..."
            className="w-full bg-surface/50 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all backdrop-blur-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="h-12 px-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 flex items-center gap-2 transition-all">
          <Filter size={18} /> <span className="text-xs font-bold uppercase tracking-wider">Sort</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWorkflows.map(wf => (
          <div key={wf.id} className="glass-panel group relative overflow-hidden flex flex-col transition-all hover:-translate-y-1.5 border-white/5 hover:border-white/20 hover:shadow-2xl hover:shadow-black/60 bg-surface/40">
            {/* Visual Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full bg-primary/10 group-hover:bg-primary/20 transition-all -translate-y-1/2 translate-x-1/2"></div>

            <div className="p-6 flex-1 relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 rounded-2xl bg-surface border border-white/10 text-primary group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-500">
                  <GitMerge size={22} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    "text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest",
                    wf.status === 'published' ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                  )}>
                    {wf.status}
                  </span>
                  <button className="text-textMuted hover:text-white transition-colors p-1"><MoreVertical size={18} /></button>
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 tracking-tight group-hover:text-primary transition-colors">{wf.name}</h3>
              <p className="text-xs leading-relaxed text-textMuted mb-6 line-clamp-2">{wf.description || 'Enterprise grade automation blueprint for complex task orchestration.'}</p>

              <div className="flex items-center gap-4 text-[10px] font-bold text-textMuted uppercase tracking-widest mt-auto opacity-70">
                <span className="flex items-center gap-1.5"><Layers size={12} /> {wf.step_count || 0} Steps</span>
                <span className="flex items-center gap-1.5"><Activity size={12} /> Live</span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex gap-3 relative z-10 transition-colors group-hover:bg-black/40">
              {isAdmin ? (
                <>
                  <button
                    onClick={() => navigate(`/workflows/build/${wf.id}`)}
                    className="flex-1 flex justify-center items-center gap-2 text-[11px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl transition-all border border-white/10"
                  >
                    <Edit2 size={14} /> Configure
                  </button>
                  <button
                    onClick={() => handleExecuteClick(wf)}
                    disabled={!wf.can_execute}
                    className="flex-1 flex justify-center items-center gap-2 text-[11px] font-black uppercase tracking-wider bg-primary/20 hover:bg-primary hover:text-white text-primary py-2.5 rounded-xl transition-all border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play size={14} fill="currentColor" /> Execute
                  </button>
                </>
              ) : (
                <div className="flex-1 text-center text-xs text-textMuted py-2.5">
                  Use "Create Request" to submit
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredWorkflows.length === 0 && (
        <div className="py-20 text-center glass-panel border-dashed border-white/10">
          <p className="text-textMuted italic">No deployment blueprints match your current criteria.</p>
        </div>
      )}

      {/* Execute Workflow Modal */}
      {showExecuteModal && selectedWorkflow && (
        <ExecuteWorkflowModal
          workflow={selectedWorkflow}
          onClose={() => {
            setShowExecuteModal(false);
            setSelectedWorkflow(null);
          }}
          onSuccess={handleExecuteSuccess}
        />
      )}
    </div>
  );
}
