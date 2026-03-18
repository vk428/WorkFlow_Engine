import React, { useState, useEffect } from 'react';
import {
  Activity, CheckCircle, Clock, AlertCircle,
  ArrowUpRight, ArrowDownRight, Layers, FileText,
  User, ListChecks, Zap, Send
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import clsx from 'clsx';
import api from '../api';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await api.get('/audit/stats/');
      setDashboardData(res);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-textMuted font-medium animate-pulse">Initializing Enterprise Data...</p>
    </div>
  );

  const isAdmin = user?.role === 'admin';
  const stats = dashboardData || {};

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
            Welcome, <span className="text-primary">{user?.full_name || 'User'}</span>
          </h1>
          <p className="text-textMuted text-lg">
            {isAdmin
              ? "Platform Overview & System Health Analytics"
              : "Ongoing Tasks & Personal Execution Metrics"}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="glass-panel px-4 py-2 flex items-center gap-3 border border-white/5 bg-white/5 shadow-inner">
            <div className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse"></div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Node-Alpha Active</span>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <AdminDashboardView stats={stats} />
      ) : (
        <UserDashboardView stats={stats} user={user} />
      )}
    </div>
  );
}

// --- ADMIN VIEW ---
function AdminDashboardView({ stats }) {
  return (
    <>
      {/* Admin Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Layers className="text-primary" size={24} />}
          label="Total Workflows"
          value={stats?.total_workflows || 0}
          trend="+12%"
          trendUp={true}
        />
        <StatCard
          icon={<Activity className="text-warning" size={24} />}
          label="Active Executions"
          value={stats?.active_executions || 0}
          trend="+5.4%"
          trendUp={true}
        />
        <StatCard
          icon={<CheckCircle className="text-success" size={24} />}
          label="Success Rate"
          value={`${stats?.success_rate || 100}%`}
          trend="+0.2%"
          trendUp={true}
        />
        <StatCard
          icon={<AlertCircle className="text-rose-400" size={24} />}
          label="System Approvals"
          value={stats?.pending_approvals || 0}
          trend="-2"
          trendUp={false}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Admin Trends Chart */}
        <div className="lg:col-span-2 glass-panel p-6 flex flex-col gap-6 border border-white/10 shadow-2xl relative overflow-hidden bg-surface/50">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-purple-500 opacity-40"></div>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Execution Trends</h3>
              <p className="text-xs text-textMuted mt-1">Platform activity over the last 7 days</p>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded-lg bg-white/5 text-[10px] font-bold text-slate-400 hover:text-white transition-all uppercase tracking-widest">Filters</button>
            </div>
          </div>

          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={35}>
                  {(stats?.trends || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 3 ? '#6366f1' : '#6366f133'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Activity (Audit Log) */}
        <div className="glass-panel p-6 border border-white/5 flex flex-col bg-surface/30">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white tracking-tight">System Logs</h3>
            <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">Live</span>
          </div>
          <div className="flex flex-col gap-5 flex-1 overflow-y-auto pr-2 scrollbar-thin">
            {stats?.recent_activity?.map((item) => (
              <ActivityItem
                key={item.id}
                icon={<Clock size={14} />}
                title={item.action}
                sub={item.user}
                time={item.time}
                status={item.status}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// --- USER VIEW ---
function UserDashboardView({ stats, user }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Quick Actions & Personal Stats */}
      <div className="lg:col-span-8 flex flex-col gap-8">
        {/* User Greeting Card */}
        <div className="glass-panel p-8 bg-gradient-to-br from-primary/20 via-surface to-surface border border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
          <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-2xl shadow-primary/20">
              <User size={40} strokeWidth={1.5} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-white mb-1">Hello, {user?.first_name}!</h2>
              <p className="text-textMuted max-w-md">You have <span className="text-warning font-bold">{stats?.pending_tasks || 0} tasks</span> awaiting your approval. Your current success rate is <span className="text-success font-bold">{stats?.success_rate}%</span>.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('openCreateRequest'))}
                className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/30 hover:scale-105 transition-transform active:scale-95 flex items-center gap-2"
              >
                <Send size={16} /> Create Request
              </button>
            </div>
          </div>
        </div>

        {/* Personal Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <SmallStatCard
            label="Pending Tasks"
            value={stats?.pending_tasks || 0}
            icon={<ListChecks className="text-warning" size={20} />}
            color="warning"
          />
          <SmallStatCard
            label="My Active Runs"
            value={stats?.active_executions || 0}
            icon={<Zap className="text-primary" size={20} />}
            color="primary"
          />
          <SmallStatCard
            label="Completed"
            value={stats?.completed_tasks || 0}
            icon={<CheckCircle className="text-success" size={20} />}
            color="success"
          />
        </div>

        {/* My Recent Activity */}
        <div className="glass-panel p-6 border border-white/5">
          <h3 className="text-lg font-bold text-white mb-6 tracking-tight">My Recent History</h3>
          <div className="space-y-4">
            {stats?.recent_activity?.length > 0 ? stats.recent_activity.map(log => (
              <div key={log.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-surface border border-white/10 flex items-center justify-center text-textMuted group-hover:text-white transition-colors">
                  <FileText size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{log.action}</p>
                  <p className="text-xs text-textMuted">{log.target}</p>
                </div>
                <span className="text-[10px] font-bold text-textMuted uppercase opacity-50">{log.time}</span>
              </div>
            )) : (
              <p className="text-center text-textMuted py-8 italic text-sm">No recent activity recorded.</p>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Execution Trends (Mini) or Tips */}
      <div className="lg:col-span-4 flex flex-col gap-8">
        <div className="glass-panel p-6 border border-white/5 bg-surface/50">
          <h3 className="text-md font-bold text-white mb-4">Personal Peak Activity</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.trends || [
                { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }
              ]}>
                <Area type="monotone" dataKey="value" stroke="#6366f1" fill="#6366f122" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-textMuted mt-4 text-center">Your execution trend over the past 7 days.</p>
        </div>

        <div className="glass-panel p-6 bg-primary/5 border border-primary/10">
          <h4 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
            <Zap size={14} /> Tip of the day
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            You can set up conditional notifications in your profile settings to receive alerts only for high-priority workflow failures.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- SHARED COMPONENTS ---

function StatCard({ icon, label, value, trend, trendUp }) {
  return (
    <div className="glass-panel p-6 border border-white/5 hover:border-white/20 transition-all group hover:-translate-y-1 bg-surface/40 overflow-hidden relative">
      <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
        {React.cloneElement(icon, { size: 100 })}
      </div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-3 rounded-2xl bg-surface border border-white/5 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all">
          {icon}
        </div>
        <div className={clsx(
          "flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider",
          trendUp ? "bg-success/10 text-success" : "bg-rose-500/10 text-rose-400"
        )}>
          {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trend}
        </div>
      </div>
      <p className="text-xs font-bold text-textMuted mb-1 uppercase tracking-[0.1em] relative z-10">{label}</p>
      <h4 className="text-3xl font-black text-white tracking-tighter relative z-10">{value}</h4>
    </div>
  );
}

function SmallStatCard({ label, value, icon, color }) {
  const colorMap = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    warning: 'text-warning bg-warning/10 border-warning/20',
    success: 'text-success bg-success/10 border-success/20',
  };
  return (
    <div className="glass-panel p-5 border border-white/5 flex flex-col gap-3">
      <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center border", colorMap[color])}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black text-white">{value}</p>
        <p className="text-[10px] font-bold text-textMuted uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function ActivityItem({ icon, title, sub, time, status }) {
  return (
    <div className="flex gap-4 group cursor-pointer relative py-1">
      <div className={clsx(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/5 transition-all",
        status === 'success' ? "bg-success/10 text-success group-hover:bg-success/20" : "bg-warning/10 text-warning group-hover:bg-warning/20"
      )}>
        {icon}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <p className="text-[13px] font-bold text-slate-100 truncate group-hover:text-primary transition-colors leading-tight">{title}</p>
          <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap ml-2 opacity-60 uppercase">{time}</span>
        </div>
        <p className="text-[11px] text-slate-400 truncate mt-0.5 opacity-80">{sub}</p>
      </div>
    </div>
  );
}
