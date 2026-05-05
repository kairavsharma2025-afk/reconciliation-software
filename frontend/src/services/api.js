import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const uploadFiles = (files) => {
  const form = new FormData();
  if (files.bank)    form.append('bank', files.bank);
  if (files.gateway) form.append('gateway', files.gateway);
  if (files.ledger)  form.append('ledger', files.ledger);
  return api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const clearAll        = () => api.delete('/upload');
export const runReconcile    = () => api.post('/reconcile');         // returns 202 + jobId
export const getStats        = () => api.get('/dashboard/stats');
export const getTransactions = (params) => api.get('/transactions', { params });
export const linkTransactions   = (ids, note) => api.post('/transactions/link', { ids, note });
export const unlinkTransactions = (matchGroupId) => api.post('/transactions/unlink', { matchGroupId });

// Jobs
export const getJob          = (id)     => api.get(`/jobs/${id}`);
export const listJobs        = (params) => api.get('/jobs', { params });

// Reports
export const listRuns        = ()       => api.get('/reports/runs');
export const getRun          = (id)     => api.get(`/reports/runs/${id}`);
export const getRunRows      = (id, params) => api.get(`/reports/runs/${id}/rows`, { params });
export const runCsvUrl       = (id)     => `/api/reports/runs/${id}/csv`;

// Audit
export const listAudit       = (params) => api.get('/audit', { params });

export default api;
