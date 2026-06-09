import React, { useEffect, useRef, useState } from 'react'
import { authService, saveAuth } from '../services/auth'
import brainiumLogo from '../assets/brainium-logo.png'

export default function VerifyEmail({ email: initialEmail, switchToLogin, onVerified }) {
  const [email, setEmail] = useState(initialEmail || '')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [logoFailed, setLogoFailed] = useState(false)
  const countdownRef = useRef(null)

  // Start resend cooldown
  const startCountdown = (seconds = 60) => {
    setResendCountdown(seconds)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!code.trim() || code.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.')
      return
    }
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await authService.verifyEmail(email.trim(), code.trim())
      setSuccess('Email verified! Signing you in…')
      // Auto-login after verification
      try {
        const loginResp = await authService.login({ email: email.trim(), password: '__verify_redirect__' })
        if (loginResp?.data?.access_token) {
          saveAuth(loginResp.data.access_token, loginResp.data.user)
          onVerified && onVerified(loginResp.data.user)
          return
        }
      } catch (_) {
        // Login failed (wrong password fallback) — just redirect to login
      }
      setSuccess('Email verified successfully! Please log in.')
      setTimeout(() => switchToLogin && switchToLogin(), 1800)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(detail || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCountdown > 0 || resending) return
    setError('')
    setSuccess('')
    setResending(true)
    try {
      await authService.resendVerificationCode(email.trim())
      setSuccess('A new verification code has been sent to your email.')
      startCountdown(60)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(detail || 'Could not resend code. Please try again later.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-container">
        {/* Left brand panel */}
        <div className="auth-brand-panel">
          <div className="auth-brand-logo auth-brand-logo-wrap">
            {!logoFailed && (
              <img
                src={brainiumLogo}
                alt="Brainium"
                onError={() => setLogoFailed(true)}
              />
            )}
            <span className="auth-brand-text-fallback" style={{ display: logoFailed ? 'inline-flex' : 'none' }}>
              Brainium
            </span>
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

        {/* Right form panel */}
        <div className="auth-form-panel">
          <div className="auth-form-card">
            <div className="auth-form-header">
              <h3>Verify your email</h3>
              <p>
                We sent a 6-digit code to{' '}
                <strong style={{ color: '#00AEEF' }}>{email}</strong>.
                Enter it below to activate your account.
              </p>
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

            {success && (
              <div className="auth-success">
                {success}
              </div>
            )}

            <form onSubmit={handleVerify} className="auth-form">
              <div className="auth-field">
                <label>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div className="auth-field">
                <label>Verification code</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(val)
                    if (error) setError('')
                  }}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  style={{ letterSpacing: '0.25em', fontSize: '1.35rem', textAlign: 'center' }}
                  required
                />
              </div>

              <button className="auth-submit-btn form-submit-btn" type="submit" disabled={loading || !!success}>
                {loading ? 'Verifying…' : 'Verify Email'}
              </button>
            </form>

            <div className="auth-form-footer">
              <p>
                Didn&apos;t receive the code?{' '}
                <button
                  type="button"
                  className="cta-gradient auth-resend-btn"
                  onClick={handleResend}
                  disabled={resendCountdown > 0 || resending}
                >
                  {resending
                    ? 'Sending…'
                    : resendCountdown > 0
                      ? `Resend in ${resendCountdown}s`
                      : 'Resend code'}
                </button>
              </p>
              <p>
                <button type="button" className="auth-link-btn" onClick={() => switchToLogin && switchToLogin()}>
                  ← Back to Login
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
