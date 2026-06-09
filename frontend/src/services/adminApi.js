import api from './api'
import { getAuthHeaders } from '../config/apiConfig'

function authConfig(extra = {}) {
  return {
    ...extra,
    headers: {
      ...getAuthHeaders(),
      ...(extra.headers || {}),
    },
  }
}

export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard', authConfig()),
  users: () => api.get('/admin/users', authConfig()),
  createUser: (data) => api.post('/admin/users', data, authConfig()),
  blockUser: (id) => api.patch(`/admin/users/${id}/block`, null, authConfig()),
  unblockUser: (id) => api.patch(`/admin/users/${id}/unblock`, null, authConfig()),
  deleteUser: (id) => api.delete(`/admin/users/${id}`, authConfig()),
  bulkDeleteUsers: (ids) => api.post('/admin/users/bulk-delete', { ids }, authConfig()),
  estimates: () => api.get('/admin/estimates', authConfig()),
  estimate: (id) => api.get(`/admin/estimates/${id}`, authConfig()),
  deleteEstimate: (id) => api.delete(`/admin/estimates/${id}`, authConfig()),
  bulkDeleteEstimates: (ids) => api.post('/admin/estimates/bulk-delete', { ids }, authConfig()),
  lockEstimate: (id) => api.patch(`/admin/estimates/${id}/lock`, null, authConfig()),
  unlockEstimate: (id) => api.patch(`/admin/estimates/${id}/unlock`, null, authConfig()),
  updateEstimateStatus: (id, status) => api.patch(`/admin/estimates/${id}/status`, { status }, authConfig()),
  addComment: (id, comment_text, file = null) => {
    const formData = new FormData()
    formData.append('comment_text', comment_text)
    if (file) {
      formData.append('file', file)
    }
    return api.post(`/admin/estimates/${id}/comments`, formData, {
      ...authConfig(),
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  listEstimateFiles: (id) => api.get(`/estimates/${id}/files`, authConfig()),
  uploadEstimateFiles: (id, files, uploadComment = '') => {
    const formData = new FormData()
    ;(files || []).forEach((file) => formData.append('files', file))
    if (uploadComment && uploadComment.trim()) {
      formData.append('upload_comment', uploadComment.trim())
    }
    return api.post(`/estimates/${id}/files`, formData, {
      ...authConfig(),
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  deleteEstimateFile: (estimateId, fileId) => api.delete(`/estimates/${estimateId}/files/${fileId}`, authConfig()),
  exportUsersCsv: () => api.get('/admin/reports/users.csv', authConfig()),
  exportEstimatesCsv: () => api.get('/admin/reports/estimates.csv', authConfig()),
}

export default adminAPI
