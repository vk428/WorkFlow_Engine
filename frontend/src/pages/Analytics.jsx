import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    Activity, Users, CheckCircle, XCircle, Clock,
    TrendingUp, AlertCircle, Loader
} from 'lucide-react';
import { analyticsApi } from '../api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

function Analytics() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState(30);
    const [overview, setOverview] = useState(null);
    const [executionsData, setExecutionsData] = useState(null);
    const [approvalsData, setApprovalsData] = useState(null);
    const [usersData, setUsersData] = useState(null);
    const [workflowUsage, setWorkflowUsage] = useState(null);

    useEffect(() => {
        loadAnalytics();
    }, [timeRange]);

    const loadAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const [overviewRes, executionsRes, approvalsRes, usersRes, usageRes] = await Promise.all([
                analyticsApi.getOverview(timeRange),
                analyticsApi.getExecutions(timeRange),
                analyticsApi.getApprovals(timeRange),
                analyticsApi.getUsers(timeRange),
                analyticsApi.getWorkflowUsage(timeRange),
            ]);
            if (overviewRes) {
                setOverview(overviewRes);
                setExecutionsData(executionsRes || []);
                setApprovalsData(approvalsRes || []);
                setUsersData(usersRes || []);
                setWorkflowUsage(usageRes || []);
            }
        } catch (err) {
            setError(err.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-center gap-3 text-red-400">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    const StatCard = ({ title, value, subtitle, icon: Icon, color }) => (
        <div className="bg-surface border border-white/5 rounded-2xl p-5 hover:border-primary/20 transition-colors">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-textMuted text-sm">{title}</p>
                    <p className="text-3xl font-bold text-white mt-1">{value}</p>
                    {subtitle && <p className="text-textMuted text-xs mt-1">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon size={20} className="text-white" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
                    <p className="text-textMuted mt-1">Platform performance and usage metrics</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(Number(e.target.value))}
                        className="bg-surface border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Workflows"
                    value={overview?.workflows?.total || 0}
                    subtitle={`${overview?.workflows?.active || 0} active`}
                    icon={Activity}
                    color="bg-primary/20"
                />
                <StatCard
                    title="Total Executions"
                    value={overview?.executions?.total || 0}
                    subtitle={`${overview?.executions?.active || 0} active`}
                    icon={Clock}
                    color="bg-blue-500/20"
                />
                <StatCard
                    title="Success Rate"
                    value={`${overview?.metrics?.success_rate || 0}%`}
                    subtitle={`${overview?.executions?.completed || 0} completed`}
                    icon={TrendingUp}
                    color="bg-green-500/20"
                />
                <StatCard
                    title="Pending Approvals"
                    value={overview?.approvals?.pending || 0}
                    subtitle={`${overview?.approvals?.total || 0} total`}
                    icon={CheckCircle}
                    color="bg-yellow-500/20"
                />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Execution Trends */}
                <div className="bg-surface border border-white/5 rounded-2xl p-5">
                    <h3 className="text-lg font-semibold text-white mb-4">Execution Trends</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={executionsData?.chart_data || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9ca3af"
                                    fontSize={12}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                />
                                <YAxis stroke="#9ca3af" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                    labelStyle={{ color: '#fff' }}
                                />
                                <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} name="Total" />
                                <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" />
                                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} name="Failed" />
                                <Legend />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Approval Rate Chart */}
                <div className="bg-surface border border-white/5 rounded-2xl p-5">
                    <h3 className="text-lg font-semibold text-white mb-4">Approval Rate</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={approvalsData?.chart_data?.slice(-14) || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9ca3af"
                                    fontSize={12}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                />
                                <YAxis stroke="#9ca3af" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                    labelStyle={{ color: '#fff' }}
                                />
                                <Bar dataKey="approved" fill="#10b981" name="Approved" />
                                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
                                <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
                                <Legend />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Workflow Usage */}
                <div className="bg-surface border border-white/5 rounded-2xl p-5">
                    <h3 className="text-lg font-semibold text-white mb-4">Top Workflows</h3>
                    <div className="space-y-3">
                        {workflowUsage?.workflow_usage?.slice(0, 5).map((workflow, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="text-white text-sm font-medium truncate max-w-[150px]">
                                            {workflow.workflow_version__workflow__name}
                                        </p>
                                        <p className="text-textMuted text-xs">
                                            {workflow.execution_count} executions
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-green-400 text-sm">{workflow.completed_count}</p>
                                    <p className="text-red-400 text-xs">{workflow.failed_count}</p>
                                </div>
                            </div>
                        )) || (
                                <p className="text-textMuted text-sm">No workflow data available</p>
                            )}
                    </div>
                </div>

                {/* User Distribution */}
                <div className="bg-surface border border-white/5 rounded-2xl p-5">
                    <h3 className="text-lg font-semibold text-white mb-4">User Roles</h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={usersData?.role_distribution || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={70}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="count"
                                    nameKey="role"
                                    label={({ name, count }) => `${name}: ${count}`}
                                >
                                    {(usersData?.role_distribution || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-surface border border-white/5 rounded-2xl p-5">
                    <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-textMuted text-sm">Avg. Execution Time</span>
                            <span className="text-white font-semibold">
                                {overview?.metrics?.average_execution_time
                                    ? `${Math.round(overview.metrics.average_execution_time)}s`
                                    : 'N/A'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-textMuted text-sm">Failed Executions</span>
                            <span className="text-red-400 font-semibold">
                                {overview?.executions?.failed || 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-textMuted text-sm">Active Users</span>
                            <span className="text-white font-semibold">
                                {usersData?.active_users || 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-textMuted text-sm">New Users ({timeRange}d)</span>
                            <span className="text-green-400 font-semibold">
                                +{usersData?.new_users || 0}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Analytics;
