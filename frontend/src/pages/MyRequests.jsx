import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, ArrowRight, Search, Filter, Receipt, Calendar, UserPlus } from 'lucide-react';
import clsx from 'clsx';
import api from '../api';
import { useAuthStore } from '../store/authStore';

export default function MyRequests() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = () => {
        setLoading(true);
        api.get('/executions/')
            .then(res => {
                setRequests(res.results || []);
            })
            .catch(err => console.error('API Error:', err))
            .finally(() => setLoading(false));
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return <CheckCircle size={16} className="text-success" />;
            case 'failed':
                return <XCircle size={16} className="text-red-400" />;
            case 'running':
            case 'pending':
                return <Clock size={16} className="text-warning" />;
            case 'waiting':
                return <AlertCircle size={16} className="text-warning" />;
            case 'cancelled':
                return <XCircle size={16} className="text-textMuted" />;
            default:
                return <Clock size={16} className="text-textMuted" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'bg-success/10 text-success border-success/20';
            case 'failed':
                return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'running':
            case 'pending':
                return 'bg-warning/10 text-warning border-warning/20';
            case 'waiting':
                return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'cancelled':
                return 'bg-textMuted/10 text-textMuted border-textMuted/20';
            default:
                return 'bg-textMuted/10 text-textMuted border-textMuted/20';
        }
    };

    const getIconForWorkflow = (workflowName) => {
        if (!workflowName) return FileText;
        const name = workflowName.toLowerCase();
        if (name.includes('expense') || name.includes('reimbursement')) return Receipt;
        if (name.includes('leave') || name.includes('vacation') || name.includes('time off')) return Calendar;
        if (name.includes('onboard') || name.includes('joining')) return UserPlus;
        return FileText;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredRequests = requests.filter(req => {
        const matchesSearch = !searchTerm || 
            (req.workflow_version?.workflow?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (req.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-textMuted font-medium italic">Loading your requests...</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                            <FileText size={16} />
                        </div>
                        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Your Requests</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">My Requests</h1>
                    <p className="text-textMuted text-sm">View and track all your submitted requests.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="glass-panel px-4 py-2 flex items-center gap-2">
                        <FileText size={16} className="text-textMuted" />
                        <span className="text-sm text-white">{user?.full_name || user?.email}</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted" size={18} />
                    <input
                        type="text"
                        placeholder="Search requests..."
                        className="w-full bg-surface/50 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all backdrop-blur-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-12 px-4 bg-surface/50 border border-white/5 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="running">In Progress</option>
                    <option value="waiting">Awaiting Approval</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {/* Requests List */}
            <div className="space-y-4">
                {filteredRequests.length === 0 ? (
                    <div className="py-20 text-center glass-panel border-dashed border-white/10">
                        <FileText size={48} className="mx-auto mb-4 text-textMuted opacity-50" />
                        <p className="text-white font-medium">No requests found</p>
                        <p className="text-textMuted text-sm mt-1">
                            {searchTerm || statusFilter !== 'all' 
                                ? 'Try adjusting your search or filters' 
                                : 'Create your first request to get started'}
                        </p>
                    </div>
                ) : (
                    filteredRequests.map(request => {
                        const workflowName = request.workflow_version?.workflow?.name || 'Unknown Request';
                        const Icon = getIconForWorkflow(workflowName);
                        
                        return (
                            <div key={request.id} className="glass-panel p-6 border !border-white/5 hover:border-white/10 transition-all">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-xl bg-surface border border-white/10">
                                            <Icon size={20} className="text-primary" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={clsx(
                                                    "text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest border",
                                                    getStatusColor(request.status)
                                                )}>
                                                    {request.status}
                                                </span>
                                                <span className="text-xs text-textMuted">
                                                    {formatDate(request.created_at)}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold text-white">{workflowName}</h3>
                                            <p className="text-sm text-textMuted mt-1">
                                                Request ID: <span className="font-mono text-xs">{request.id?.slice(0, 8)}</span>
                                            </p>
                                            
                                            {request.context && Object.keys(request.context).length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {Object.entries(request.context).slice(0, 3).map(([key, value]) => (
                                                        <span key={key} className="text-xs bg-surface px-2 py-1 rounded text-textMuted">
                                                            {key}: {String(value).slice(0, 20)}{String(value).length > 20 ? '...' : ''}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(request.status)}
                                            <span className={clsx(
                                                "text-sm font-medium capitalize",
                                                request.status === 'completed' ? 'text-success' :
                                                request.status === 'failed' ? 'text-red-400' :
                                                request.status === 'waiting' ? 'text-warning' :
                                                'text-textMuted'
                                            )}>
                                                {request.status === 'waiting' ? 'Awaiting Approval' : request.status}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/monitor?execution=${request.id}`)}
                                            className="flex items-center gap-1 text-primary hover:underline text-sm"
                                        >
                                            View Details <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Timeline info */}
                                {(request.started_at || request.completed_at) && (
                                    <div className="mt-4 pt-4 border-t border-white/5 flex gap-6 text-xs text-textMuted">
                                        {request.started_at && (
                                            <div>
                                                <span className="uppercase tracking-wider">Started:</span>
                                                <span className="text-white ml-1">{formatDate(request.started_at)}</span>
                                            </div>
                                        )}
                                        {request.completed_at && (
                                            <div>
                                                <span className="uppercase tracking-wider">Completed:</span>
                                                <span className="text-white ml-1">{formatDate(request.completed_at)}</span>
                                            </div>
                                        )}
                                        {request.duration_seconds && (
                                            <div>
                                                <span className="uppercase tracking-wider">Duration:</span>
                                                <span className="text-white ml-1">{Math.round(request.duration_seconds)}s</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
