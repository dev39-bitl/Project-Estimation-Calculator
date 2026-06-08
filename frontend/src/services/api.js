import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000/api'

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
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('current_user')
      window.location.href = '/'
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
  deleteEstimate: (id) => api.delete(`/estimates/${id}`),
  getEstimateBreakdown: (id) => api.get(`/estimates/${id}/breakdown`),
  markCommentsRead: (id) => api.patch(`/estimates/${id}/comments/read`),
  fileUrl: (fileId) => `${API_BASE_URL}/files/${fileId}`,
}

export default api
