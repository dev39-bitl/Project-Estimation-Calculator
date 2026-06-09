/**
 * Centralized API Configuration
 * Handles environment-aware API base URL for both localhost and live server
 */

// Detect if running on localhost
const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

/**
 * API_BASE_URL - Dynamically set based on environment
 * 
 * Priority:
 * 1. Environment variable (VITE_API_BASE_URL from .env files)
 * 2. Localhost detection: http://localhost:8000/api
 * 3. Live server: {window.location.origin}/api (same domain)
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (isLocalhost
    ? 'http://localhost:8000/api'
    : `${window.location.origin}/api`)

/**
 * Get authorization headers with Bearer token
 */
export function getAuthHeaders() {
  const token = localStorage.getItem('access_token')
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {}
}

/**
 * Log API config for debugging
 */
export function logApiConfig() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[API Config] isLocalhost:', isLocalhost)
    console.log('[API Config] API_BASE_URL:', API_BASE_URL)
    console.log('[API Config] window.location.origin:', window.location.origin)
    console.log('[API Config] VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || 'not set')
  }
}

// Log on first import
logApiConfig()
