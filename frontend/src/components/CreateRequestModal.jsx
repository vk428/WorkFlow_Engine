import React, { useState, useEffect } from 'react';
import { X, Send, FileText, Receipt, Calendar, UserPlus, ChevronRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import api from '../api';

export default function CreateRequestModal({ isOpen, onClose, onSuccess }) {
    const [step, setStep] = useState('selection'); // 'selection', 'form', 'success'
    const [requestTypes, setRequestTypes] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [formFields, setFormFields] = useState([]);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [submissionResult, setSubmissionResult] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setStep('selection');
            setSelectedType(null);
            setFormData({});
            setError(null);
            setSubmissionResult(null);
            fetchRequestTypes();
        }
    }, [isOpen]);

    const fetchRequestTypes = () => {
        setLoading(true);
        api.get('/workflows/request_types/')
            .then(res => {
                setRequestTypes(res.data || []);
            })
            .catch(err => {
                console.error('Failed to fetch request types:', err);
                setError('Failed to load request types. Please try again.');
            })
            .finally(() => setLoading(false));
    };

    const handleSelectType = (type) => {
        setSelectedType(type);
        setStep('form');
        fetchFormSchema(type.id);
    };

    const fetchFormSchema = (workflowId) => {
        setLoading(true);
        api.get(`/workflows/${workflowId}/execute_form/`)
            .then(res => {
                if (res.success) {
                    setFormFields(res.fields || []);
                    // Pre-fill with defaults
                    const defaults = {};
                    (res.fields || []).forEach(field => {
                        defaults[field.name] = '';
                    });
                    setFormData(defaults);
                }
            })
            .catch(err => {
                console.error('Failed to fetch form:', err);
                setError('Failed to load request form. Please try again.');
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
            const res = await api.post(`/workflows/${selectedType.id}/execute/`, {
                context: formData
            });

            if (res.success) {
                setSubmissionResult(res);
                setStep('success');
                if (onSuccess) {
                    onSuccess(res);
                }
            } else {
                setError(res.message || 'Failed to submit request');
            }
        } catch (err) {
            setError('Failed to submit request: ' + err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleBack = () => {
        if (step === 'form') {
            setStep('selection');
            setSelectedType(null);
            setFormFields([]);
            setFormData({});
        } else if (step === 'success') {
            // Reset and close
            onClose();
        }
    };

    const getIconForCategory = (category) => {
        switch (category) {
            case 'expense': return Receipt;
            case 'leave': return Calendar;
            case 'onboarding': return UserPlus;
            default: return FileText;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-2xl max-h-[90vh] flex flex-col border !border-white/10 shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-white/5">
                    <div>
                        {step === 'selection' && (
                            <>
                                <h3 className="text-xl font-bold text-white">Create Request</h3>
                                <p className="text-sm text-textMuted mt-1">Select a request type to get started</p>
                            </>
                        )}
                        {step === 'form' && selectedType && (
                            <>
                                <h3 className="text-xl font-bold text-white">{selectedType.display_name}</h3>
                                <p className="text-sm text-textMuted mt-1">Fill in the details below</p>
                            </>
                        )}
                        {step === 'success' && (
                            <>
                                <h3 className="text-xl font-bold text-white">Request Submitted</h3>
                                <p className="text-sm text-textMuted mt-1">Your request has been created successfully</p>
                            </>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-textMuted hover:text-white p-1"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                            <AlertCircle size={18} className="text-red-400 mt-0.5" />
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Step 1: Request Type Selection */}
                    {step === 'selection' && (
                        <div>
                            {loading ? (
                                <div className="py-12 text-center">
                                    <Loader2 size={32} className="mx-auto text-primary animate-spin mb-3" />
                                    <p className="text-textMuted text-sm">Loading request types...</p>
                                </div>
                            ) : requestTypes.length === 0 ? (
                                <div className="py-12 text-center">
                                    <FileText size={48} className="mx-auto text-textMuted mb-3 opacity-50" />
                                    <p className="text-white font-medium">No request types available</p>
                                    <p className="text-textMuted text-sm mt-1">Please contact your administrator to set up request types.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {requestTypes.map(type => {
                                        const Icon = getIconForCategory(type.category);
                                        return (
                                            <button
                                                key={type.id}
                                                onClick={() => handleSelectType(type)}
                                                className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-surface/30 hover:bg-surface/50 hover:border-white/10 transition-all text-left group"
                                            >
                                                <div 
                                                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                                                    style={{ backgroundColor: `${type.color}20`, borderColor: `${type.color}30` }}
                                                >
                                                    <Icon size={24} style={{ color: type.color }} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-white font-semibold group-hover:text-primary transition-colors">
                                                        {type.display_name}
                                                    </h4>
                                                    <p className="text-sm text-textMuted mt-0.5">{type.description}</p>
                                                </div>
                                                <ChevronRight size={20} className="text-textMuted group-hover:text-primary transition-colors" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Request Form */}
                    {step === 'form' && (
                        <div>
                            {loading ? (
                                <div className="py-12 text-center">
                                    <Loader2 size={32} className="mx-auto text-primary animate-spin mb-3" />
                                    <p className="text-textMuted text-sm">Loading form...</p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit}>
                                    <div className="space-y-4 mb-6">
                                        {formFields.length === 0 ? (
                                            <p className="text-textMuted text-sm text-center py-4">
                                                No additional information required. Click Submit to create your request.
                                            </p>
                                        ) : (
                                            formFields.map(field => (
                                                <div key={field.name}>
                                                    <label className="block text-sm text-textMuted mb-2">
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
                                            onClick={handleBack}
                                            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all"
                                        >
                                            Back
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <Send size={16} />
                                                    Submit Request
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === 'success' && (
                        <div className="py-8 text-center">
                            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} className="text-success" />
                            </div>
                            <h4 className="text-xl font-bold text-white mb-2">Request Created!</h4>
                            <p className="text-textMuted mb-6">
                                Your {selectedType?.display_name} has been submitted successfully.
                            </p>
                            {submissionResult && (
                                <div className="bg-surface/50 rounded-xl p-4 mb-6 text-left">
                                    <p className="text-xs text-textMuted uppercase tracking-wider mb-2">Request Details</p>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-textMuted">Request ID:</span>
                                            <span className="text-white font-mono">{submissionResult.id?.slice(0, 8)}...</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-textMuted">Status:</span>
                                            <span className="text-warning font-medium capitalize">{submissionResult.status}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleBack}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        setStep('selection');
                                        setSelectedType(null);
                                        setFormData({});
                                        setSubmissionResult(null);
                                    }}
                                    className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-all"
                                >
                                    Create Another
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    function renderField(field) {
        const value = formData[field.name] || '';

        switch (field.type) {
            case 'textarea':
                return (
                    <textarea
                        className="input-field min-h-[100px]"
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
                        type="email"
                        className="input-field"
                        name={field.name}
                        value={value}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.label}
                        required={field.required}
                    />
                );
            case 'date':
                return (
                    <input
                        type="date"
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
    }
}
