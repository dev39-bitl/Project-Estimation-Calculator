import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { estimateAPI } from '../services/api'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [openMenuEstimateId, setOpenMenuEstimateId] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const openMenuRef = useRef(null)

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

  useEffect(() => {
    if (openMenuEstimateId === null) return

    const handleOutsideClick = (event) => {
      if (openMenuRef.current && !openMenuRef.current.contains(event.target)) {
        setOpenMenuEstimateId(null)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpenMenuEstimateId(null)
    }

    // Small delay so the click that opened the menu doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openMenuEstimateId])

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
    setCurrentPage(1)
  }

  useEffect(() => {
    setOpenMenuEstimateId(null)
  }, [currentPage, pageSize, searchText, statusFilter, editableFilter, dateFilter, sortConfig])

  const paginatedEstimates = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredEstimates.slice(startIndex, endIndex)
  }, [filteredEstimates, currentPage, pageSize])

  const totalPages = Math.ceil(filteredEstimates.length / pageSize)

  const handlePageSizeChange = (e) => {
    const newPageSize = Number(e.target.value)
    setPageSize(newPageSize)
    setCurrentPage(1)
  }

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1))
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

  const handleView = (item) => {
    setOpenMenuEstimateId(null)
    onLoad && onLoad(item, false)
  }

  const handleEditOrContinue = (item, isEditable) => {
    if (!isEditable) return
    setOpenMenuEstimateId(null)
    onLoad && onLoad(item, true)
  }

  const handleDeleteFromMenu = async (id) => {
    setOpenMenuEstimateId(null)
    await handleDelete(id)
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
          <button className="cta-gradient" onClick={onAddNew}>
            Add New Estimate →
          </button>
        </div>
      </div>

      <div className="saved-filters filters-row" style={{ marginTop: 12 }}>
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

      {error && estimates.length === 0 && <div className="error-message" style={{ marginTop: 10 }}>{error}</div>}

      <div className="saved-list estimates-table-wrapper">
        <table className="estimates-table">
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '4%' }} />
          </colgroup>
          <thead>
            <tr className="saved-list-head">
              <th className="saved-sortable" onClick={() => toggleSort('name')}>Project Name{sortIndicator('name')}</th>
              <th className="saved-sortable" onClick={() => toggleSort('client_name')}>Client Name{sortIndicator('client_name')}</th>
              <th className="saved-sortable" onClick={() => toggleSort('total_hours')}>Total Hours{sortIndicator('total_hours')}</th>
              <th className="saved-sortable" onClick={() => toggleSort('final_cost')}>Final Fixed Cost{sortIndicator('final_cost')}</th>
              <th>Version</th>
              <th className="saved-sortable" onClick={() => toggleSort('status')}>Status{sortIndicator('status')}</th>
              <th className="saved-sortable" onClick={() => toggleSort('editable')}>Editable / Locked{sortIndicator('editable')}</th>
              <th className="saved-sortable" onClick={() => toggleSort('updated_at')}>Updated Date{sortIndicator('updated_at')}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEstimates.map(item => {
              const totalHours = item.total_estimated_hours ?? item.effort_hours ?? 0
              const finalCost = item.total_fixed_cost ?? item.total_cost ?? 0
              const version = item.version_number || 1
              const status = item.status || 'Estimation Initiation'
              const isEditable = item.is_editable !== false
              const isDraft = item.is_draft || String(status).toLowerCase() === 'draft'

              return (
                <tr key={item.id} className="saved-list-row">
                  <td data-label="Project Name">
                    <button
                      className="estimate-name-link"
                      onClick={() => handleView(item)}
                      title="Open in view mode"
                      aria-label={`Open ${item.name || 'estimate'} in view mode`}
                      type="button"
                    >
                      {item.name || '-'}
                    </button>
                  </td>
                  <td data-label="Client Name">{item.client_name || '-'}</td>
                  <td data-label="Total Hours">{Number(totalHours).toFixed(1)}h</td>
                  <td data-label="Final Fixed Cost">${Number(finalCost || 0).toLocaleString()}</td>
                  <td data-label="Version">
                    <span className="badge badge-version">v{version}</span>
                  </td>
                  <td data-label="Status">
                    <span className={`badge badge-status ${statusToClass(status)}`}>
                      {status}
                    </span>
                  </td>
                  <td data-label="Editable / Locked">
                    <span className={`badge ${isEditable ? 'badge-success' : 'badge-warning'}`}>
                      {isEditable ? 'Editable' : 'Locked'}
                    </span>
                  </td>
                  <td data-label="Updated Date"><span className="date-cell">{formatDate(item.updated_at || item.created_at)}</span></td>
                  <td data-label="Actions" className="actions-cell">
                    <div className="row-actions-menu">
                      <button
                        className="row-action-trigger"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (openMenuEstimateId === item.id) {
                            setOpenMenuEstimateId(null)
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setMenuPosition({
                              top: rect.bottom + 8,
                              right: window.innerWidth - rect.right,
                            })
                            setOpenMenuEstimateId(item.id)
                          }
                        }}
                        title="Estimate actions"
                        aria-label="Open estimate actions"
                        aria-expanded={openMenuEstimateId === item.id}
                        type="button"
                      >
                        ⋮
                      </button>
                    </div>
                    {(item.comments || []).filter(c => !c.is_read_by_estimator).length > 0 && (
                      <span className="badge badge-warning" title="Admin comments available">
                        💬 {(item.comments || []).filter(c => !c.is_read_by_estimator).length}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filteredEstimates.length === 0 && <div className="saved-empty">No saved estimates found.</div>}
      </div>

      {filteredEstimates.length > 0 && (
        <div className="pagination-footer" style={{ marginTop: 16 }}>
          <div className="items-per-page-control">
            <label htmlFor="items-per-page-select" style={{ fontSize: '0.9rem' }}>Items per page:</label>
            <select id="items-per-page-select" className="items-per-page-select" value={pageSize} onChange={handlePageSizeChange}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="pagination-meta" style={{ fontSize: '0.9rem', color: '#C9D6EA' }}>
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredEstimates.length)} of {filteredEstimates.length} estimates
          </div>

          <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handlePrevPage} disabled={currentPage === 1}>← Previous</button>
            <span style={{ fontSize: '0.9rem', color: '#C9D6EA', minWidth: '60px', textAlign: 'center' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button className="btn btn-secondary" onClick={handleNextPage} disabled={currentPage === totalPages}>Next →</button>
          </div>
        </div>
      )}

      {/* Portal dropdown — renders at document.body, escapes all overflow clipping */}
      {(() => {
        if (openMenuEstimateId === null) return null
        const openItem = paginatedEstimates.find(item => item.id === openMenuEstimateId)
        if (!openItem) return null
        const isEditable = openItem.is_editable !== false
        const isDraft = openItem.is_draft || String(openItem.status || '').toLowerCase() === 'draft'
        return createPortal(
          <div
            ref={openMenuRef}
            className="row-action-dropdown"
            style={{
              position: 'fixed',
              top: menuPosition.top,
              right: menuPosition.right,
              zIndex: 999999,
            }}
            role="menu"
            onClick={e => e.stopPropagation()}
          >
            <button className="row-action-item" onClick={() => handleView(openItem)} type="button" role="menuitem">
              View
            </button>
            {isEditable && (
              <button
                className="row-action-item"
                onClick={() => handleEditOrContinue(openItem, isEditable)}
                type="button"
                role="menuitem"
              >
                {isDraft ? 'Continue' : 'Edit'}
              </button>
            )}
            <button
              className="row-action-item danger"
              onClick={() => handleDeleteFromMenu(openItem.id)}
              type="button"
              role="menuitem"
            >
              Delete
            </button>
          </div>,
          document.body
        )
      })()}
    </div>
  )
}

export default SavedEstimates
