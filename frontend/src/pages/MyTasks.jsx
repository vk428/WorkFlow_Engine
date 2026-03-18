import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, Play, Check, X, FileText, ArrowRight, User } from 'lucide-react';
import clsx from 'clsx';
import api from '../api';
import { useAuthStore } from '../store/authStore';

export default function MyTasks() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState(null);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [approvalAction, setApprovalAction] = useState(null);
    const [comments, setComments] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = () => {
        setLoading(true);
        api.get('/approvals/my_tasks/')
            .then(res => {
                setTasks(res.data || []);
            })
            .catch(err => console.error('API Error:', err))
            .finally(() => setLoading(false));
    };

    const handleApprove = (task) => {
        setSelectedTask(task);
        setApprovalAction('approve');
        setShowApprovalModal(true);
    };

    const handleReject = (task) => {
        setSelectedTask(task);
        setApprovalAction('reject');
        setShowApprovalModal(true);
    };

    const handleCompleteTask = async (task) => {
        setProcessing(true);
        try {
            await api.post(`/executions/steps/${task.id}/complete/`, {});
            alert('Task completed successfully!');
            fetchTasks();
        } catch (err) {
            alert('Failed to complete task: ' + err);
        } finally {
            setProcessing(false);
        }
    };

    const submitApproval = async () => {
        setProcessing(true);
        try {
            if (approvalAction === 'approve') {
                await api.post(`/approvals/${selectedTask.id}/approve/`, { comments });
            } else {
                await api.post(`/approvals/${selectedTask.id}/reject/`, { reason: rejectReason });
            }
            setShowApprovalModal(false);
            setComments('');
            setRejectReason('');
            fetchTasks();
        } catch (err) {
            alert('Action failed: ' + err);
        } finally {
            setProcessing(false);
        }
    };

    const getTaskIcon = (type) => {
        if (type === 'approval') return <Clock size={18} className="text-warning" />;
        return <CheckCircle size={18} className="text-emerald-500" />;
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-textMuted font-medium italic">Loading your tasks...</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 rounded-lg bg-warning/10 border border-warning/20 text-warning">
                            <Clock size={16} />
                        </div>
                        <span className="text-[10px] font-bold text-warning uppercase tracking-[0.2em]">Action Required</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">My Tasks</h1>
                    <p className="text-textMuted text-sm">Pending approvals and tasks assigned to you.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="glass-panel px-4 py-2 flex items-center gap-2">
                        <User size={16} className="text-textMuted" />
                        <span className="text-sm text-white">{user?.full_name || user?.email}</span>
                    </div>
                </div>
            </div>

            {/* Tasks Grid */}
            <div className="space-y-4">
                {tasks.length === 0 ? (
                    <div className="py-20 text-center glass-panel border-dashed border-white/10">
                        <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
                        <p className="text-white font-medium">All caught up!</p>
                        <p className="text-textMuted text-sm mt-1">You have no pending tasks.</p>
                    </div>
                ) : (
                    tasks.map(task => (
                        <div key={task.id} className="glass-panel p-6 border !border-white/5 hover:border-white/10 transition-all">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-surface border border-white/10">
                                        {getTaskIcon(task.type)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={clsx(
                                                "text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest",
                                                task.type === 'approval'
                                                    ? 'bg-warning/10 text-warning border-warning/20'
                                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            )}>
                                                {task.type}
                                            </span>
                                            <span className="text-xs text-textMuted">
                                                {new Date(task.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-white">{task.title}</h3>
                                        <p className="text-sm text-textMuted mt-1">
                                            {task.description}
                                        </p>
                                        <div className="flex items-center gap-4 mt-3 text-xs text-textMuted">
                                            <span className="flex items-center gap-1">
                                                <FileText size={12} />
                                                {task.workflow_name}
                                            </span>
                                            <button
                                                onClick={() => navigate(`/monitor?execution=${task.execution_id}`)}
                                                className="flex items-center gap-1 text-primary hover:underline"
                                            >
                                                View Execution <ArrowRight size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    {task.type === 'approval' ? (
                                        <>
                                            <button
                                                onClick={() => handleApprove(task)}
                                                disabled={processing}
                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 rounded-lg text-sm font-medium transition-all border border-emerald-500/20"
                                            >
                                                <Check size={16} /> Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(task)}
                                                disabled={processing}
                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500 text-red-400 rounded-lg text-sm font-medium transition-all border border-red-500/20"
                                            >
                                                <X size={16} /> Reject
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => handleCompleteTask(task)}
                                            disabled={processing}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary text-primary rounded-lg text-sm font-medium transition-all border border-primary/20"
                                        >
                                            <Check size={16} /> Complete
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Context Display */}
                            {task.context && Object.keys(task.context).length > 0 && (
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <p className="text-xs text-textMuted mb-2 uppercase tracking-wider">Request Data</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(task.context).slice(0, 6).map(([key, value]) => (
                                            <div key={key} className="flex items-center gap-2 text-sm">
                                                <span className="text-textMuted">{key}:</span>
                                                <span className="text-white font-medium">{String(value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Approval Modal */}
            {showApprovalModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="glass-panel w-full max-w-md p-6 border !border-white/10">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {approvalAction === 'approve' ? 'Approve Request' : 'Reject Request'}
                        </h3>

                        <div className="mb-4 p-3 bg-surface rounded-lg border border-white/5">
                            <p className="text-sm text-textMuted">Task</p>
                            <p className="text-white font-medium">{selectedTask?.title}</p>
                            <p className="text-sm text-textMuted mt-2">Workflow</p>
                            <p className="text-white font-medium">{selectedTask?.workflow_name}</p>
                        </div>

                        {approvalAction === 'approve' ? (
                            <div className="mb-4">
                                <label className="block text-sm text-textMuted mb-2">Comments (optional)</label>
                                <textarea
                                    className="input-field min-h-[100px]"
                                    placeholder="Add any comments..."
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                />
                            </div>
                        ) : (
                            <div className="mb-4">
                                <label className="block text-sm text-textMuted mb-2">Rejection Reason *</label>
                                <textarea
                                    className="input-field min-h-[100px]"
                                    placeholder="Please provide a reason for rejection..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowApprovalModal(false)}
                                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitApproval}
                                disabled={processing || (approvalAction === 'reject' && !rejectReason)}
                                className={clsx(
                                    "flex-1 px-4 py-2 rounded-lg font-medium transition-all",
                                    approvalAction === 'approve'
                                        ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                                        : "bg-red-500 hover:bg-red-600 text-white"
                                )}
                            >
                                {processing ? 'Processing...' : approvalAction === 'approve' ? 'Approve' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
