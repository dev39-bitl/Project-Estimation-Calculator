import React, { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '../../services/adminApi'

function getTimestamp(value) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' })

  const currentUserId = (() => {
    try {
      return JSON.parse(localStorage.getItem('current_user') || '{}')?.id
    } catch {
      return null
    }
  })()

  const load = () => {
    setLoading(true)
    adminAPI.users()
      .then(r => {
        setUsers(r.data)
        setSelectedIds([])
      })
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const visibleUsers = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    const filtered = users.filter(u => {
      const name = String(u.full_name || '').toLowerCase()
      const email = String(u.email || '').toLowerCase()
      const role = String(u.role || '').toLowerCase()
      const matchesQuery = !query || name.includes(query) || email.includes(query)
      const matchesRole = roleFilter === 'all' || role === roleFilter
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && !!u.is_active) || (statusFilter === 'blocked' && !u.is_active)
      return matchesQuery && matchesRole && matchesStatus
    })

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      const getValue = (item) => {
        if (sortConfig.key === 'full_name') return String(item.full_name || '').toLowerCase()
        if (sortConfig.key === 'email') return String(item.email || '').toLowerCase()
        if (sortConfig.key === 'role') return String(item.role || '').toLowerCase()
        if (sortConfig.key === 'status') return item.is_active ? 1 : 0
        return getTimestamp(item.created_at)
      }
      const av = getValue(a)
      const bv = getValue(b)
      if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1
      if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1
      return getTimestamp(b.created_at) - getTimestamp(a.created_at)
    })

    return sorted
  }, [users, searchText, roleFilter, statusFilter, sortConfig])

  if (loading) return <div className="ap-loading">Loading users...</div>
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

  const handleBlock = async (u) => {
    if (!window.confirm(`Block login for "${u.full_name}"?`)) return
    try {
      await adminAPI.blockUser(u.id)
      setActionMsg(`${u.full_name} has been blocked.`)
      load()
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Block failed.')
    }
  }

  const handleUnblock = async (u) => {
    try {
      await adminAPI.unblockUser(u.id)
      setActionMsg(`${u.full_name} has been unblocked.`)
      load()
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Unblock failed.')
    }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`Permanently delete user "${u.full_name}"? Their estimates will be preserved.`)) return
    try {
      await adminAPI.deleteUser(u.id)
      setActionMsg(`${u.full_name} has been deleted.`)
      load()
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Delete failed.')
    }
  }

  const selectableUsers = visibleUsers.filter(u => u.id !== currentUserId)

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === selectableUsers.length) {
      setSelectedIds([])
      return
    }
    setSelectedIds(selectableUsers.map(u => u.id))
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Delete ${selectedIds.length} selected user(s)?`)) return
    try {
      const res = await adminAPI.bulkDeleteUsers(selectedIds)
      setActionMsg(`Deleted ${res.data?.deleted ?? 0} user(s).`)
      load()
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Bulk delete failed.')
    }
  }

  const clearFilters = () => {
    setSearchText('')
    setRoleFilter('all')
    setStatusFilter('all')
    setSortConfig({ key: 'created_at', direction: 'desc' })
  }

  return (
    <div className="ap-card">
      <div className="ap-card-header ap-card-header--filters">
        <h3 className="ap-card-title">All Users</h3>
        <div className="ap-filters">
          <input
            className="ap-filters-search"
            type="text"
            placeholder="Search name or email"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="estimator">Estimator</option>
            <option value="user">User</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
          <button className="ap-btn ap-btn--sm" onClick={clearFilters}>Clear</button>
          <button className="ap-btn ap-btn--sm ap-btn--danger" onClick={handleBulkDelete} disabled={selectedIds.length === 0}>Delete Selected</button>
        </div>
      </div>

      {actionMsg && <div className="ap-alert ap-alert--info" style={{ margin: '8px 0' }}>{actionMsg}</div>}
      {visibleUsers.length === 0 ? (
        <p className="ap-empty">No users found.</p>
      ) : (
        <div className="ap-table-wrap">
          <table className="ap-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectableUsers.length > 0 && selectedIds.length === selectableUsers.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all users"
                  />
                </th>
                <th>ID</th>
                <th className="ap-sortable" onClick={() => toggleSort('full_name')}>Full Name{sortIndicator('full_name')}</th>
                <th className="ap-sortable" onClick={() => toggleSort('email')}>Email{sortIndicator('email')}</th>
                <th className="ap-sortable" onClick={() => toggleSort('role')}>Role{sortIndicator('role')}</th>
                <th className="ap-sortable" onClick={() => toggleSort('status')}>Status{sortIndicator('status')}</th>
                <th className="ap-sortable" onClick={() => toggleSort('created_at')}>Created At{sortIndicator('created_at')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map(u => (
                <tr key={u.id}>
                  <td>
                    {u.id !== currentUserId ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        aria-label={`Select user ${u.id}`}
                      />
                    ) : (
                      <span className="ap-td-muted">-</span>
                    )}
                  </td>
                  <td className="ap-td-muted">#{u.id}</td>
                  <td><strong>{u.full_name}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`ap-badge ${u.role === 'admin' ? 'ap-badge--purple' : 'ap-badge--blue'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`ap-badge ${u.is_active ? 'ap-badge--green' : 'ap-badge--red'}`}>
                      {u.is_active ? 'Active' : 'Blocked'}
                    </span>
                  </td>
                  <td className="ap-td-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                  <td>
                    {u.role !== 'admin' && (
                      <div className="ap-row-actions">
                        {u.is_active
                          ? <button className="ap-btn ap-btn--sm ap-btn--warning admin-btn-lock" title="Block user login" onClick={() => handleBlock(u)}>Block Login</button>
                          : <button className="ap-btn ap-btn--sm ap-btn--success admin-btn-unlock" title="Enable user login" onClick={() => handleUnblock(u)}>Enable Login</button>
                        }
                        <button className="ap-btn ap-btn--sm ap-btn--danger admin-btn-delete" title="Delete user" onClick={() => handleDelete(u)}>Delete</button>
                      </div>
                    )}
                    {u.role === 'admin' && <span className="ap-td-muted">-</span>}
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
