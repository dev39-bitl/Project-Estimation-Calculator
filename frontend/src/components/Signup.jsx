import React, { useState } from 'react'
import { authService, saveAuth } from '../services/auth'
import brainiumLogo from '../assets/brainium-logo.png'

export default function Signup({ onSignup, switchToLogin }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  const validate = () => {
    const next = {}
    if (!fullName.trim()) next.fullName = 'Full name is required.'
    if (!email.trim()) {
      next.email = 'Email is required.'
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      next.email = 'Enter a valid email address.'
    }
    if (!password) {
      next.password = 'Password is required.'
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters.'
    }
    if (!confirmPassword) {
      next.confirmPassword = 'Confirm password is required.'
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.'
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!validate()) {
      setError('Please fix the highlighted fields.')
      return
    }
    setLoading(true)
    try {
      const resp = await authService.signup({ full_name: fullName, email, password })
      if (resp?.data?.id) {
        const loginResp = await authService.login({ email, password })
        saveAuth(loginResp.data.access_token, loginResp.data.user)
        onSignup(loginResp.data.user)
      } else {
        setError('Signup failed')
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail === 'This email is already registered.') {
        setError('This email is already registered.')
      } else if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Cannot connect to server. Please make sure the backend is running.')
      } else {
        setError(detail || 'Signup failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-container">
        <div className="auth-brand-panel">
          <div className="auth-brand-logo">
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
              <h3>Create account</h3>
              <p>Register as an estimator</p>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={submit} className="auth-form">
              <div className="auth-field">
                <label>Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => {
                    setFullName(e.target.value)
                    setFieldErrors(prev => ({ ...prev, fullName: '' }))
                    if (error) setError('')
                  }}
                  placeholder="John Smith"
                  required
                />
                {fieldErrors.fullName && <div className="auth-field-error">{fieldErrors.fullName}</div>}
              </div>
              <div className="auth-field">
                <label>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    setFieldErrors(prev => ({ ...prev, email: '' }))
                    if (error) setError('')
                  }}
                  placeholder="you@company.com"
                  required
                />
                {fieldErrors.email && <div className="auth-field-error">{fieldErrors.email}</div>}
              </div>
              <div className="auth-field">
                <label>Password</label>
                <div className="auth-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      setFieldErrors(prev => ({ ...prev, password: '' }))
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
                {fieldErrors.password && <div className="auth-field-error">{fieldErrors.password}</div>}
              </div>
              <div className="auth-field">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value)
                    setFieldErrors(prev => ({ ...prev, confirmPassword: '' }))
                    if (error) setError('')
                  }}
                  placeholder="••••••••"
                  required
                />
                {fieldErrors.confirmPassword && <div className="auth-field-error">{fieldErrors.confirmPassword}</div>}
              </div>
              <button className="auth-submit-btn" type="submit" disabled={loading}>
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>

            <div className="auth-form-footer">
              <p>Already have an account?{' '}
                <button type="button" className="auth-link-btn" onClick={switchToLogin}>Sign in</button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
