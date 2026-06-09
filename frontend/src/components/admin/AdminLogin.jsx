import React, { useState } from 'react'
import { authService, saveAuth } from '../../services/auth'
import brainiumLogo from '../../assets/brainium-logo.png'

export default function AdminLogin({ onLogin, switchToUserLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const resp = await authService.login({ email, password })
      if (resp?.data?.access_token && resp.data.user.role === 'admin') {
        saveAuth(resp.data.access_token, resp.data.user)
        onLogin(resp.data.user)
      } else if (resp?.data?.access_token) {
        setError('This account does not have admin privileges')
      } else {
        setError('Invalid login response')
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-container">
        <div className="auth-brand-panel auth-brand-panel--admin">
          <div className="auth-brand-logo auth-brand-logo-wrap">
            <img
              src={brainiumLogo}
              alt="Brainium"
              onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'inline-flex' }}
            />
            <span className="auth-brand-text-fallback">Brainium</span>
          </div>
          <div className="auth-brand-content">
            <h2>Brainium Admin Portal</h2>
            <p>Track estimator activity, project scope, and fixed-cost proposal history.</p>
          </div>
          <div className="auth-brand-features">
            <div className="auth-feature-item"><span className="auth-feature-dot auth-feature-dot--purple" />View all users and estimates</div>
            <div className="auth-feature-item"><span className="auth-feature-dot auth-feature-dot--purple" />Monitor project values</div>
            <div className="auth-feature-item"><span className="auth-feature-dot auth-feature-dot--purple" />Export reports as CSV</div>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-card">
            <div className="auth-form-header">
              <div className="auth-admin-badge">Admin Access</div>
              <h3>Admin Sign In</h3>
              <p>Enter your admin credentials</p>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={submit} className="auth-form">
              <div className="auth-field">
                <label>Admin Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@brainium.local"
                  required
                />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <div className="auth-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
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
              <button className="auth-submit-btn auth-submit-btn--purple" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Admin Sign In'}
              </button>
            </form>

            <div className="auth-form-footer">
              {switchToUserLogin && (
                <p>
                  <button type="button" className="auth-link-btn" onClick={switchToUserLogin}>← Back to Estimator Login</button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
