import axios from 'axios'
import { API_BASE_URL } from '../config/apiConfig'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

const TOKEN_KEYS = ['access_token', 'authToken', 'token']

function getStoredToken() {
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key)
    if (value) return value
  }
  return ''
}

function clearStoredAuth() {
  TOKEN_KEYS.forEach(k => localStorage.removeItem(k))
  localStorage.removeItem('current_user')
}
// Attach token if present
api.interceptors.request.use(config => {
  const token = getStoredToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    // Log error details for debugging
    console.error('[API Error]', {
      url: err.config?.url,
      status: err.response?.status,
      message: err.message,
      data: err.response?.data,
    })

    const requestUrl = String(err.config?.url || '')
    const isAuthRoute = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/signup')

    const status = err.response?.status
    const detail = err.response?.data?.detail
    const detailText = typeof detail === 'string' ? detail.toLowerCase() : JSON.stringify(detail || '').toLowerCase()
    const isUnauthorized403 = status === 403 && (
      detailText.includes('unauthorized') ||
      detailText.includes('expired') ||
      detailText.includes('invalid token') ||
      detailText.includes('not authenticated')
    )

    // Only logout on explicit auth failures.
    if ((status === 401 || isUnauthorized403) && !isAuthRoute) {
      console.warn('[API] Auth failed - logging out user')
      clearStoredAuth()
      window.location.href = '/'
    }

    // If backend is unreachable - DO NOT logout, just report
    if (!err.response && err.message === 'Network Error') {
      console.error(`[API Error] Cannot connect to server at ${API_BASE_URL}`)
      console.error('[API Error] Check that the backend API is running and accessible.')
    }

    return Promise.reject(err)
  }
)

export const estimateAPI = {
  createEstimate: async (data) => {
    const url = `${API_BASE_URL}/estimates`
    console.log('[Estimate API] POST', url)
    console.log('[Estimate API] payload:', data)
    try {
      const res = await api.post('/estimates', data)
      console.log('[Estimate API] status:', res.status)
      return res
    } catch (err) {
      console.error('[Estimate API] save error status:', err.response?.status)
      console.error('[Estimate API] save error body:', err.response?.data)
      throw err
    }
  },
  getEstimate: (id) => api.get(`/estimates/${id}`),
  getAllEstimates: async (skip = 0, limit = 100) => {
    const url = `${API_BASE_URL}/estimates?skip=${skip}&limit=${limit}`
    console.log('[Estimate API] GET', url)
    const res = await api.get('/estimates', { params: { skip, limit } })
    console.log('[Estimate API] status:', res.status)
    return res
  },
  getDashboardSummary: () => api.get('/dashboard/summary'),
  updateEstimate: async (id, data) => {
    const url = `${API_BASE_URL}/estimates/${id}`
    console.log('[Estimate API] PUT', url)
    console.log('[Estimate API] payload:', data)
    try {
      const res = await api.put(`/estimates/${id}`, data)
      console.log('[Estimate API] status:', res.status)
      return res
    } catch (err) {
      console.error('[Estimate API] update error status:', err.response?.status)
      console.error('[Estimate API] update error body:', err.response?.data)
      throw err
    }
  },
  updateEstimateStatus: (id, status) => api.patch(`/estimates/${id}/status`, { status }),
  createDraft: async (data) => {
    const url = `${API_BASE_URL}/estimates/draft`
    console.log('[Estimate API] POST', url)
    try {
      const res = await api.post('/estimates/draft', data)
      console.log('[Estimate API] draft create status:', res.status)
      return res
    } catch (err) {
      console.error('[Estimate API] draft create error status:', err.response?.status)
      console.error('[Estimate API] draft create error body:', err.response?.data)
      throw err
    }
  },
  updateDraft: async (id, data) => {
    const url = `${API_BASE_URL}/estimates/${id}/draft`
    console.log('[Estimate API] PUT', url)
    try {
      const res = await api.put(`/estimates/${id}/draft`, data)
      console.log('[Estimate API] draft update status:', res.status)
      return res
    } catch (err) {
      console.error('[Estimate API] draft update error status:', err.response?.status)
      console.error('[Estimate API] draft update error body:', err.response?.data)
      throw err
    }
  },
  deleteEstimate: (id) => api.delete(`/estimates/${id}`),
  getEstimateBreakdown: (id) => api.get(`/estimates/${id}/breakdown`),
  markCommentsRead: (id) => api.patch(`/estimates/${id}/comments/read`),
  listEstimateFiles: (id) => api.get(`/estimates/${id}/files`),
  uploadEstimateFiles: (id, files, uploadComment = '') => {
    const formData = new FormData()
    ;(files || []).forEach((file) => formData.append('files', file))
    if (uploadComment && uploadComment.trim()) {
      formData.append('upload_comment', uploadComment.trim())
    }
    return api.post(`/estimates/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteEstimateFile: (estimateId, fileId) => api.delete(`/estimates/${estimateId}/files/${fileId}`),
  fileUrl: (fileId) => {
    // Construct file URL using the same API base URL
    // API_BASE_URL already includes /api, so we need to go up one level
    const baseWithoutApi = API_BASE_URL.replace('/api', '')
    return `${baseWithoutApi}/api/files/${fileId}`
  },
}

export default api
