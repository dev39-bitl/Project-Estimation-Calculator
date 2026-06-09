import React, { useEffect, useMemo, useState } from 'react'
import { estimateAPI } from '../services/api'

const STATUS_ORDER = [
  'Draft',
  'Estimation Initiation',
  'Client Review',
  'Client Feedback',
  'Revised Estimate',
  'Approved Internally',
  'Project Awarded',
  'On Hold',
  'Canceled',
  'Closed',
]

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function DashboardSummary({ refreshKey, onAddNew }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)

  const loadSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await estimateAPI.getDashboardSummary()
      setSummary(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load dashboard summary.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [refreshKey])

  const statusBreakdown = useMemo(() => {
    const source = summary?.status_breakdown || {}
    return STATUS_ORDER.map((status) => ({
      status,
      count: Number(source[status] || 0),
    }))
  }, [summary])

  if (loading) {
    return <div className="card">Loading dashboard summary...</div>
  }

  if (error) {
    return <div className="error-message" style={{ marginBottom: 12 }}>{error}</div>
  }

  return (
    <section className="dashboard-summary card">
      <div className="dashboard-summary-head">
        <h3>Estimator Dashboard Summary</h3>
        <div className="dashboard-summary-actions">
          <button className="cta-gradient" onClick={onAddNew}>Add New Estimate</button>
        </div>
      </div>

      <div className="dashboard-summary-grid">
        <article className="summary-tile"><h4>Total Estimates</h4><p>{summary?.total_estimates || 0}</p></article>
        <article className="summary-tile"><h4>Draft Estimates</h4><p>{summary?.draft_count || 0}</p></article>
        <article className="summary-tile"><h4>Active / Editable</h4><p>{summary?.editable_count || 0}</p></article>
        <article className="summary-tile"><h4>Locked Estimates</h4><p>{summary?.locked_count || 0}</p></article>
        <article className="summary-tile"><h4>Total Estimated Hours</h4><p>{Number(summary?.total_hours || 0).toFixed(2)}h</p></article>
        <article className="summary-tile"><h4>Total Final Fixed Cost</h4><p>${formatMoney(summary?.total_fixed_cost)}</p></article>
        <article className="summary-tile summary-tile-wide">
          <h4>Latest Updated Estimate</h4>
          {summary?.latest_estimate ? (
            <p>
              {summary.latest_estimate.name} ({summary.latest_estimate.status || 'Estimation Initiation'})
            </p>
          ) : (
            <p>No estimates yet.</p>
          )}
        </article>
      </div>

      <div className="status-breakdown">
        <h4>Status Breakdown</h4>
        <div className="status-badges">
          {statusBreakdown.map(item => (
            <span key={item.status} className="status-pill">
              {item.status}: {item.count}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
