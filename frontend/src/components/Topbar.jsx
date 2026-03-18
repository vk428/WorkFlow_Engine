import { useAuthStore } from '../store/authStore';
import { Bell, Search, LogOut } from 'lucide-react';

function Topbar() {
  const { user, logout } = useAuthStore();

  return (
    <header className="h-16 w-full glass-panel !rounded-none !border-x-0 !border-t-0 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="relative w-64">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search executions..." 
          className="input-field pl-10 h-9 bg-slate-900/50 border-white/5 text-sm"
        />
      </div>

      <div className="flex items-center gap-5">
        <button className="relative p-2 text-slate-300 hover:text-white transition-colors">
          <Bell size={18} className="animate-pulse-slow" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger animate-pulse"></span>
        </button>

        <div className="h-8 w-[1px] bg-white/10 mx-2"></div>

        <div className="flex items-center gap-3 group px-2 py-1 rounded-lg hover:bg-white/5 transition-colors">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">{user?.full_name || 'Admin User'}</p>
            <p className="text-[10px] text-textMuted uppercase tracking-wider font-bold opacity-70 leading-none mt-1">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
          <div className="relative">
            <img 
                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.full_name || 'Admin'}&background=6366f1&color=fff`} 
                alt="avatar" 
                className="w-10 h-10 rounded-full ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all object-cover"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-[#0F172A]"></div>
          </div>
          
          <button 
            onClick={() => logout()}
            className="ml-2 p-2 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-all"
            title="Log Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
