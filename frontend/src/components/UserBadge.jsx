import React from 'react'
import { clearAuth } from '../services/auth'

export default function UserBadge({ user, onLogout }) {
  const logout = () => {
    clearAuth()
    if (onLogout) onLogout()
    else window.location.href = '/'
  }

  if (!user) return null
  return (
    <div className="user-header-actions">
      <span className="user-display-name user-pill">{user.full_name}</span>
      <button className="header-icon-btn" onClick={logout} title="Logout" aria-label="Logout" type="button">⎋</button>
    </div>
  )
}
