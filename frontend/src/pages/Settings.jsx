import React, { useState, useEffect } from 'react';
import {
    Settings, Users, Bell, Mail, Save, Loader, Plus, Trash2,
    Shield, AlertCircle, CheckCircle, Edit
} from 'lucide-react';
import api, { settingsApi } from '../api';
import { useAuthStore } from '../store/authStore';

const TABS = [
    { id: 'general', label: 'General Settings' },
    { id: 'users', label: 'User Management' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'workflows', label: 'Workflow Settings' },
];

function SettingsPage() {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [settings, setSettings] = useState({
        notifications_enabled: true,
        email_config: {
            smtp_host: '',
            smtp_port: 587,
            smtp_user: '',
            smtp_password: '',
            use_tls: true,
            from_email: 'noreply@halleyx.com'
        },
        workflow_defaults: {
            default_status: 'draft',
            auto_archive_completed: true,
            archive_after_days: 30
        },
        system_maintenance: {
            enabled: false,
            message: ''
        }
    });
    const [users, setUsers] = useState([]);
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [newUser, setNewUser] = useState({
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        confirm_password: '', // Added
        role: 'user',
        department: ''
    });

    useEffect(() => {
        if (activeTab === 'general' || activeTab === 'notifications' || activeTab === 'workflows') {
            loadSettings();
        } else if (activeTab === 'users') {
            loadUsers();
        }
    }, [activeTab]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const res = await settingsApi.getSettings();
            if (res) {
                setSettings(prev => ({
                    ...prev,
                    ...res
                }));
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await settingsApi.getUsers();
            setUsers(res || []);
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await settingsApi.updateSettings(settings);
            setMessage({ type: 'success', text: 'Settings saved successfully!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        
        if (!selectedUser && newUser.password !== newUser.confirm_password) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        setSaving(true);
        try {
            if (selectedUser) {
                const data = { ...newUser };
                delete data.confirm_password;
                if (!data.password) delete data.password;
                // Using the specific role update endpoint if only role, but let's use the core user management if it supports full update
                // Actually the UserManagementView in core/views.py doesn't have a PUT for full update, only GET/POST/DELETE.
                // But UpdateUserRoleView exists. 
                // Let's use the auth/users/ endpoint which is more robust.
                await api.patch(`/auth/users/${selectedUser.id}/`, data);
            } else {
                await settingsApi.createUser(newUser);
            }
            
            setShowCreateUser(false);
            setNewUser({
                email: '',
                first_name: '',
                last_name: '',
                password: '',
                confirm_password: '',
                role: 'user',
                department: ''
            });
            setSelectedUser(null);
            loadUsers();
            setMessage({ type: 'success', text: selectedUser ? 'User updated successfully!' : 'User created successfully!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || err.message || 'Operation failed' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async (userId) => {
        console.log(`[SETTINGS_MGMT] Attempting DELETE for user: ${userId}`);
        if (!confirm('Are you sure you want to permanently delete this user account?')) {
            console.log('[SETTINGS_MGMT] Delete aborted by user.');
            return;
        }
        
        try {
            console.log('[SETTINGS_MGMT] Sending DELETE request...');
            await settingsApi.deleteUser(userId);
            console.log('[SETTINGS_MGMT] DELETE Success!');
            loadUsers();
            setMessage({ type: 'success', text: 'User account has been permanently removed.' });
            setTimeout(() => setMessage(null), 4000);
        } catch (err) {
            console.error('[SETTINGS_MGMT] DELETE Failed:', err);
            const errorMsg = typeof err === 'string' ? err : (err.message || 'The server rejected the delete request.');
            setMessage({ type: 'error', text: 'Delete Failed: ' + errorMsg });
            alert('Settings Delete Error: ' + errorMsg);
        }
    };

    const handleUpdateRole = async (userId, newRole) => {
        try {
            await settingsApi.updateUserRole(userId, newRole);
            loadUsers();
            setMessage({ type: 'success', text: 'Role updated successfully!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to update role' });
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">System Settings</h1>
                    <p className="text-textMuted mt-1">Configure platform settings and manage users</p>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    {message.text}
                </div>
            )}

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

            {/* General Settings */}
            {activeTab === 'general' && (
                <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center gap-3">
                        <Settings className="text-primary" size={20} />
                        <h2 className="text-lg font-semibold text-white">General Settings</h2>
                    </div>

                    {/* System Maintenance */}
                    <div className="space-y-4">
                        <h3 className="text-white font-medium">System Maintenance</h3>
                        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                            <input
                                type="checkbox"
                                id="maintenance_mode"
                                checked={settings.system_maintenance?.enabled || false}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    system_maintenance: { ...prev.system_maintenance, enabled: e.target.checked }
                                }))}
                                className="w-5 h-5 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                            />
                            <div>
                                <label htmlFor="maintenance_mode" className="text-white font-medium">Maintenance Mode</label>
                                <p className="text-textMuted text-sm">Enable to prevent users from accessing the system</p>
                            </div>
                        </div>
                        {settings.system_maintenance?.enabled && (
                            <input
                                type="text"
                                placeholder="Maintenance message"
                                value={settings.system_maintenance?.message || ''}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    system_maintenance: { ...prev.system_maintenance, message: e.target.value }
                                }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            />
                        )}
                    </div>

                    <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                        Save Changes
                    </button>
                </div>
            )}

            {/* User Management */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="bg-surface border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <Users className="text-primary" size={20} />
                                <h2 className="text-lg font-semibold text-white">User Management</h2>
                            </div>
                            <button
                                onClick={() => setShowCreateUser(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
                            >
                                <Plus size={18} />
                                Add User
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <Loader className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {users.map(u => (
                                    <div key={u.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                                {u.first_name?.[0] || 'U'}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{u.first_name} {u.last_name}</p>
                                                <p className="text-textMuted text-sm">{u.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <select
                                                value={u.role}
                                                onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary"
                                            >
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log('[SETTINGS_MGMT] Edit clicked for:', u.id);
                                                    setSelectedUser(u);
                                                    setNewUser({
                                                        email: u.email,
                                                        first_name: u.first_name,
                                                        last_name: u.last_name,
                                                        role: u.role,
                                                        department: u.department || '',
                                                        password: '',
                                                        confirm_password: ''
                                                    });
                                                    setShowCreateUser(true);
                                                }}
                                                className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all border border-white/10 shadow-sm"
                                                title="Edit user"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log('[SETTINGS_MGMT] Delete clicked for:', u.id);
                                                    handleDeleteUser(u.id);
                                                }}
                                                className="p-2.5 bg-danger/5 hover:bg-danger/20 text-slate-400 hover:text-danger rounded-xl transition-all border border-danger/10 shadow-sm"
                                                title="Delete user"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Create/Edit User Modal */}
                    {showCreateUser && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
                            <div className="bg-surface glass-panel border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl">
                                <h3 className="text-2xl font-black text-white mb-6">{selectedUser ? 'Modify Personnel' : 'Provision User'}</h3>
                                <form onSubmit={handleCreateUser} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">First Name</label>
                                            <input
                                                type="text"
                                                placeholder="First Name"
                                                value={newUser.first_name}
                                                onChange={(e) => setNewUser(prev => ({ ...prev, first_name: e.target.value }))}
                                                required
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Last Name</label>
                                            <input
                                                type="text"
                                                placeholder="Last Name"
                                                value={newUser.last_name}
                                                onChange={(e) => setNewUser(prev => ({ ...prev, last_name: e.target.value }))}
                                                required
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Email Address</label>
                                        <input
                                            type="email"
                                            placeholder="Email"
                                            value={newUser.email}
                                            onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                                            required
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    {!selectedUser && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Password</label>
                                                <input
                                                    type="password"
                                                    placeholder="Password"
                                                    value={newUser.password}
                                                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                                                    required
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Confirm</label>
                                                <input
                                                    type="password"
                                                    placeholder="Confirm"
                                                    value={newUser.confirm_password}
                                                    onChange={(e) => setNewUser(prev => ({ ...prev, confirm_password: e.target.value }))}
                                                    required
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {selectedUser && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">New Password (Optional)</label>
                                            <input
                                                type="password"
                                                placeholder="Leave blank to keep current"
                                                value={newUser.password}
                                                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Department</label>
                                        <input
                                            type="text"
                                            placeholder="Department"
                                            value={newUser.department}
                                            onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Role</label>
                                        <select
                                            value={newUser.role}
                                            onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                                        >
                                            <option value="user">Standard User</option>
                                            <option value="admin">Administrator</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCreateUser(false);
                                                setSelectedUser(null);
                                            }}
                                            className="flex-1 px-4 py-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors font-bold"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="flex-1 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 font-bold"
                                        >
                                            {saving ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : (selectedUser ? 'Save Updates' : 'Provision User')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
                <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center gap-3">
                        <Bell className="text-primary" size={20} />
                        <h2 className="text-lg font-semibold text-white">Notification Settings</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div>
                                <p className="text-white font-medium">Enable Notifications</p>
                                <p className="text-textMuted text-sm">Turn on/off system notifications</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.notifications_enabled || false}
                                onChange={(e) => setSettings(prev => ({ ...prev, notifications_enabled: e.target.checked }))}
                                className="w-5 h-5 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-6">
                        <Mail className="text-primary" size={20} />
                        <h3 className="text-white font-medium">Email Configuration</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-textMuted text-sm">SMTP Host</label>
                            <input
                                type="text"
                                value={settings.email_config?.smtp_host || ''}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    email_config: { ...prev.email_config, smtp_host: e.target.value }
                                }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-textMuted text-sm">SMTP Port</label>
                            <input
                                type="number"
                                value={settings.email_config?.smtp_port || 587}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    email_config: { ...prev.email_config, smtp_port: parseInt(e.target.value) }
                                }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-textMuted text-sm">From Email</label>
                            <input
                                type="email"
                                value={settings.email_config?.from_email || ''}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    email_config: { ...prev.email_config, from_email: e.target.value }
                                }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-textMuted text-sm">SMTP Username</label>
                            <input
                                type="text"
                                value={settings.email_config?.smtp_user || ''}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    email_config: { ...prev.email_config, smtp_user: e.target.value }
                                }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-textMuted text-sm">SMTP Password</label>
                            <input
                                type="password"
                                value={settings.email_config?.smtp_password || ''}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    email_config: { ...prev.email_config, smtp_password: e.target.value }
                                }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary mt-1"
                            />
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="use_tls"
                                checked={settings.email_config?.use_tls || false}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    email_config: { ...prev.email_config, use_tls: e.target.checked }
                                }))}
                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                            />
                            <label htmlFor="use_tls" className="text-white text-sm">Use TLS</label>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                        Save Changes
                    </button>
                </div>
            )}

            {/* Workflow Settings */}
            {activeTab === 'workflows' && (
                <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center gap-3">
                        <Shield className="text-primary" size={20} />
                        <h2 className="text-lg font-semibold text-white">Workflow Settings</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-textMuted text-sm">Default Workflow Status</label>
                            <select
                                value={settings.workflow_defaults?.default_status || 'draft'}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    workflow_defaults: { ...prev.workflow_defaults, default_status: e.target.value }
                                }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary mt-1"
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div>
                                <p className="text-white font-medium">Auto-Archive Completed</p>
                                <p className="text-textMuted text-sm">Automatically archive workflows after completion</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.workflow_defaults?.auto_archive_completed || false}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    workflow_defaults: { ...prev.workflow_defaults, auto_archive_completed: e.target.checked }
                                }))}
                                className="w-5 h-5 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                            />
                        </div>

                        {settings.workflow_defaults?.auto_archive_completed && (
                            <div>
                                <label className="text-textMuted text-sm">Archive After (days)</label>
                                <input
                                    type="number"
                                    value={settings.workflow_defaults?.archive_after_days || 30}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        workflow_defaults: { ...prev.workflow_defaults, archive_after_days: parseInt(e.target.value) }
                                    }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary mt-1"
                                />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                        Save Changes
                    </button>
                </div>
            )}
        </div>
    );
}

export default SettingsPage;
