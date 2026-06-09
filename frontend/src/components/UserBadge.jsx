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
      <span className="user-display-name">{user.full_name}</span>
      <button className="btn btn-ghost" onClick={logout}>Logout</button>
    </div>
  )
}
