import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { User, Mail, Shield, Building2, Bell, Lock, LogOut, Save, Edit2, Loader2 } from 'lucide-react';
import api from '../api';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

export default function Profile() {
  const { user, logout, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    department: '',
    notification_preferences: {
      email: true,
      in_app: true,
      failures: true
    }
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await api.get('/auth/profile/');
      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        department: data.department || '',
        notification_preferences: data.notification_preferences || {
          email: true,
          in_app: true,
          failures: true
        }
      });
      // Sync store if backend has more up-to-date info
      updateUser({ ...user, ...data });
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      // Fallback to store data if API fails
      if (user) {
        setFormData({
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          department: user.department || '',
          notification_preferences: user.notification_preferences || {
            email: true,
            in_app: true,
            failures: true
          }
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updatedData = await api.put('/auth/profile/', formData);
      updateUser({ ...user, ...updatedData });
      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Failed to update profile:', err);
      toast.error(typeof err === 'string' ? err : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (key) => {
    setFormData(prev => ({
      ...prev,
      notification_preferences: {
        ...prev.notification_preferences,
        [key]: !prev.notification_preferences[key]
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-textMuted font-medium animate-pulse">Loading secure profile...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Account Profile</h1>
          <p className="text-textMuted">Manage your personal identity and platform preferences.</p>
        </div>
        <div className="flex gap-3">
          {!editing ? (
            <button 
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white hover:bg-white/10 rounded-xl font-bold text-xs transition-all border border-white/10"
            >
              <Edit2 size={16} /> Edit Profile
            </button>
          ) : (
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary/80 rounded-xl font-bold text-xs transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
              Save Changes
            </button>
          )}
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl font-bold text-xs transition-all border border-rose-500/20"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Info Card */}
        <div className="md:col-span-1 flex flex-col gap-6">
           <div className="glass-panel p-8 text-center flex flex-col items-center border-white/5 bg-surface/30">
              <div className="w-24 h-24 rounded-3xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-black text-3xl mb-4 shadow-2xl shadow-primary/20 mb-6">
                 {user?.full_name?.charAt(0) || 'U'}
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{user?.full_name}</h2>
              <p className="text-sm text-textMuted mb-6">{user?.email}</p>
              
              <div className="flex flex-col w-full gap-2">
                 <div className="flex justify-between items-center px-4 py-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] font-bold text-textMuted uppercase tracking-widest">Role</span>
                    <span className="text-xs font-black text-primary uppercase">{user?.role}</span>
                 </div>
                 <div className="flex flex-col gap-1 text-left px-4 py-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] font-bold text-textMuted uppercase tracking-widest">Department</span>
                    {editing ? (
                      <input 
                        type="text" 
                        value={formData.department}
                        onChange={(e) => setFormData({...formData, department: e.target.value})}
                        className="bg-transparent text-white text-xs font-bold outline-none border-b border-primary/30 py-0.5"
                      />
                    ) : (
                      <span className="text-xs font-bold text-white truncate">{formData.department || 'Not Set'}</span>
                    )}
                 </div>
              </div>
           </div>
        </div>

        {/* Detailed Settings */}
        <div className="md:col-span-2 flex flex-col gap-8">
           <div className="glass-panel p-8 border-white/5 bg-surface/20">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                 <User size={20} className="text-primary" /> Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-textMuted uppercase tracking-widest">First Name</label>
                    <input 
                      type="text" 
                      disabled={!editing}
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-60 transition-all"
                    />
                 </div>
                 <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-textMuted uppercase tracking-widest">Last Name</label>
                    <input 
                      type="text" 
                      disabled={!editing}
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-60 transition-all"
                    />
                 </div>
              </div>
           </div>

           <div className="glass-panel p-8 border-white/5 bg-surface/20">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                 <Bell size={20} className="text-primary" /> Notification Preferences
              </h3>
              <div className="space-y-4">
                 <PreferenceToggle 
                    label="Email Notifications" 
                    description="Receive daily summaries and critical alerts via email." 
                    checked={formData.notification_preferences.email} 
                    onChange={() => togglePreference('email')}
                    disabled={!editing}
                 />
                 <PreferenceToggle 
                    label="In-App Toast Alerts" 
                    description="Real-time notifications for task assignments and status changes." 
                    checked={formData.notification_preferences.in_app} 
                    onChange={() => togglePreference('in_app')}
                    disabled={!editing}
                 />
                 <PreferenceToggle 
                    label="Execution Failures" 
                    description="Get notified immediately if a workflow you started fails." 
                    checked={formData.notification_preferences.failures} 
                    onChange={() => togglePreference('failures')}
                    disabled={!editing}
                 />
              </div>
           </div>

           <div className="glass-panel p-8 border-white/5 bg-surface/20">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                 <Lock size={20} className="text-warning" /> Security
              </h3>
              <p className="text-sm text-textMuted mb-6">Update your password frequently to maintain high platform security.</p>
              <button className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-sm font-bold transition-all">
                 Change Password
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

function PreferenceToggle({ label, description, checked, onChange, disabled }) {
   return (
      <div className={clsx("flex items-center justify-between py-2 transition-opacity", disabled && "opacity-60")}>
         <div className="flex-1">
            <p className="text-sm font-bold text-white mb-0.5">{label}</p>
            <p className="text-[11px] text-textMuted">{description}</p>
         </div>
         <div 
            onClick={() => !disabled && onChange()}
            className={clsx(
               "w-12 h-6 rounded-full relative cursor-pointer border transition-all",
               checked ? "bg-primary/20 border-primary/30" : "bg-white/10 border-white/5",
               disabled && "cursor-not-allowed"
            )}
         >
            <div className={clsx(
               "absolute top-0.5 w-4.5 h-4.5 rounded-full shadow-md transition-all",
               checked ? "right-0.5 bg-primary" : "left-0.5 bg-slate-500"
            )}></div>
         </div>
      </div>
   );
}
