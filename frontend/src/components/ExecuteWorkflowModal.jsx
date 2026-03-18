import React, { useState, useEffect } from 'react';
import { X, Play, AlertCircle } from 'lucide-react';
import api from '../api';

export default function ExecuteWorkflowModal({ workflow, onClose, onSuccess }) {
    const [formData, setFormData] = useState({});
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (workflow?.id) {
            fetchFormSchema();
        }
    }, [workflow]);

    const fetchFormSchema = () => {
        setLoading(true);
        api.get(`/workflows/${workflow.id}/execute_form/`)
            .then(res => {
                if (res.success) {
                    setFields(res.data.fields || []);
                    // Pre-fill with defaults
                    const defaults = {};
                    (res.data.fields || []).forEach(field => {
                        defaults[field.name] = '';
                    });
                    setFormData(defaults);
                }
            })
            .catch(err => {
                setError('Failed to load form: ' + err);
            })
            .finally(() => setLoading(false));
    };

    const handleChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const res = await api.post(`/workflows/${workflow.id}/execute/`, {
                context: formData
            });

            if (res.success) {
                onSuccess(res.data);
            } else {
                setError(res.message || 'Execution failed');
            }
        } catch (err) {
            setError('Failed to execute workflow: ' + err);
        } finally {
            setSubmitting(false);
        }
    };

    const renderField = (field) => {
        const value = formData[field.name] || '';

        switch (field.type) {
            case 'textarea':
                return (
                    <textarea
                        key={field.name}
                        className="input-field min-h-[80px]"
                        name={field.name}
                        value={value}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.label}
                        required={field.required}
                    />
                );
            case 'select':
                return (
                    <select
                        key={field.name}
                        className="input-field"
                        name={field.name}
                        value={value}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        required={field.required}
                    >
                        <option value="">Select {field.label}</option>
                        {(field.options || []).map(opt => (
                            <option key={opt.value || opt} value={opt.value || opt}>
                                {opt.label || opt}
                            </option>
                        ))}
                    </select>
                );
            case 'number':
                return (
                    <input
                        key={field.name}
                        type="number"
                        className="input-field"
                        name={field.name}
                        value={value}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.label}
                        required={field.required}
                    />
                );
            case 'email':
                return (
                    <input
                        key={field.name}
                        type="email"
                        className="input-field"
                        name={field.name}
                        value={value}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.label}
                        required={field.required}
                    />
                );
            default:
                return (
                    <input
                        key={field.name}
                        type="text"
                        className="input-field"
                        name={field.name}
                        value={value}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.label}
                        required={field.required}
                    />
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-lg p-6 border !border-white/10 shadow-2xl">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white">Submit Request</h3>
                        <p className="text-sm text-textMuted mt-1">{workflow?.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-textMuted hover:text-white p-1"
                    >
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                        <AlertCircle size={18} className="text-red-400 mt-0.5" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {loading ? (
                    <div className="py-8 text-center">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-textMuted text-sm mt-2">Loading form...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto pr-2">
                            {fields.length === 0 ? (
                                <p className="text-textMuted text-sm text-center py-4">
                                    No input required. Click Execute to start.
                                </p>
                            ) : (
                                fields.map(field => (
                                    <div key={field.name}>
                                        <label className="block text-sm text-textMuted mb-1">
                                            {field.label}
                                            {field.required && <span className="text-red-400 ml-1">*</span>}
                                        </label>
                                        {renderField(field)}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Play size={16} fill="currentColor" />
                                        Submit Request
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
