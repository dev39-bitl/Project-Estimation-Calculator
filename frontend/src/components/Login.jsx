import React, { useState } from 'react'
import { authService, saveAuth } from '../services/auth'
import brainiumLogo from '../assets/brainium-logo.png'

export default function Login({ onLogin, switchToSignup, switchToAdminLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    // Do NOT clear error here – keep it visible while the new request is in-flight
    try {
      const resp = await authService.login({ email, password })
      if (resp?.data?.access_token) {
        setError('') // Only clear on success
        saveAuth(resp.data.access_token, resp.data.user)
        onLogin(resp.data.user)
      } else {
        setError('Invalid login response from server')
      }
    } catch (err) {
      console.error('[Login Component] Error:', err)
      let errorMsg = 'Invalid email or password.'
      const detail = err.response?.data?.detail
      if (detail === 'Invalid email or password.') {
        errorMsg = 'Invalid email or password.'
      } else if (detail === 'Your account has been disabled by the administrator.') {
        errorMsg = 'Your account has been disabled by the administrator.'
      } else if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        errorMsg = 'Cannot connect to server. Please make sure the backend is running.'
      } else if (err.message) {
        errorMsg = 'Invalid email or password.'
      }
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-container">
        <div className="auth-brand-panel">
          <div className="auth-brand-logo auth-brand-logo-wrap">
            {!logoFailed && (
              <img
                src={brainiumLogo}
                alt="Brainium"
                onError={() => setLogoFailed(true)}
              />
            )}
            <span className="auth-brand-text-fallback" style={{ display: logoFailed ? 'inline-flex' : 'none' }}>Brainium</span>
          </div>
          <div className="auth-brand-content">
            <h2>Brainium Project Estimation Portal</h2>
            <p>Create accurate fixed-cost project estimates based on modules, features, and complexity.</p>
          </div>
          <div className="auth-brand-features">
            <div className="auth-feature-item"><span className="auth-feature-dot" />Feature-based fixed cost estimation</div>
            <div className="auth-feature-item"><span className="auth-feature-dot" />Professional proposal generation</div>
            <div className="auth-feature-item"><span className="auth-feature-dot" />Tech stack complexity analysis</div>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-card">
            <div className="auth-form-header">
              <h3>Welcome back</h3>
              <p>Sign in to your estimator account</p>
            </div>

            {error && (
              <div className="auth-error auth-error--dismissible">
                <span>{error}</span>
                <button
                  type="button"
                  className="auth-error-close"
                  onClick={() => setError('')}
                  aria-label="Dismiss error"
                >×</button>
              </div>
            )}

            <form onSubmit={submit} className="auth-form">
              <div className="auth-field">
                <label>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    if (error) setError('')
                  }}
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <div className="auth-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      if (error) setError('')
                    }}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                  >{showPassword ? '🙈' : '👁️'}</button>
                </div>
              </div>
              <button className="auth-submit-btn" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="auth-form-footer">
              <p>Don't have an account?{' '}
                <button type="button" className="auth-link-btn" onClick={switchToSignup}>Create account</button>
              </p>
              {switchToAdminLogin && (
                <p className="auth-admin-link">
                  <button type="button" className="auth-link-btn" onClick={switchToAdminLogin}>Admin Login →</button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
