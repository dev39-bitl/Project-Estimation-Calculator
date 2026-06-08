import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const estimateAPI = {
  createEstimate: (data) => api.post('/api/estimates/', data),
  getEstimate: (id) => api.get(`/api/estimates/${id}`),
  getAllEstimates: (skip = 0, limit = 10) => api.get('/api/estimates/', { params: { skip, limit } }),
  updateEstimate: (id, data) => api.put(`/api/estimates/${id}`, data),
  deleteEstimate: (id) => api.delete(`/api/estimates/${id}`),
}

export default api
