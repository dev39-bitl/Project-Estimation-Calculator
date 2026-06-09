import React, { useEffect, useState } from 'react'
import { authService } from '../../services/auth'

const PASSWORD_RULES = [
  { test: (value) => value.length >= 8, message: 'At least 8 characters' },
  { test: (value) => /[A-Z]/.test(value), message: 'At least one uppercase letter' },
  { test: (value) => /[a-z]/.test(value), message: 'At least one lowercase letter' },
  { test: (value) => /\d/.test(value), message: 'At least one number' },
  { test: (value) => /[^A-Za-z0-9]/.test(value), message: 'At least one special character' },
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

function validateNewPassword(value) {
  if (!value) return 'New password is required.'
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(value)) return `New password must include ${rule.message.toLowerCase()}.`
  }
  return ''
}

export default function AdminProfile({ onProfileUpdated }) {
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const [fieldErrors, setFieldErrors] = useState({})

  const loadProfile = async () => {
    setLoading(true)
    try {
      const res = await authService.getProfile()
      setFullName(res.data?.full_name || '')
      setEmail(res.data?.email || '')
    } catch (err) {
      setProfileError(err.response?.data?.detail || 'Failed to load profile.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const submitProfile = async (e) => {
    e.preventDefault()
    const fullNameError = validateFullName(fullName)
    const emailError = validateEmail(email)
    setFieldErrors(prev => ({ ...prev, fullName: fullNameError, email: emailError }))
    if (fullNameError || emailError) return

    setSavingProfile(true)
    setProfileError('')
    setProfileSuccess('')
    try {
      await authService.updateProfile(fullName.trim())
      setProfileSuccess('Profile updated successfully.')
      const res = await authService.getProfile()
      const updatedUser = res?.data
      if (updatedUser) {
        localStorage.setItem('current_user', JSON.stringify(updatedUser))
        if (onProfileUpdated) onProfileUpdated(updatedUser)
      }
    } catch (err) {
      setProfileError(err.response?.data?.detail || 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const submitPassword = async (e) => {
    e.preventDefault()

    const nextErrors = {}
    if (!currentPassword.trim()) {
      nextErrors.currentPassword = 'Current password is required.'
    }

    const newPasswordError = validateNewPassword(newPassword)
    if (newPasswordError) nextErrors.newPassword = newPasswordError

    if (!confirmNewPassword) {
      nextErrors.confirmNewPassword = 'Confirm new password is required.'
    } else if (newPassword !== confirmNewPassword) {
      nextErrors.confirmNewPassword = 'Confirm new password must match new password.'
    }

    setFieldErrors(prev => ({ ...prev, ...nextErrors }))
    if (Object.keys(nextErrors).length > 0) return

    setSavingPassword(true)
    setPasswordError('')
    setPasswordSuccess('')
    try {
      await authService.updatePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      })
      setPasswordSuccess('Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (err) {
      setPasswordError(err.response?.data?.detail || 'Failed to change password.')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return <div className="ap-card">Loading profile...</div>
  }

  return (
    <div className="ap-content">
      <h2 style={{ marginBottom: '16px' }}>My Profile</h2>
      <div className="admin-profile-grid">
      <div className="ap-card">
        <h3>My Profile</h3>
        {profileError && <div className="ap-alert ap-alert--error" style={{ marginBottom: 12 }}>{profileError}</div>}
        {profileSuccess && <div className="ap-alert ap-alert--success" style={{ marginBottom: 12 }}>{profileSuccess}</div>}

        <form onSubmit={submitProfile} className="ap-form">
          <div className="ap-form-field">
            <label>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => {
                const next = e.target.value
                setFullName(next)
                setFieldErrors(prev => ({ ...prev, fullName: validateFullName(next) }))
              }}
              placeholder="Your full name"
            />
            {fieldErrors.fullName && <div className="ap-field-error">{fieldErrors.fullName}</div>}
          </div>

          <div className="ap-form-field">
            <label>Email Address</label>
            <input type="email" value={email} disabled readOnly />
          </div>

          <button type="submit" className="btn-gradient" disabled={savingProfile}>
            {savingProfile ? 'Updating...' : 'Update Profile'}
          </button>
        </form>
      </div>

      <div className="ap-card">
        <h3>Change Password</h3>
        {passwordError && <div className="ap-alert ap-alert--error" style={{ marginBottom: 12 }}>{passwordError}</div>}
        {passwordSuccess && <div className="ap-alert ap-alert--success" style={{ marginBottom: 12 }}>{passwordSuccess}</div>}

        <form onSubmit={submitPassword} className="ap-form">
          <div className="ap-form-field">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => {
                const next = e.target.value
                setCurrentPassword(next)
                setFieldErrors(prev => ({
                  ...prev,
                  currentPassword: next.trim() ? '' : 'Current password is required.',
                }))
              }}
              placeholder="Current password"
            />
            {fieldErrors.currentPassword && <div className="ap-field-error">{fieldErrors.currentPassword}</div>}
          </div>

          <div className="ap-form-field">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => {
                const next = e.target.value
                setNewPassword(next)
                setFieldErrors(prev => ({ ...prev, newPassword: validateNewPassword(next) }))
              }}
              placeholder="New password"
            />
            {fieldErrors.newPassword && <div className="ap-field-error">{fieldErrors.newPassword}</div>}
          </div>

          <div className="ap-form-field">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={e => {
                const next = e.target.value
                setConfirmNewPassword(next)
                setFieldErrors(prev => ({
                  ...prev,
                  confirmNewPassword: next
                    ? (next === newPassword ? '' : 'Confirm new password must match new password.')
                    : 'Confirm new password is required.',
                }))
              }}
              placeholder="Confirm new password"
            />
            {fieldErrors.confirmNewPassword && <div className="ap-field-error">{fieldErrors.confirmNewPassword}</div>}
          </div>

          <button type="submit" className="btn-gradient" disabled={savingPassword}>
            {savingPassword ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  </div>
)
}
