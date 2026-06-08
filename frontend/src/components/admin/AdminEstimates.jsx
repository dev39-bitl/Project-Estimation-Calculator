import React, { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '../../services/adminApi'

const PROJECT_STATUSES = [
  'Estimation Initiation',
  'Client Review',
  'Client Feedback',
  'Project Awarded',
  'Canceled',
  'On Hold',
  'Revised Estimate',
  'Approved Internally',
]

function getTimestamp(value) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function statusClass(status) {
  return `ap-status-${String(status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export default function AdminEstimates({ onView, onDeleted }) {
  const [estimates, setEstimates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editableFilter, setEditableFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'updated_at', direction: 'desc' })


  const load = () => {
    setLoading(true)
    adminAPI.estimates()
      .then(r => {
        const items = r.data || []
        setEstimates(items)
        setSelectedIds([])
      })
      .catch(() => setError('Failed to load estimates'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const visibleEstimates = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    const now = Date.now()

    const filtered = estimates.filter(e => {
      const project = String(e.name || '').toLowerCase()
      const client = String(e.client_name || '').toLowerCase()
      const estimator = String(e.created_by_name || '').toLowerCase()
      const status = e.status || 'Estimation Initiation'
      const isEditable = e.is_editable !== false
      const dateValue = getTimestamp(e.updated_at || e.created_at)

      const matchesQuery = !query || project.includes(query) || client.includes(query) || estimator.includes(query)
      const matchesStatus = statusFilter === 'all' || status === statusFilter
      const matchesEditable = editableFilter === 'all' || (editableFilter === 'editable' && isEditable) || (editableFilter === 'locked' && !isEditable)
      const matchesDate = (() => {
        if (dateFilter === 'all') return true
        if (!dateValue) return false
        if (dateFilter === 'today') {
          const d = new Date(dateValue)
          const n = new Date(now)
          return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
        }
        const days = Number(dateFilter)
        return Number.isFinite(days) && dateValue >= now - days * 24 * 60 * 60 * 1000
      })()

      return matchesQuery && matchesStatus && matchesEditable && matchesDate
    })

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      const getValue = (item) => {
        if (sortConfig.key === 'name') return String(item.name || '').toLowerCase()
        if (sortConfig.key === 'client_name') return String(item.client_name || '').toLowerCase()
        if (sortConfig.key === 'estimator') return String(item.created_by_name || '').toLowerCase()
        if (sortConfig.key === 'total_hours') return Number(item.total_estimated_hours || 0)
        if (sortConfig.key === 'final_cost') return Number(item.total_fixed_cost || 0)
        if (sortConfig.key === 'status') return String(item.status || 'Estimation Initiation').toLowerCase()
        if (sortConfig.key === 'editable') return item.is_editable !== false ? 1 : 0
        return getTimestamp(item.updated_at || item.created_at)
      }
      const av = getValue(a)
      const bv = getValue(b)
      if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1
      if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1
      return getTimestamp(b.updated_at || b.created_at) - getTimestamp(a.updated_at || a.created_at)
    })

    return sorted
  }, [estimates, searchText, statusFilter, editableFilter, dateFilter, sortConfig])

  if (loading) return <div className="ap-loading">Loading estimates...</div>
  if (error) return <div className="ap-alert ap-alert--error">{error}</div>

  const toggleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const sortIndicator = (key) => {
    if (sortConfig.key !== key) return ''
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼'
  }

  const handleLock = async (id) => {
    try {
      await adminAPI.lockEstimate(id)
      setActionMsg(`Estimate #${id} locked.`)
      load()
    } catch {
      setActionMsg('Lock failed.')
    }
  }

  const handleUnlock = async (id) => {
    try {
      await adminAPI.unlockEstimate(id)
      setActionMsg(`Estimate #${id} unlocked.`)
      load()
    } catch {
      setActionMsg('Unlock failed.')
    }
  }

  const handleDelete = async (estimate) => {
    if (!window.confirm(`Delete estimate "${estimate.name}"? This cannot be undone.`)) return
    try {
      await adminAPI.deleteEstimate(estimate.id)
      setActionMsg(`Estimate #${estimate.id} deleted.`)
      load()
      onDeleted && onDeleted(estimate.id)
    } catch {
      setActionMsg('Delete failed.')
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    const visibleIds = visibleEstimates.map(e => e.id)
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id))
    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)))
      return
    }
    setSelectedIds(prev => {
      const next = new Set(prev)
      visibleIds.forEach(id => next.add(id))
      return Array.from(next)
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Delete ${selectedIds.length} selected estimate(s)? This cannot be undone.`)) return
    try {
      const res = await adminAPI.bulkDeleteEstimates(selectedIds)
      setActionMsg(`Deleted ${res.data?.deleted ?? 0} estimate(s).`)
      load()
      onDeleted && onDeleted()
    } catch {
      setActionMsg('Bulk delete failed.')
    }
  }

  const clearFilters = () => {
    setSearchText('')
    setStatusFilter('all')
    setEditableFilter('all')
    setDateFilter('all')
    setSortConfig({ key: 'updated_at', direction: 'desc' })
  }

  return (
    <div className="ap-card">
      <div className="ap-card-header ap-card-header--filters">
        <h3 className="ap-card-title">All Estimates</h3>
        <div className="ap-filters">
          <input
            className="ap-filters-search"
            type="text"
            placeholder="Search project, client, estimator"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {PROJECT_STATUSES.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select value={editableFilter} onChange={e => setEditableFilter(e.target.value)}>
            <option value="all">Editable + Locked</option>
            <option value="editable">Editable</option>
            <option value="locked">Locked</option>
          </select>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
          </select>
          <button className="ap-btn ap-btn--sm" onClick={clearFilters}>Clear</button>
          <button className="ap-btn ap-btn--sm ap-btn--danger" onClick={handleBulkDelete} disabled={selectedIds.length === 0}>Delete Selected</button>
        </div>
      </div>

      {actionMsg && <div className="ap-alert ap-alert--info" style={{ margin: '8px 0' }}>{actionMsg}</div>}
      {visibleEstimates.length === 0 ? (
        <p className="ap-empty">No estimates found.</p>
      ) : (
        <div className="ap-table-wrap">
          <table className="ap-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={visibleEstimates.length > 0 && visibleEstimates.every(e => selectedIds.includes(e.id))}
                    onChange={toggleSelectAll}
                    aria-label="Select all estimates"
                  />
                </th>
                <th>ID</th>
                <th className="ap-sortable" onClick={() => toggleSort('name')}>Project Name{sortIndicator('name')}</th>
                <th className="ap-sortable" onClick={() => toggleSort('client_name')}>Client Name{sortIndicator('client_name')}</th>
                <th className="ap-sortable" onClick={() => toggleSort('estimator')}>Estimator{sortIndicator('estimator')}</th>
                <th className="ap-sortable" onClick={() => toggleSort('total_hours')}>Total Hours{sortIndicator('total_hours')}</th>
                <th className="ap-sortable" onClick={() => toggleSort('final_cost')}>Final Fixed Cost{sortIndicator('final_cost')}</th>
                <th>Version</th>
                <th className="ap-sortable" onClick={() => toggleSort('status')}>Project Status{sortIndicator('status')}</th>
                <th>Comments</th>
                <th className="ap-sortable" onClick={() => toggleSort('editable')}>Editable / Locked{sortIndicator('editable')}</th>
                <th className="ap-sortable" onClick={() => toggleSort('updated_at')}>Updated Date{sortIndicator('updated_at')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleEstimates.map(e => (
                <tr key={e.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(e.id)}
                      onChange={() => toggleSelect(e.id)}
                      aria-label={`Select estimate ${e.id}`}
                    />
                  </td>
                  <td className="ap-td-muted">#{e.id}</td>
                  <td><strong>{e.name}</strong></td>
                  <td>{e.client_name || '-'}</td>
                  <td>{e.created_by_name || '-'}</td>
                  <td>{e.total_estimated_hours ? `${e.total_estimated_hours}h` : '-'}</td>
                  <td className="ap-td-value">${Number(e.total_fixed_cost || 0).toLocaleString()}</td>
                  <td><span className="ap-badge ap-badge--gray">v{e.version_number || 1}</span></td>
                  <td>
                    <span className={`ap-badge ap-badge--status ${statusClass(e.status || 'Estimation Initiation')}`}>
                      {e.status || 'Estimation Initiation'}
                    </span>
                  </td>
                  <td>
                    {(e.comments || []).length > 0
                      ? <span className="ap-comment-count" title="Admin comments">💬 {(e.comments || []).length}</span>
                      : <span className="ap-td-muted">—</span>}
                  </td>
                  <td>
                    <span className={`ap-badge ${e.is_editable !== false ? 'ap-badge--green' : 'ap-badge--orange'}`}>
                      {e.is_editable !== false ? 'Editable' : 'Locked'}
                    </span>
                  </td>
                  <td className="ap-td-muted">{e.updated_at ? new Date(e.updated_at).toLocaleDateString() : '-'}</td>
                  <td>
                    <div className="ap-row-actions">
                      <button className="ap-btn ap-btn--sm ap-btn--view" title="View estimate" onClick={() => onView && onView(e.id)}>👁️ View</button>
                      {e.is_editable !== false
                        ? <button className="ap-btn ap-btn--sm ap-btn--warning" title="Lock editing" onClick={() => handleLock(e.id)}>🔒 Lock</button>
                        : <button className="ap-btn ap-btn--sm ap-btn--success" title="Unlock editing" onClick={() => handleUnlock(e.id)}>🔓 Unlock</button>
                      }
                      <button className="ap-btn ap-btn--sm ap-btn--danger" title="Delete estimate" onClick={() => handleDelete(e)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
