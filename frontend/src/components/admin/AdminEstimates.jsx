import React, { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '../../services/adminApi'

const PROJECT_STATUSES = [
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

function getTimestamp(value) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function statusClass(status) {
  return `ap-status-${String(status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

/**
 * Safely normalize API response to an array of estimates
 * Handles multiple response formats from backend
 */
function normalizeEstimates(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.estimates)) return response.estimates
  if (Array.isArray(response?.data)) return response.data
  return []
}

/**
 * Normalize a single estimate with safe fallback values
 */
function normalizeEstimate(e) {
  if (!e || typeof e !== 'object') {
    return {
      id: 0,
      name: 'Untitled Project',
      client_name: 'N/A',
      created_by_name: 'N/A',
      status: 'Draft',
      total_estimated_hours: 0,
      total_fixed_cost: 0,
      version_number: 1,
      updated_at: null,
      created_at: null,
      is_editable: true,
      comments: [],
    }
  }
  
  return {
    id: Number(e.id) || 0,
    name: String(e.name || e.project_name || 'Untitled Project').trim(),
    client_name: String(e.client_name || 'N/A').trim(),
    created_by_name: String(e.created_by_name || 'N/A').trim(),
    status: String(e.status || 'Draft').trim(),
    total_estimated_hours: Number(e.total_estimated_hours || 0),
    total_fixed_cost: Number(e.total_fixed_cost || 0),
    version_number: Number(e.version_number || 1),
    updated_at: e.updated_at || e.created_at || null,
    created_at: e.created_at || null,
    is_editable: e.is_editable !== false,
    comments: Array.isArray(e.comments) ? e.comments : [],
  }
}

export default function AdminEstimates({ onView, onDeleted }) {
  // ============ ALL HOOKS DECLARED AT TOP ============
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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Load data effect with proper cleanup
  useEffect(() => {
    let isMounted = true

    const loadEstimates = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await adminAPI.estimates()
        
        if (!isMounted) return
        
        const normalized = normalizeEstimates(response.data)
        if (import.meta.env.DEV) {
          console.log('[AdminEstimates] API response:', response.data)
          console.log('[AdminEstimates] Normalized estimates:', normalized)
        }
        const safeEstimates = normalized.map(e => normalizeEstimate(e))
        setEstimates(safeEstimates)
        setSelectedIds([])
        setCurrentPage(1)
      } catch (err) {
        if (!isMounted) return
        
        const status = err.response?.status
        const errorMsg = err.response?.data?.detail || err.message || 'Unable to load estimates'
        const displayError = `Unable to load estimates. ${errorMsg}${status ? ` (Error ${status})` : ''}`
        
        if (import.meta.env.DEV) {
          console.error('[AdminEstimates] Load error:', {
            status,
            message: errorMsg,
            fullError: err,
          })
        }
        
        // Do NOT logout on temporary errors - only on auth failures
        // Let the api.js interceptor handle 401/403
        setError(displayError)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadEstimates()

    return () => {
      isMounted = false
    }
  }, [])

  // Filter and sort visible estimates
  const visibleEstimates = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    const now = Date.now()
    const safeEstimates = Array.isArray(estimates) ? estimates : []

    const filtered = safeEstimates.filter(e => {
      const project = String(e.name || '').toLowerCase()
      const client = String(e.client_name || '').toLowerCase()
      const estimator = String(e.created_by_name || '').toLowerCase()
      const status = e.status || 'Draft'
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
        if (sortConfig.key === 'status') return String(item.status || '').toLowerCase()
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

  // Paginate visible estimates
  const totalItems = visibleEstimates.length || 0
  const safePageSize = Math.max(1, Number(pageSize) || 10)
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize))

  const paginatedEstimates = useMemo(() => {
    const startIndex = (currentPage - 1) * safePageSize
    const endIndex = startIndex + safePageSize
    return visibleEstimates.slice(startIndex, endIndex)
  }, [visibleEstimates, currentPage, safePageSize])

  // Reset to last valid page if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  // ============ EVENT HANDLERS ============
  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await adminAPI.estimates()
      const normalized = normalizeEstimates(response.data)
      if (import.meta.env.DEV) {
        console.log('[AdminEstimates] Reload - API response:', response.data)
        console.log('[AdminEstimates] Reload - Normalized estimates:', normalized)
      }
      const safeEstimates = normalized.map(e => normalizeEstimate(e))
      setEstimates(safeEstimates)
      setSelectedIds([])
      setCurrentPage(1)
    } catch (err) {
      const status = err.response?.status
      const errorMsg = err.response?.data?.detail || err.message || 'Unable to load estimates'
      const displayError = `Unable to load estimates. ${errorMsg}${status ? ` (Error ${status})` : ''}`
      
      if (import.meta.env.DEV) {
        console.error('[AdminEstimates] Reload error:', {
          status,
          message: errorMsg,
          fullError: err,
        })
      }
      
      setError(displayError)
    } finally {
      setLoading(false)
    }
  }

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
    setCurrentPage(1)
  }

  const handlePageSizeChange = (e) => {
    const newPageSize = Number(e.target.value) || 10
    setPageSize(Math.max(1, newPageSize))
    setCurrentPage(1)
  }

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1))
  }

  // ============ RENDER ============
  return (
    <div className="ap-card">
      {loading && (
        <div className="ap-loading" style={{ padding: '40px', textAlign: 'center' }}>Loading estimates…</div>
      )}

      {!loading && error && (
        <>
          <div className="ap-alert ap-alert--error" style={{ margin: '16px' }}>{error}</div>
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <button className="btn-gradient" onClick={load} style={{ marginTop: '12px' }}>
              🔄 Retry
            </button>
          </div>
        </>
      )}

      {!loading && !error && (
        <>
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
          ) : estimates.length === 0 ? (
            <p className="ap-empty">No estimates in the system.</p>
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
              {paginatedEstimates.map(e => (
                <tr key={e.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(e.id)}
                      onChange={() => toggleSelect(e.id)}
                      aria-label={`Select estimate ${e.id}`}
                    />
                  </td>
                  <td className="ap-td-muted">#{e.id || '-'}</td>
                  <td><strong>{String(e.name || '-').substring(0, 50)}</strong></td>
                  <td>{String(e.client_name || '-').substring(0, 40)}</td>
                  <td>{String(e.created_by_name || '-').substring(0, 30)}</td>
                  <td>{e.total_estimated_hours ? `${Number(e.total_estimated_hours).toFixed(1)}h` : '-'}</td>
                  <td className="ap-td-value">${Number(e.total_fixed_cost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td><span className="ap-badge ap-badge--gray">v{Number(e.version_number || 1)}</span></td>
                  <td>
                    <span className={`ap-badge ap-badge--status ${statusClass(String(e.status || 'Estimation Initiation'))}`}>
                      {String(e.status || 'Estimation Initiation').substring(0, 25)}
                    </span>
                  </td>
                  <td>
                    {Array.isArray(e.comments) && (e.comments || []).length > 0
                      ? <span className="ap-comment-count" title="Admin comments">💬 {(e.comments || []).length}</span>
                      : <span className="ap-td-muted">—</span>}
                  </td>
                  <td>
                    <span className={`ap-badge ${e.is_editable !== false ? 'ap-badge--green' : 'ap-badge--orange'}`}>
                      {e.is_editable !== false ? 'Editable' : 'Locked'}
                    </span>
                  </td>
                  <td className="ap-td-muted">{e.updated_at && !isNaN(new Date(e.updated_at).getTime()) ? new Date(e.updated_at).toLocaleDateString() : '-'}</td>
                  <td>
                    <div className="ap-row-actions">
                      <button className="ap-btn ap-btn--sm ap-btn--view admin-btn-view" title="View estimate" onClick={() => onView && onView(e.id)}>👁️ View</button>
                      {e.is_editable !== false
                        ? <button className="ap-btn ap-btn--sm ap-btn--warning admin-btn-lock" title="Lock editing" onClick={() => handleLock(e.id)}>🔒 Lock</button>
                        : <button className="ap-btn ap-btn--sm ap-btn--success admin-btn-unlock" title="Unlock editing" onClick={() => handleUnlock(e.id)}>🔓 Unlock</button>
                      }
                      <button className="ap-btn ap-btn--sm ap-btn--danger admin-btn-delete" title="Delete estimate" onClick={() => handleDelete(e)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

          {visibleEstimates.length > 0 && (
            <div className="ap-pagination" style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid #1e4053' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 600 }}>Items per page:</label>
                <select value={pageSize} onChange={handlePageSizeChange} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #2B4564', background: '#10243A', color: '#FFFFFF' }}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 600 }}>
                Showing {totalItems === 0 ? 0 : (currentPage - 1) * safePageSize + 1}-{Math.min(currentPage * safePageSize, totalItems)} of {totalItems} estimates
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="ap-btn ap-btn--sm" onClick={handlePrevPage} disabled={currentPage === 1}>← Previous</button>
                <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 600, minWidth: '60px', textAlign: 'center' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button className="ap-btn ap-btn--sm" onClick={handleNextPage} disabled={currentPage === totalPages}>Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
