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
    <div className="user-badge">
      <div className="user-info">
        <div className="user-name">{user.full_name}</div>
        <div className="user-email muted">{user.email}</div>
      </div>
      <button className="btn btn-ghost" onClick={logout}>Logout</button>
    </div>
  )
}
