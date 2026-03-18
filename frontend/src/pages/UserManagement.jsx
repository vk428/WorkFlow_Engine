import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Mail, Shield, MoreVertical, 
  Trash2, Edit, Search, Filter, CheckCircle2, XCircle,
  Building2, Hash
} from 'lucide-react';
import api from '../api';
import clsx from 'clsx';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const dropdownRef = React.useRef(null);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'user',
    department: '',
    password: '',
    confirm_password: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    api.get('/auth/users/')
      .then(res => {
        const data = res.results ? res.results : (Array.isArray(res) ? res : []);
        setUsers(data);
      })
      .catch(err => console.error('Error fetching users:', err))
      .finally(() => setLoading(false));
  };

  const handleOpenModal = (user = null) => {
    console.log('[USER_MGMT] Opening Modal. Target:', user ? user.email : 'New User Provisioning');
    if (user) {
      setSelectedUser(user);
      setFormData({
        email: user.email,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        role: user.role,
        department: user.department || '',
        password: '',
        confirm_password: ''
      });
    } else {
      setSelectedUser(null);
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        role: 'user',
        department: '',
        password: '',
        confirm_password: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Validation
    if (!selectedUser && formData.password !== formData.confirm_password) {
      alert('Passwords do not match');
      setIsSaving(false);
      return;
    }

    try {
      if (selectedUser) {
        const data = { ...formData };
        delete data.confirm_password;
        if (!data.password) delete data.password;
        await api.patch(`/auth/users/${selectedUser.id}/`, data);
      } else {
        await api.post('/auth/users/', formData);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      const errorMsg = typeof err === 'string' ? err : (err.response?.data?.error || err.message);
      alert('Operation failed: ' + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    console.log(`[USER_MGMT] Initiating delete for ID: ${id}`);
    if (!window.confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) {
      console.log('[USER_MGMT] User cancelled deletion.');
      return;
    }
    
    try {
      console.log(`[USER_MGMT] Calling DELETE /auth/users/${id}/`);
      const response = await api.delete(`/auth/users/${id}/`);
      console.log('[USER_MGMT] Delete API Success:', response);
      fetchUsers();
    } catch (err) {
      console.error('[USER_MGMT] Delete API Error:', err);
      const errorMsg = typeof err === 'string' ? err : (err.response?.data?.error || err.response?.data?.detail || err.message || 'Unknown backend error');
      alert('CRITICAL: Delete Operation Failed. Details: ' + errorMsg);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-10">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
               <Users size={16} className="text-primary" />
            </div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Platform Governance</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">User Catalog</h1>
          <p className="text-textMuted text-sm">Manage enterprise access controls, roles, and organizational structure.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <UserPlus size={18} strokeWidth={2.5} /> 
          <span>Provision New User</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-4 items-center bg-surface/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email, or department..." 
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-bold transition-all">
          <Filter size={16} /> Filters
        </button>
      </div>

      {/* Table Container */}
      <div className="glass-panel border-white/5 shadow-2xl bg-surface/30">
        <div className="overflow-x-visible">
          <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Full Identity</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Governance Role</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Organization</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Security Status</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan="5" className="px-6 py-20 text-center text-textMuted animate-pulse font-medium italic">Synchronizing with Active Directory...</td></tr>
                ) : filteredUsers.length > 0 ? filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                  <img 
                                      src={u.avatar || `https://ui-avatars.com/api/?name=${u.full_name}&background=1e293b&color=fff&bold=true`} 
                                      className="w-11 h-11 rounded-2xl border border-white/10 shadow-lg object-cover" 
                                      alt="avatar"
                                  />
                                  <div className={clsx(
                                    "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface",
                                    u.is_active ? "bg-success" : "bg-slate-500"
                                  )}></div>
                                </div>
                                <div>
                                    <p className="font-bold text-white text-sm group-hover:text-primary transition-colors">{u.full_name}</p>
                                    <div className="flex items-center gap-1.5 text-textMuted mt-0.5">
                                      <Mail size={12} className="opacity-50" />
                                      <span className="text-[11px] font-medium">{u.email}</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-5">
                            <span className={clsx(
                              "inline-flex items-center gap-1.5 text-[10px] font-black py-1 px-3 rounded-lg border uppercase tracking-wider",
                              u.role === 'admin' 
                                ? "bg-primary/10 text-primary border-primary/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]" 
                                : "bg-white/5 text-slate-400 border-white/10"
                            )}>
                                <Shield size={10} strokeWidth={3} />
                                {u.role === 'admin' ? 'Administrator' : 'Standard User'}
                            </span>
                        </td>
                        <td className="px-6 py-5">
                            <div className="flex items-center gap-2 text-slate-300">
                               <Building2 size={14} className="text-slate-500" />
                               <span className="text-xs font-semibold">{u.department || 'General Operations'}</span>
                            </div>
                        </td>
                        <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                               {u.is_active ? (
                                 <>
                                   <CheckCircle2 size={14} className="text-success" />
                                   <span className="text-xs font-bold text-success/80">Authorized</span>
                                 </>
                               ) : (
                                 <>
                                   <XCircle size={14} className="text-rose-400" />
                                   <span className="text-xs font-bold text-rose-400/80">Restricted</span>
                                 </>
                               )}
                            </div>
                        </td>
                        <td className="px-6 py-5 text-right w-40">
                            <div className={clsx(
                              "flex justify-end items-center gap-2 relative pointer-events-auto",
                              openMenuId === u.id ? "z-[70]" : "z-10"
                            )}>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleOpenModal(u); }}
                                  className="p-2.5 bg-white/5 hover:bg-white/10 hover:text-white text-slate-400 rounded-xl transition-all border border-white/5 shadow-lg group-hover:border-primary/30" 
                                  title="Edit Profile"
                                >
                                  <Edit size={16} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }}
                                  className="p-2.5 bg-danger/5 hover:bg-danger/20 hover:text-danger text-slate-400 rounded-xl transition-all border border-danger/10 shadow-lg" 
                                  title="Delete User"
                                >
                                  <Trash2 size={16} />
                                </button>
                                <div className="relative">
                                  <button 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('[USER_MGMT] Toggling menu for:', u.id);
                                      setOpenMenuId(openMenuId === u.id ? null : u.id);
                                    }}
                                    className={clsx(
                                      "p-2.5 rounded-xl transition-all border shadow-lg",
                                      openMenuId === u.id 
                                        ? "bg-primary/20 text-primary border-primary/30 ring-2 ring-primary/20" 
                                        : "bg-white/5 hover:bg-white/10 text-slate-400 border-white/5"
                                    )}
                                  >
                                    <MoreVertical size={16} />
                                  </button>
                                  {openMenuId === u.id && (
                                    <>
                                      {/* Global Transparent Backdrop to capture clicks anywhere else */}
                                      <div 
                                        className="fixed inset-0 z-[60] bg-black/5" 
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log('[USER_MGMT] Global backdrop clicked, closing menu');
                                          setOpenMenuId(null);
                                        }}
                                      ></div>
                                      
                                      <div 
                                        className="absolute right-0 mt-3 w-56 bg-[#1a2236] border border-white/10 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] z-[70] p-2.5 overflow-hidden animate-in fade-in slide-in-from-top-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="px-3 py-2 border-b border-white/5 mb-1">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Admin Controls</p>
                                        </div>
                                        <button 
                                          onClick={() => { console.log('[USER_MGMT] Reset Keys Clicked'); alert('Request Sent: System will regenerate credentials.'); setOpenMenuId(null); }}
                                          className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-3"
                                        >
                                          <Shield size={14} className="text-primary" /> 
                                          <span className="font-semibold">Reset Security Keys</span>
                                        </button>
                                        <button 
                                          onClick={() => { console.log('[USER_MGMT] Welcome Email Clicked'); alert('Email Dispatching: Onboarding sequence started.'); setOpenMenuId(null); }}
                                          className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-3"
                                        >
                                          <Mail size={14} className="text-slate-400" /> 
                                          <span className="font-semibold">Send Welcome Email</span>
                                        </button>
                                        <div className="h-[1px] bg-white/5 my-2"></div>
                                        <button 
                                          onClick={(e) => { 
                                            e.stopPropagation();
                                            console.log('[USER_MGMT] Menu: Deactivate Clicked');
                                            handleDelete(u.id); 
                                            setOpenMenuId(null); 
                                          }}
                                          className="w-full text-left px-4 py-2.5 text-xs text-danger hover:bg-danger/10 rounded-lg transition-colors flex items-center gap-3"
                                        >
                                          <div className="p-1 rounded bg-danger/20">
                                            <Trash2 size={12} /> 
                                          </div>
                                          <span className="font-bold">Deactivate Account</span>
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                            </div>
                        </td>
                    </tr>
                )) : (
                  <tr><td colSpan="5" className="px-6 py-20 text-center text-textMuted italic font-medium">No matching personnel found in directory.</td></tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-8 bg-surface space-y-6 shadow-2xl border-white/10">
            <h2 className="text-2xl font-black text-white">{selectedUser ? 'Modify Personnel' : 'Provision User'}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">First Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                    value={formData.first_name}
                    onChange={e => setFormData({...formData, first_name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Last Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                    value={formData.last_name}
                    onChange={e => setFormData({...formData, last_name: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Email Address</label>
                <input 
                  type="email" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Security Role</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="user">Standard User</option>
                  <option value="admin">Platform Admin</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Department</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  value={formData.department}
                  onChange={e => setFormData({...formData, department: e.target.value})}
                />
              </div>

              {!selectedUser && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Password</label>
                    <input 
                      type="password" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      required={!selectedUser}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Confirm</label>
                    <input 
                      type="password" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                      value={formData.confirm_password}
                      onChange={e => setFormData({...formData, confirm_password: e.target.value})}
                      required={!selectedUser}
                    />
                  </div>
                </div>
              )}

              {selectedUser && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">New Password (Leave blank to keep current)</label>
                  <input 
                    type="password" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-1 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Processing...' : (selectedUser ? 'Save Updates' : 'Provision User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
