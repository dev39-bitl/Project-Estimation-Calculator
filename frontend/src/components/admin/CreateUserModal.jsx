import React, { useState } from 'react'
import { adminAPI } from '../../services/adminApi'

const PASSWORD_RULES = [
  { regex: /.{8,}/, text: '8+ characters' },
  { regex: /[A-Z]/, text: 'Uppercase letter' },
  { regex: /[a-z]/, text: 'Lowercase letter' },
  { regex: /[0-9]/, text: 'Number' },
  { regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, text: 'Special character' },
]

function validatePassword(password) {
  const errors = []
  for (const rule of PASSWORD_RULES) {
    if (!rule.regex.test(password)) {
      errors.push(rule.text)
    }
  }
  return errors
}

export default function CreateUserModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    role: 'estimator',
    is_active: true,
    is_email_verified: true,
  })
  const [fieldErrors, setFieldErrors] = useState({})

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value
    setFormData(prev => ({
      ...prev,
      [name]: newValue,
    }))
    // Clear field error on change
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const updated = { ...prev }
        delete updated[name]
        return updated
      })
    }
  }

  const handleBlur = (e) => {
    const { name, value, type, checked } = e.target
    const actualValue = type === 'checkbox' ? checked : value

    const newErrors = { ...fieldErrors }

    if (name === 'full_name') {
      const trimmed = String(value).trim()
      if (!trimmed) {
        newErrors.full_name = 'Full name is required'
      } else if (trimmed.length < 2) {
        newErrors.full_name = 'Full name must be at least 2 characters'
      } else {
        delete newErrors.full_name
      }
    }

    if (name === 'email') {
      const email = String(value).trim().toLowerCase()
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!email) {
        newErrors.email = 'Email is required'
      } else if (!emailRegex.test(email)) {
        newErrors.email = 'Invalid email format'
      } else {
        delete newErrors.email
      }
    }

    if (name === 'password') {
      const errors = validatePassword(String(value))
      if (errors.length > 0) {
        newErrors.password = `Password missing: ${errors.join(', ')}`
      } else {
        delete newErrors.password
      }
    }

    if (name === 'confirm_password') {
      if (String(value) !== formData.password) {
        newErrors.confirm_password = 'Passwords do not match'
      } else {
        delete newErrors.confirm_password
      }
    }

    setFieldErrors(newErrors)
  }

  const validateForm = () => {
    const newErrors = {}

    const fullNameTrimmed = String(formData.full_name).trim()
    if (!fullNameTrimmed) {
      newErrors.full_name = 'Full name is required'
    } else if (fullNameTrimmed.length < 2) {
      newErrors.full_name = 'Full name must be at least 2 characters'
    }

    const email = String(formData.email).trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Invalid email format'
    }

    const passwordErrors = validatePassword(String(formData.password))
    if (passwordErrors.length > 0) {
      newErrors.password = `Password must include: ${passwordErrors.join(', ')}`
    }

    if (String(formData.confirm_password) !== formData.password) {
      newErrors.confirm_password = 'Passwords do not match'
    }

    setFieldErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      await adminAPI.createUser({
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        confirm_password: formData.confirm_password,
        role: formData.role,
        is_active: formData.is_active,
        is_email_verified: formData.is_email_verified,
      })

      // Reset form
      setFormData({
        full_name: '',
        email: '',
        password: '',
        confirm_password: '',
        role: 'estimator',
        is_active: true,
        is_email_verified: true,
      })
      setFieldErrors({})

      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to create user'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New User</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="ap-alert ap-alert--error" style={{ marginBottom: 12 }}>{error}</div>}

          <form onSubmit={handleSubmit} className="ap-form">
            <div className="ap-form-field">
              <label htmlFor="full_name">Full Name *</label>
              <input
                id="full_name"
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="John Doe"
                disabled={loading}
              />
              {fieldErrors.full_name && <div className="ap-field-error">{fieldErrors.full_name}</div>}
            </div>

            <div className="ap-form-field">
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="user@example.com"
                disabled={loading}
              />
              {fieldErrors.email && <div className="ap-field-error">{fieldErrors.email}</div>}
            </div>

            <div className="ap-form-field">
              <label htmlFor="password">Temporary Password *</label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter temporary password"
                disabled={loading}
              />
              {fieldErrors.password && <div className="ap-field-error">{fieldErrors.password}</div>}
            </div>

            <div className="ap-form-field">
              <label htmlFor="confirm_password">Confirm Password *</label>
              <input
                id="confirm_password"
                type="password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Confirm temporary password"
                disabled={loading}
              />
              {fieldErrors.confirm_password && <div className="ap-field-error">{fieldErrors.confirm_password}</div>}
            </div>

            <div className="ap-form-field">
              <label htmlFor="role">Role *</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={loading}
                style={{ padding: '11px 14px', borderRadius: '10px', border: '1px solid #d5dbe5', background: '#f8fafc', color: '#1e293b' }}
              >
                <option value="estimator">Estimator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  disabled={loading}
                />
                <span>Active Account</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="is_email_verified"
                  checked={formData.is_email_verified}
                  onChange={handleChange}
                  disabled={loading}
                />
                <span>Email Already Verified</span>
              </label>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn-gradient"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}
