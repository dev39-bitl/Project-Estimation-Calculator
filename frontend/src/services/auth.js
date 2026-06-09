import api from './api'

export const authService = {
  signup: (data) => {
    console.log('[Auth] Signup request to:', `${api.defaults.baseURL}/auth/signup`)
    return api.post('/auth/signup', data).then(res => {
      console.log('[Auth] Signup success:', res.status)
      return res
    }).catch(err => {
      console.error('[Auth] Signup error:', err.response?.status, err.response?.data?.detail || err.message)
      throw err
    })
  },
  login: (data) => {
    console.log('[Auth] Login request to:', `${api.defaults.baseURL}/auth/login`, 'email:', data.email)
    return api.post('/auth/login', data).then(res => {
      console.log('[Auth] Login success:', res.status, 'user:', res.data?.user?.email)
      return res
    }).catch(err => {
      console.error('[Auth] Login error:', err.response?.status, err.response?.data?.detail || err.message)
      console.error('[Auth] Full error:', err)
      throw err
    })
  },
  verifyEmail: (email, code) => {
    console.log('[Auth] Verify email request for:', email)
    return api.post('/auth/verify-email', { email, code }).then(res => {
      console.log('[Auth] Verify email success:', res.status)
      return res
    }).catch(err => {
      console.error('[Auth] Verify email error:', err.response?.status, err.response?.data?.detail || err.message)
      throw err
    })
  },
  resendVerificationCode: (email) => {
    console.log('[Auth] Resend verification code for:', email)
    return api.post('/auth/resend-verification-code', { email }).then(res => {
      console.log('[Auth] Resend code success:', res.status)
      return res
    }).catch(err => {
      console.error('[Auth] Resend code error:', err.response?.status, err.response?.data?.detail || err.message)
      throw err
    })
  },
  me: () => api.get('/auth/me'),
}

export function saveAuth(token, user) {
  localStorage.setItem('access_token', token)
  try {
    localStorage.setItem('current_user', JSON.stringify(user))
  } catch (e) { }
}

export function clearAuth() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('current_user')
}
