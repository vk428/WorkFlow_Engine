import React, { useState, useEffect } from 'react';
import { 
  BellRing, Archive, RefreshCw, Mail, 
  AlertCircle, CheckCircle, Info, Inbox,
  MoreVertical, CheckSquare
} from 'lucide-react';
import api from '../api';
import clsx from 'clsx';

export default function Notifications() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    try {
      const res = await api.get('/notifications/');
      setNotifs(res.results || (Array.isArray(res) ? res : []));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark_all_read/', {});
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      alert('Failed to synchronize mailbox state.');
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/mark_read/`, {});
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-textMuted font-bold text-xs uppercase tracking-widest">Accessing Secure Inbox...</p>
    </div>
  );

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <div className="max-w-4xl flex flex-col gap-6 w-full mx-auto pb-10">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <div className="p-1 px-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
                <Inbox size={12} className="text-primary" />
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{unreadCount} Critical Alerts</span>
             </div>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">System Notifications</h1>
          <p className="text-textMuted text-sm">Communication stream for automated engine events and governance alerts.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchNotifs} className="p-2.5 bg-white/5 hover:bg-white/10 text-textMuted hover:text-white rounded-xl border border-white/5 transition-all">
             <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <button 
             onClick={handleMarkAllRead} 
             disabled={unreadCount === 0}
             className="flex items-center gap-2 px-6 py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl border border-primary/20 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
             <CheckSquare size={16} /> Mark All Read
          </button>
        </div>
      </div>

      {/* Inbox Container */}
      <div className="glass-panel overflow-hidden border-white/5 bg-surface/30 shadow-2xl">
        <div className="divide-y divide-white/5">
          {notifs.length === 0 ? (
             <div className="py-24 text-center flex flex-col items-center gap-4 bg-black/20">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-500">
                   <Mail size={32} strokeWidth={1} />
                </div>
                <p className="text-textMuted font-medium italic text-sm">Your communication stream is currently empty.</p>
             </div>
          ) : notifs.map((n) => (
            <div 
              key={n.id} 
              onClick={() => !n.is_read && handleMarkRead(n.id)}
              className={clsx(
                "p-5 flex items-start gap-5 transition-all cursor-pointer group hover:bg-white/[0.04]",
                !n.is_read ? 'bg-primary/5 relative' : 'bg-transparent opacity-80'
              )}
            >
               {/* Unread Indicator Vertical Bar */}
               {!n.is_read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}

               <div className="relative shrink-0 mt-1">
                 <div className={clsx(
                   "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                   !n.is_read ? 'bg-primary/20 border-primary/30 text-primary shadow-lg shadow-primary/10' : 'bg-surface border-white/5 text-slate-500'
                 )}>
                   {getIcon(n.type, n.is_read)}
                 </div>
               </div>

               <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-start gap-4">
                    <h4 className={clsx(
                      "text-[15px] tracking-tight transition-colors",
                      !n.is_read ? 'text-white font-bold' : 'text-slate-400 font-semibold'
                    )}>
                      {n.title}
                    </h4>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter whitespace-nowrap mt-1">
                       {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                 </div>
                 <p className="text-sm text-textMuted mt-1 leading-relaxed line-clamp-2 group-hover:text-slate-300 transition-colors">
                    {n.message}
                 </p>
               </div>

               <div className="shrink-0 self-center md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 hover:bg-white/10 text-slate-500 hover:text-white rounded-lg transition-colors">
                     <MoreVertical size={16} />
                  </button>
               </div>
            </div>
          ))}
        </div>
      </div>
      
      {notifs.length > 0 && (
         <p className="text-center text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mt-4">End of Stream</p>
      )}
    </div>
  );
}

function getIcon(type, is_read) {
   const colorClass = !is_read ? 'text-inherit' : 'text-slate-500';
   switch (type) {
      case 'error': return <AlertCircle size={18} className={colorClass} />;
      case 'success': return <CheckCircle size={18} className={colorClass} />;
      case 'info': return <Info size={18} className={colorClass} />;
      default: return <BellRing size={18} className={colorClass} />;
   }
}
