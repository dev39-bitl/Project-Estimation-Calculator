import React, { useEffect, useMemo, useState } from 'react'
import { estimateAPI } from '../services/api'

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

function formatDate(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch (e) {
    return '-'
  }
}

function statusToClass(status) {
  return `status-${String(status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function getTimestamp(value) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function SavedEstimates({ refreshKey, onLoad, onAddNew }) {
  const [estimates, setEstimates] = useState([])
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editableFilter, setEditableFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'updated_at', direction: 'desc' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await estimateAPI.getAllEstimates(0, 100)
      setEstimates(res.data || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load saved estimates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [refreshKey])

  const filteredEstimates = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    const now = Date.now()

    const filtered = estimates.filter(item => {
      const name = String(item.name || '').toLowerCase()
      const client = String(item.client_name || '').toLowerCase()
      const status = item.status || 'Estimation Initiation'
      const isEditable = item.is_editable !== false
      const createdOrUpdated = getTimestamp(item.updated_at || item.created_at)

      const matchesQuery = !query || name.includes(query) || client.includes(query)
      const matchesStatus = statusFilter === 'all' || status === statusFilter
      const matchesEditable =
        editableFilter === 'all' ||
        (editableFilter === 'editable' && isEditable) ||
        (editableFilter === 'locked' && !isEditable)

      const matchesDate = (() => {
        if (dateFilter === 'all') return true
        if (!createdOrUpdated) return false
        if (dateFilter === 'today') {
          const d = new Date(createdOrUpdated)
          const n = new Date(now)
          return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
        }
        const days = Number(dateFilter)
        return Number.isFinite(days) && createdOrUpdated >= now - days * 24 * 60 * 60 * 1000
      })()

      return matchesQuery && matchesStatus && matchesEditable && matchesDate
    })

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      const aHours = Number(a.total_estimated_hours ?? a.effort_hours ?? 0)
      const bHours = Number(b.total_estimated_hours ?? b.effort_hours ?? 0)
      const aCost = Number(a.total_fixed_cost ?? a.total_cost ?? 0)
      const bCost = Number(b.total_fixed_cost ?? b.total_cost ?? 0)
      const aDate = getTimestamp(a.updated_at || a.created_at)
      const bDate = getTimestamp(b.updated_at || b.created_at)

      const getValue = (item) => {
        if (sortConfig.key === 'name') return String(item.name || '').toLowerCase()
        if (sortConfig.key === 'client_name') return String(item.client_name || '').toLowerCase()
        if (sortConfig.key === 'total_hours') return Number(item.total_estimated_hours ?? item.effort_hours ?? 0)
        if (sortConfig.key === 'final_cost') return Number(item.total_fixed_cost ?? item.total_cost ?? 0)
        if (sortConfig.key === 'status') return String(item.status || 'Estimation Initiation').toLowerCase()
        if (sortConfig.key === 'editable') return item.is_editable !== false ? 1 : 0
        return getTimestamp(item.updated_at || item.created_at)
      }

      const av = getValue(a)
      const bv = getValue(b)
      if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1
      if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1
      return bDate - aDate
    })

    return sorted
  }, [estimates, searchText, statusFilter, editableFilter, dateFilter, sortConfig])

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

  const clearFilters = () => {
    setSearchText('')
    setStatusFilter('all')
    setEditableFilter('all')
    setDateFilter('all')
    setSortConfig({ key: 'updated_at', direction: 'desc' })
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this estimate?')) return
    try {
      await estimateAPI.deleteEstimate(id)
      setEstimates(prev => prev.filter(item => item.id !== id))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete estimate')
    }
  }

  if (loading) {
    return (
      <div className="saved-dashboard">
        <div className="loading">Loading estimates...</div>
      </div>
    )
  }

  return (
    <div className="saved-dashboard">
      <div className="saved-toolbar">
        <div className="saved-toolbar-left">
          <h3>My Estimates</h3>
          <p className="muted">Project name and primary technology are required for new estimates.</p>
        </div>
        <div className="saved-toolbar-right">
          <button className="btn btn-primary" onClick={onAddNew}>
            Add New Estimate →
          </button>
        </div>
      </div>

      <div className="saved-filters" style={{ marginTop: 12 }}>
        <input
          className="saved-filters-search"
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search by project or client"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {PROJECT_STATUSES.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <select value={editableFilter} onChange={e => setEditableFilter(e.target.value)}>
          <option value="all">Editable + Locked</option>
          <option value="editable">Editable Only</option>
          <option value="locked">Locked Only</option>
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
        </select>
        <button className="btn btn-ghost" onClick={clearFilters}>Clear Filters</button>
      </div>

      {error && <div className="error-message" style={{ marginTop: 10 }}>{error}</div>}

      <div className="saved-list">
        <div className="saved-list-head">
          <span className="saved-sortable" onClick={() => toggleSort('name')}>Project Name{sortIndicator('name')}</span>
          <span className="saved-sortable" onClick={() => toggleSort('client_name')}>Client Name{sortIndicator('client_name')}</span>
          <span className="saved-sortable" onClick={() => toggleSort('total_hours')}>Total Hours{sortIndicator('total_hours')}</span>
          <span className="saved-sortable" onClick={() => toggleSort('final_cost')}>Final Fixed Cost{sortIndicator('final_cost')}</span>
          <span>Version</span>
          <span className="saved-sortable" onClick={() => toggleSort('status')}>Status{sortIndicator('status')}</span>
          <span className="saved-sortable" onClick={() => toggleSort('editable')}>Editable / Locked{sortIndicator('editable')}</span>
          <span className="saved-sortable" onClick={() => toggleSort('updated_at')}>Updated Date{sortIndicator('updated_at')}</span>
          <span>Actions</span>
        </div>

        {filteredEstimates.length === 0 ? (
          <div className="saved-empty">No saved estimates found.</div>
        ) : (
          filteredEstimates.map(item => {
            const totalHours = item.total_estimated_hours ?? item.effort_hours ?? 0
            const finalCost = item.total_fixed_cost ?? item.total_cost ?? 0
            const version = item.version_number || 1
            const status = item.status || 'Estimation Initiation'
            const isEditable = item.is_editable !== false

            return (
              <div key={item.id} className="saved-list-row">
                <span>{item.name || '-'}</span>
                <span>{item.client_name || '-'}</span>
                <span>{Number(totalHours).toFixed(1)}h</span>
                <span>${Number(finalCost || 0).toLocaleString()}</span>
                <span>
                  <span className="badge badge-version">v{version}</span>
                </span>
                <span>
                  <span className={`badge badge-status ${statusToClass(status)}`}>
                    {status}
                  </span>
                </span>
                <span>
                  <span className={`badge ${isEditable ? 'badge-success' : 'badge-warning'}`}>
                    {isEditable ? 'Editable' : 'Locked'}
                  </span>
                </span>
                <span>{formatDate(item.updated_at || item.created_at)}</span>
                <span className="saved-actions">
                  <button className="btn btn-ghost btn-icon" onClick={() => onLoad && onLoad(item, false)} title="View estimate">👁️</button>
                  <button className="btn btn-ghost btn-icon" onClick={() => onLoad && onLoad(item, true)} disabled={!isEditable} title={!isEditable ? 'Locked by Admin' : 'Edit estimate'}>✏️</button>
                  <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(item.id)} title="Delete estimate">🗑️</button>
                  {(item.comments || []).filter(c => !c.is_read_by_estimator).length > 0 && (
                    <span className="badge badge-warning" title="Admin comments available">
                      💬 {(item.comments || []).filter(c => !c.is_read_by_estimator).length}
                    </span>
                  )}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default SavedEstimates
