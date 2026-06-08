import React, { useEffect, useState } from 'react'
import { adminAPI } from '../../services/adminApi'

export default function AdminDashboard({ onViewEstimate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    adminAPI.dashboard()
      .then(r => { if (mounted) setData(r.data) })
      .catch(() => { if (mounted) setError('Failed to load dashboard data') })
    return () => { mounted = false }
  }, [])

  if (error) return <div className="ap-alert ap-alert--error">{error}</div>
  if (!data) return <div className="ap-loading">Loading dashboard…</div>

  return (
    <div className="ap-dashboard">
      <div className="ap-metric-grid">
        <div className="ap-metric-card">
          <div className="ap-metric-icon ap-metric-icon--blue">👥</div>
          <div className="ap-metric-body">
            <div className="ap-metric-label">Total Users</div>
            <div className="ap-metric-value">{data.total_users}</div>
          </div>
        </div>
        <div className="ap-metric-card">
          <div className="ap-metric-icon ap-metric-icon--green">📋</div>
          <div className="ap-metric-body">
            <div className="ap-metric-label">Total Estimates</div>
            <div className="ap-metric-value">{data.total_estimates}</div>
          </div>
        </div>
        <div className="ap-metric-card">
          <div className="ap-metric-icon ap-metric-icon--purple">💰</div>
          <div className="ap-metric-body">
            <div className="ap-metric-label">Total Project Value</div>
            <div className="ap-metric-value">${Number(data.total_value || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="ap-card">
        <div className="ap-card-header">
          <h3 className="ap-card-title">Recent Estimates</h3>
        </div>
        {(data.recent_estimates || []).length === 0 ? (
          <p className="ap-empty">No estimates yet.</p>
        ) : (
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Project Name</th>
                  <th>Client</th>
                  <th>Created By</th>
                  <th>Value</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data.recent_estimates || []).map(e => (
                  <tr key={e.id}>
                    <td className="ap-td-muted">#{e.id}</td>
                    <td><strong>{e.name}</strong></td>
                    <td>{e.client_name || '—'}</td>
                    <td>{e.created_by_name || '—'}</td>
                    <td className="ap-td-value">${Number(e.total_fixed_cost || 0).toLocaleString()}</td>
                    <td className="ap-td-muted">{e.created_at ? new Date(e.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <button className="ap-btn ap-btn--sm" onClick={() => onViewEstimate && onViewEstimate(e.id)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
