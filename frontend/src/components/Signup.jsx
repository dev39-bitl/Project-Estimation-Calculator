import React, { useState } from 'react'
import { authService } from '../services/auth'
import brainiumLogo from '../assets/brainium-logo.png'

const PASSWORD_RULES = [
  { test: (value) => value.length >= 8, message: 'Password must be at least 8 characters.' },
  { test: (value) => /[A-Z]/.test(value), message: 'Password must include at least one uppercase letter.' },
  { test: (value) => /[a-z]/.test(value), message: 'Password must include at least one lowercase letter.' },
  { test: (value) => /\d/.test(value), message: 'Password must include at least one number.' },
  { test: (value) => /[^A-Za-z0-9]/.test(value), message: 'Password must include at least one special character.' },
]

function validateFullName(value) {
  const cleaned = String(value || '').trim()
  if (!cleaned) return 'Full name is required.'
  if (cleaned.length < 2) return 'Full name must be at least 2 characters.'
  return ''
}

function validateEmail(value) {
  const raw = String(value || '')
  const cleaned = raw.trim()
  if (!cleaned) return 'Email is required.'
  if (raw.includes(' ')) return 'Email must not contain spaces.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return 'Enter a valid email address.'
  return ''
}

function validatePassword(value) {
  if (!value) return 'Password is required.'
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(value)) return rule.message
  }
  return ''
}

function extractBackendError(detail) {
  if (!detail) return 'Signup failed.'
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (typeof first === 'string') return first
    if (first?.msg) return first.msg
  }
  return 'Signup failed.'
}

export default function Signup({ onSignup, switchToLogin, switchToVerify }) {
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
    next.fullName = validateFullName(fullName)
    next.email = validateEmail(email)
    next.password = validatePassword(password)
    if (!confirmPassword) next.confirmPassword = 'Confirm password is required.'
    else if (password !== confirmPassword) next.confirmPassword = 'Confirm password must match password.'

    Object.keys(next).forEach(key => {
      if (!next[key]) delete next[key]
    })

    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) {
      setError('Please fix the highlighted fields.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const resp = await authService.signup({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
      if (resp?.data?.id) {
        // Signup succeeded → show email verification screen
        if (switchToVerify) {
          switchToVerify(email.trim().toLowerCase())
        }
      } else {
        setError('Signup failed')
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail === 'An account with this email already exists.') {
        setError('An account with this email already exists.')
      } else if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Cannot connect to server. Please make sure the backend is running.')
      } else {
        setError(extractBackendError(detail))
      }
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
            <div className="auth-mobile-logo-wrap">
              <div className="auth-mobile-logo-box">
                {!logoFailed ? (
                  <img src={brainiumLogo} alt="Brainium" onError={() => setLogoFailed(true)} />
                ) : (
                  <span className="auth-mobile-logo-fallback">Brainium</span>
                )}
              </div>
            </div>
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
                    const next = e.target.value
                    setFullName(next)
                    setFieldErrors(prev => ({ ...prev, fullName: validateFullName(next) }))
                  }}
                  onBlur={() => setFieldErrors(prev => ({ ...prev, fullName: validateFullName(fullName) }))}
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
                    const next = e.target.value
                    setEmail(next)
                    setFieldErrors(prev => ({ ...prev, email: validateEmail(next) }))
                  }}
                  onBlur={() => setFieldErrors(prev => ({ ...prev, email: validateEmail(email) }))}
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
                      const next = e.target.value
                      setPassword(next)
                      setFieldErrors(prev => ({
                        ...prev,
                        password: validatePassword(next),
                        confirmPassword: confirmPassword
                          ? (confirmPassword === next ? '' : 'Confirm password must match password.')
                          : prev.confirmPassword,
                      }))
                    }}
                    onBlur={() => setFieldErrors(prev => ({ ...prev, password: validatePassword(password) }))}
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
                    const next = e.target.value
                    setConfirmPassword(next)
                    setFieldErrors(prev => ({
                      ...prev,
                      confirmPassword: !next
                        ? 'Confirm password is required.'
                        : (next === password ? '' : 'Confirm password must match password.'),
                    }))
                  }}
                  onBlur={() => setFieldErrors(prev => ({
                    ...prev,
                    confirmPassword: !confirmPassword
                      ? 'Confirm password is required.'
                      : (confirmPassword === password ? '' : 'Confirm password must match password.'),
                  }))}
                  placeholder="••••••••"
                  required
                />
                {fieldErrors.confirmPassword && <div className="auth-field-error">{fieldErrors.confirmPassword}</div>}
              </div>
              <button className="auth-submit-btn form-submit-btn" type="submit" disabled={loading}>
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
