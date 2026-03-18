import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// JWT interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Unwrap success envelope from Django backend
api.interceptors.response.use(
  (response) => {
    if (response.data) {
      if (response.data.results !== undefined) {
        return response.data; // Paginated
      }
      if (response.data.data !== undefined) {
        return response.data.data; // Standard envelope
      }
      return response.data; // Fallback plain content
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
    const backendError = error.response?.data?.error || error.response?.data?.detail;
    return Promise.reject(backendError || error.message);
  }
);

// ============== ANALYTICS API ==============
export const analyticsApi = {
  getOverview: (days = 30) => api.get(`/analytics/overview?days=${days}`),
  getExecutions: (days = 30) => api.get(`/analytics/executions?days=${days}`),
  getApprovals: (days = 30) => api.get(`/analytics/approvals?days=${days}`),
  getUsers: (days = 30) => api.get(`/analytics/users?days=${days}`),
  getWorkflowUsage: (days = 30) => api.get(`/analytics/workflow-usage?days=${days}`),
};

// ============== REPORTS API ==============
export const reportsApi = {
  getExecutions: (params) => api.get('/reports/executions', { params }),
  getWorkflows: (params) => api.get('/reports/workflows', { params }),
  getApprovals: (params) => api.get('/reports/approvals', { params }),
  getFilters: () => api.get('/reports/filters'),

  // Export functions
  exportExecutionsCSV: (params) =>
    api.get('/reports/executions', {
      params: { ...params, export: 'csv' },
      responseType: 'blob'
    }),
  exportWorkflowsCSV: (params) =>
    api.get('/reports/workflows', {
      params: { ...params, export: 'csv' },
      responseType: 'blob'
    }),
  exportApprovalsCSV: (params) =>
    api.get('/reports/approvals', {
      params: { ...params, export: 'csv' },
      responseType: 'blob'
    }),
};

// ============== SETTINGS API ==============
export const settingsApi = {
  getSettings: () => api.get('/audit/settings/'),
  updateSettings: (data) => api.put('/audit/settings/', data),

  // User management
  getUsers: () => api.get('/audit/settings/users/'),
  createUser: (data) => api.post('/audit/settings/users/', data),
  deleteUser: (userId) => api.delete(`/audit/settings/users/?user_id=${userId}`),
  updateUserRole: (userId, role) =>
    api.put(`/audit/settings/users/${userId}/role/`, { role }),
};

export default api;
