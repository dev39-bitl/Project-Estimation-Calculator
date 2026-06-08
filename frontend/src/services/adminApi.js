import api from './api'

export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard'),
  users: () => api.get('/admin/users'),
  blockUser: (id) => api.patch(`/admin/users/${id}/block`),
  unblockUser: (id) => api.patch(`/admin/users/${id}/unblock`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  bulkDeleteUsers: (ids) => api.post('/admin/users/bulk-delete', { ids }),
  estimates: () => api.get('/admin/estimates'),
  estimate: (id) => api.get(`/admin/estimates/${id}`),
  deleteEstimate: (id) => api.delete(`/admin/estimates/${id}`),
  bulkDeleteEstimates: (ids) => api.post('/admin/estimates/bulk-delete', { ids }),
  lockEstimate: (id) => api.patch(`/admin/estimates/${id}/lock`),
  unlockEstimate: (id) => api.patch(`/admin/estimates/${id}/unlock`),
  updateEstimateStatus: (id, status) => api.patch(`/admin/estimates/${id}/status`, { status }),
  addComment: (id, comment_text, file = null) => {
    const formData = new FormData()
    formData.append('comment_text', comment_text)
    if (file) {
      formData.append('file', file)
    }
    return api.post(`/admin/estimates/${id}/comments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  exportUsersCsv: () => api.get('/admin/reports/users.csv'),
  exportEstimatesCsv: () => api.get('/admin/reports/estimates.csv'),
}

export default adminAPI
