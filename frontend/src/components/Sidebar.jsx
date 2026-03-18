import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard,
  GitMerge,
  Activity,
  CheckSquare,
  Bell,
  Settings,
  Users,
  BarChart3,
  FileText,
  ShieldAlert,
  User as UserIcon,
  LogOut,
  Plus,
  Clock,
  Send,
  FilePlus
} from 'lucide-react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function Sidebar({ onCreateRequest }) {
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const adminTabs = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Workflows', icon: GitMerge, path: '/workflows' },
    { label: 'Users', icon: Users, path: '/users' },
    { label: 'Analytics', icon: BarChart3, path: '/analytics' },
    { label: 'Reports', icon: FileText, path: '/reports' },
    { label: 'System Monitor', icon: ShieldAlert, path: '/system-monitor' },
    { label: 'Approvals', icon: CheckSquare, path: '/approvals' },
    { label: 'My Tasks', icon: Clock, path: '/my-tasks' },
    { label: 'Notifications', icon: Bell, path: '/notifications' },
  ];

  const userTabs = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Create Request', icon: Send, path: '/create-request', action: 'create-request' },
    { label: 'My Requests', icon: FilePlus, path: '/my-requests' },
    { label: 'My Tasks', icon: Clock, path: '/my-tasks' },
    { label: 'Notifications', icon: Bell, path: '/notifications' },
    { label: 'Profile', icon: UserIcon, path: '/profile' },
  ];

  const [recentWorkflows, setRecentWorkflows] = React.useState([]);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAdmin) {
      api.get('/workflows/?ordering=-updated_at&page_size=3')
        .then(res => setRecentWorkflows(res.results || []))
        .catch(err => console.error('Sidebar fetch error:', err));
    }
  }, [isAdmin]);

  const tabs = isAdmin ? adminTabs : userTabs;

  return (
    <div className="w-64 h-full bg-surface border-r border-white/5 flex flex-col py-6 shrink-0 transition-all duration-300 relative z-20 overflow-y-auto scrollbar-hide">
      {/* Brand Header */}
      <div className="flex items-center gap-3 w-full mb-8 px-6">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-white/10">
          <GitMerge size={20} className="text-white relative left-0.5" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-bold text-white tracking-tight leading-none">
            HalleyX
          </span>
          <span className="text-[10px] text-primary font-semibold uppercase tracking-widest mt-1 opacity-80">
            {isAdmin ? 'Admin Console' : 'User Portal'}
          </span>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="px-4 space-y-6">
        <div>
          <p className="px-3 text-[10px] font-bold text-textMuted uppercase tracking-[0.2em] mb-4 opacity-50">
            Main Navigation
          </p>
          <nav className="flex flex-col gap-1">
            {tabs.map((tab) => (
              tab.action === 'create-request' ? (
                <button
                  key={tab.path}
                  onClick={() => window.dispatchEvent(new CustomEvent('openCreateRequest'))}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 font-medium group text-[13.5px]',
                    'text-textMuted hover:bg-white/5 hover:text-white border border-transparent'
                  )}
                >
                  <tab.icon size={18} className="text-white/60 group-hover:text-white transition-transform group-hover:scale-110" />
                  <span className="flex-1">{tab.label}</span>
                </button>
              ) : (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 font-medium group text-[13.5px]',
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm shadow-primary/5'
                      : 'text-textMuted hover:bg-white/5 hover:text-white border border-transparent'
                  )}
                >
                  <tab.icon size={18} className={clsx("transition-transform group-hover:scale-110", isAdmin ? "text-primary/70 group-hover:text-primary" : "text-white/60 group-hover:text-white")} />
                  <span className="flex-1">{tab.label}</span>
                  {tab.label === 'Workflows' && isAdmin && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/workflows/build/new');
                      }}
                      className="p-1 hover:bg-primary/20 rounded-md text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Create New Workflow"
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  )}
                </NavLink>
              )
            ))}
          </nav>
        </div>

        {isAdmin && recentWorkflows.length > 0 && (
          <div>
            <p className="px-3 text-[10px] font-bold text-textMuted uppercase tracking-[0.2em] mb-4 opacity-50">
              Recent Blueprints
            </p>
            <nav className="flex flex-col gap-1">
              {recentWorkflows.map((wf) => (
                <NavLink
                  key={wf.id}
                  to={`/workflows/build/${wf.id}`}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-xl text-textMuted hover:bg-white/5 hover:text-white transition-all text-[12px] group"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors"></div>
                  <span className="truncate">{wf.name}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        )}

        {isAdmin && (
          <div>
            <p className="px-3 text-[10px] font-bold text-textMuted uppercase tracking-[0.2em] mb-4 opacity-50">
              Management
            </p>
            <nav className="flex flex-col gap-1">
              <NavLink
                to="/settings"
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 font-medium group text-[13.5px]',
                  isActive ? 'bg-white/10 text-white' : 'text-textMuted hover:bg-white/5 hover:text-white'
                )}
              >
                <Settings size={18} className="text-white/60" />
                Settings
              </NavLink>
            </nav>
          </div>
        )}
      </div>

      {/* Bottom Profile / Logout */}
      <div className="mt-auto px-4 pt-4 border-t border-white/5">
        <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3 mb-2">
          <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">{user?.full_name}</p>
            <p className="text-[10px] text-textMuted truncate capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 hover:bg-red-500/20 text-textMuted hover:text-red-400 rounded-lg transition-colors"
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
