import axios from 'axios'
import { API_BASE_URL, getAuthHeaders } from '../config/apiConfig'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})
// Attach token if present
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
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

    if (err.response && err.response.status === 401 && !isAuthRoute) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('current_user')
      window.location.href = '/'
    }

    // If backend is unreachable
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
  fileUrl: (fileId) => {
    // Construct file URL using the same API base URL
    // API_BASE_URL already includes /api, so we need to go up one level
    const baseWithoutApi = API_BASE_URL.replace('/api', '')
    return `${baseWithoutApi}/api/files/${fileId}`
  },
}

export default api
