import React, { useState, useEffect, useCallback } from 'react';
import {
    Download, Filter, FileText, RefreshCw, Loader,
    ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { reportsApi } from '../api';

const TABS = [
    { id: 'executions', label: 'Executions' },
    { id: 'workflows', label: 'Workflows' },
    { id: 'approvals', label: 'Approvals' },
];

function Reports() {
    const [activeTab, setActiveTab] = useState('executions');
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [data, setData] = useState({ results: [], count: 0 });
    const [filters, setFilters] = useState({});
    const [filterOptions, setFilterOptions] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 50 });

    useEffect(() => {
        loadFilters();
    }, []);

    useEffect(() => {
        loadData();
    }, [activeTab, pagination.page, filters]);

    const loadFilters = async () => {
        try {
            const res = await reportsApi.getFilters();
            if (res) {
               setFilterOptions(res);
            }
        } catch (err) {
            console.error('Failed to load filters:', err);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const params = {
                ...filters,
                page: pagination.page,
                page_size: pagination.pageSize,
            };

            let res;
            switch (activeTab) {
                case 'executions':
                    res = await reportsApi.getExecutions(params);
                    break;
                case 'workflows':
                    res = await reportsApi.getWorkflows(params);
                    break;
                case 'approvals':
                    res = await reportsApi.getApprovals(params);
                    break;
                default:
                    res = { results: [], count: 0 };
            }
            if (res) {
                setData(res); // Changed from res.data to res
                setError(null);
            }
        } catch (err) {
            console.error('Failed to load data:', err);
            setError(err); // Set error state on failure
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format = 'csv') => {
        setExporting(true);
        try {
            let response;
            const filename = `${activeTab}_report_${new Date().toISOString().split('T')[0]}`;

            switch (activeTab) {
                case 'executions':
                    response = await reportsApi.exportExecutionsCSV(filters);
                    break;
                case 'workflows':
                    response = await reportsApi.exportWorkflowsCSV(filters);
                    break;
                case 'approvals':
                    response = await reportsApi.exportApprovalsCSV(filters);
                    break;
            }

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${filename}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setExporting(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const clearFilters = () => {
        setFilters({});
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const getStatusBadge = (status) => {
        const styles = {
            completed: 'bg-green-500/20 text-green-400',
            failed: 'bg-red-500/20 text-red-400',
            running: 'bg-blue-500/20 text-blue-400',
            pending: 'bg-yellow-500/20 text-yellow-400',
            approved: 'bg-green-500/20 text-green-400',
            rejected: 'bg-red-500/20 text-red-400',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>
                {status}
            </span>
        );
    };

    const columns = {
        executions: [
            { key: 'workflow_name', label: 'Workflow' },
            { key: 'status', label: 'Status' },
            { key: 'triggered_by', label: 'Triggered By' },
            { key: 'duration_seconds', label: 'Duration (s)' },
            { key: 'created_at', label: 'Created' },
        ],
        workflows: [
            { key: 'name', label: 'Name' },
            { key: 'category', label: 'Category' },
            { key: 'status', label: 'Status' },
            { key: 'execution_count', label: 'Executions' },
            { key: 'created_at', label: 'Created' },
        ],
        approvals: [
            { key: 'step_name', label: 'Step' },
            { key: 'workflow_name', label: 'Workflow' },
            { key: 'status', label: 'Status' },
            { key: 'assigned_to', label: 'Assigned To' },
            { key: 'created_at', label: 'Created' },
        ],
    };

    const formatValue = (key, value) => {
        if (key === 'status') return getStatusBadge(value);
        if (key === 'created_at' && value) {
            return new Date(value).toLocaleString();
        }
        if (key === 'duration_seconds' && value !== null) {
            return `${value}s`;
        }
        return value || '-';
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Enterprise Reports</h1>
                    <p className="text-textMuted mt-1">Generate and export system activity reports</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleExport('csv')}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {exporting ? <Loader className="w-4 h-4 animate-spin" /> : <Download size={18} />}
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-2">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                                ? 'bg-primary text-white'
                                : 'text-textMuted hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-surface border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={18} className="text-textMuted" />
                    <span className="text-white font-medium">Filters</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {activeTab === 'executions' && (
                        <>
                            <input
                                type="date"
                                placeholder="Start Date"
                                value={filters.start_date || ''}
                                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            />
                            <input
                                type="date"
                                placeholder="End Date"
                                value={filters.end_date || ''}
                                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            />
                            <select
                                value={filters.workflow_id || ''}
                                onChange={(e) => handleFilterChange('workflow_id', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            >
                                <option value="">All Workflows</option>
                                {filterOptions?.workflows?.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                            <select
                                value={filters.status || ''}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            >
                                <option value="">All Statuses</option>
                                {filterOptions?.execution_statuses?.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </>
                    )}
                    {activeTab === 'approvals' && (
                        <>
                            <input
                                type="date"
                                placeholder="Start Date"
                                value={filters.start_date || ''}
                                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            />
                            <input
                                type="date"
                                placeholder="End Date"
                                value={filters.end_date || ''}
                                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            />
                            <select
                                value={filters.status || ''}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            >
                                <option value="">All Statuses</option>
                                {filterOptions?.approval_statuses?.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <select
                                value={filters.user_id || ''}
                                onChange={(e) => handleFilterChange('user_id', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            >
                                <option value="">All Users</option>
                                {filterOptions?.users?.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </>
                    )}
                    {activeTab === 'workflows' && (
                        <>
                            <select
                                value={filters.category || ''}
                                onChange={(e) => handleFilterChange('category', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            >
                                <option value="">All Categories</option>
                                {filterOptions?.categories?.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <select
                                value={filters.status || ''}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            >
                                <option value="">All Statuses</option>
                                {filterOptions?.workflow_statuses?.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </>
                    )}
                </div>
                {Object.keys(filters).length > 0 && (
                    <button
                        onClick={clearFilters}
                        className="mt-4 text-sm text-red-400 hover:text-red-300"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    {columns[activeTab].map(col => (
                                        <th
                                            key={col.key}
                                            className="px-6 py-4 text-left text-xs font-semibold text-textMuted uppercase tracking-wider"
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {data.results?.length > 0 ? (
                                    data.results.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                            {columns[activeTab].map(col => (
                                                <td key={col.key} className="px-6 py-4 text-sm text-white">
                                                    {formatValue(col.key, row[col.key])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={columns[activeTab].length} className="px-6 py-8 text-center text-textMuted">
                                            No data found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {data.count > 0 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
                                <p className="text-textMuted text-sm">
                                    Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                                    {Math.min(pagination.page * pagination.pageSize, data.count)} of {data.count} results
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                        disabled={pagination.page === 1}
                                        className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft size={18} className="text-white" />
                                    </button>
                                    <span className="text-white text-sm">Page {pagination.page}</span>
                                    <button
                                        onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                        disabled={pagination.page * pagination.pageSize >= data.count}
                                        className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight size={18} className="text-white" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default Reports;
