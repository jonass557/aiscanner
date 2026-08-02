import api from './api.js';

/**
 * Typed wrappers around the backend endpoints. Components call these instead
 * of touching axios directly, so URLs live in one place.
 */

export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  me: () => api.get('/auth/me'),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  resendVerification: () => api.post('/auth/resend-verification'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
};

export const scanApi = {
  scan: (formData, onUploadProgress) =>
    api.post('/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),
};

export const multiTimeframeApi = {
  scan: (formData, onUploadProgress) =>
    api.post('/multi-timeframe-scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),
  list: (params) => api.get('/multi-timeframe-analyses', { params }),
  get: (id) => api.get(`/multi-timeframe-analyses/${id}`),
  remove: (id) => api.delete(`/multi-timeframe-analyses/${id}`),
};

export const opportunityApi = {
  list: (params) => api.get('/opportunities', { params }),
  meta: () => api.get('/opportunities/meta'),
  get: (id) => api.get(`/opportunities/${id}`),
  scan: (payload) => api.post('/opportunities/scan', payload),
};

export const mentorApi = {
  conversations: () => api.get('/mentor/conversations'),
  createConversation: (payload) => api.post('/mentor/conversations', payload),
  getConversation: (id) => api.get(`/mentor/conversations/${id}`),
  sendMessage: (id, payload) => api.post(`/mentor/conversations/${id}/message`, payload),
  deleteConversation: (id) => api.delete(`/mentor/conversations/${id}`),
};

export const tradeValidatorApi = {
  // Screenshot mode: pass FormData. Parameters mode: pass a plain object.
  validate: (data) =>
    api.post(
      '/trade-validator',
      data,
      data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}
    ),
  list: (params) => api.get('/trade-validations', { params }),
  get: (id) => api.get(`/trade-validations/${id}`),
  remove: (id) => api.delete(`/trade-validations/${id}`),
};

export const economicNewsApi = {
  list: (params) => api.get('/economic-news', { params }),
  upcoming: (hours) => api.get('/economic-news/upcoming', { params: { hours } }),
  get: (id) => api.get(`/economic-news/${id}`),
};

export const voiceApi = {
  command: (payload) => api.post('/voice/command', payload),
  conversations: (params) => api.get('/voice/conversations', { params }),
  getConversation: (id) => api.get(`/voice/conversations/${id}`),
  deleteConversation: (id) => api.delete(`/voice/conversations/${id}`),
};

export const assistantApi = {
  conversations: (params) => api.get('/assistant/conversations', { params }),
  createConversation: (payload) => api.post('/assistant/conversations', payload),
  getConversation: (id) => api.get(`/assistant/conversations/${id}`),
  sendMessage: (id, payload) => api.post(`/assistant/conversations/${id}/message`, payload),
  deleteConversation: (id) => api.delete(`/assistant/conversations/${id}`),
};

export const paymentApi = {
  checkout: (payload) => api.post('/payments/checkout', payload),
  list: (params) => api.get('/payments', { params }),
  get: (id) => api.get(`/payments/${id}`),
};

export const analysisApi = {
  list: (params) => api.get('/analyses', { params }),
  get: (id) => api.get(`/analyses/${id}`),
  remove: (id) => api.delete(`/analyses/${id}`),
  stats: () => api.get('/analyses/stats'),
  exportPdf: (id) => api.get(`/analyses/${id}/export/pdf`, { responseType: 'blob' }),
  exportCsv: (params) => api.get('/analyses/export/csv', { params, responseType: 'blob' }),
};

export const userApi = {
  plans: () => api.get('/users/plans'),
  updateProfile: (payload) => api.patch('/users/profile', payload),
  changePassword: (payload) => api.patch('/users/password', payload),
  changeSubscription: (plan) => api.post('/users/subscription', { plan }),
  getPreferences: () => api.get('/users/preferences'),
  updatePreferences: (payload) => api.patch('/users/preferences', payload),
};

export const adminApi = {
  stats: () => api.get('/admin/stats'),
  users: (params) => api.get('/admin/users', { params }),
  user: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, payload) => api.patch(`/admin/users/${id}`, payload),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  logs: (params) => api.get('/admin/logs', { params }),
  aiConfig: () => api.get('/admin/ai-config'),
  plans: () => api.get('/admin/plans'),
  createPlan: (payload) => api.post('/admin/plans', payload),
  updatePlan: (id, payload) => api.patch(`/admin/plans/${id}`, payload),
  togglePlan: (id) => api.post(`/admin/plans/${id}/toggle`),
  deletePlan: (id) => api.delete(`/admin/plans/${id}`),
};

/** Triggers a browser download from a blob response. */
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
