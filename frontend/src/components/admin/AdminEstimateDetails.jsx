import React, { useEffect, useState } from 'react'
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

function toAbsoluteUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `http://localhost:8000${url}`
}

function statusClass(status) {
  return `ap-status-${String(status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export default function AdminEstimateDetails({ id, onDeleted, onBack }) {
  const [estimate, setEstimate] = useState(null)
  const [error, setError] = useState('')
  const [commentText, setCommentText] = useState('')
  const [commentFile, setCommentFile] = useState(null)
  const [commentError, setCommentError] = useState('')
  const [locking, setLocking] = useState(false)
  const [statusValue, setStatusValue] = useState('Estimation Initiation')
  const [reviewSaving, setReviewSaving] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  const load = () => {
    if (!id) return
    setEstimate(null)
    setError('')
    setActionMsg('')
    adminAPI.estimate(id)
      .then(r => {
        const payload = r.data
        setEstimate(payload)
        setStatusValue(payload?.status || 'Estimation Initiation')
      })
      .catch(() => setError('Failed to load estimate details'))
  }

  useEffect(() => { load() }, [id])

  if (!id) return <div className="ap-empty-state">Select an estimate to view details</div>
  if (error) return <div className="ap-alert ap-alert--error">{error}</div>
  if (!estimate) return <div className="ap-loading">Loading estimate...</div>

  const techStack = estimate.tech_stack_json || {}
  const isEditable = estimate.is_editable !== false

  const handleLockToggle = async () => {
    setLocking(true)
    setActionMsg('')
    try {
      if (isEditable) {
        await adminAPI.lockEstimate(id)
        setActionMsg('Estimate locked successfully.')
      } else {
        await adminAPI.unlockEstimate(id)
        setActionMsg('Estimate unlocked successfully.')
      }
      load()
    } catch {
      setActionMsg('Action failed. Please try again.')
    } finally {
      setLocking(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete estimate "${estimate.name}"? This cannot be undone.`)) return
    try {
      await adminAPI.deleteEstimate(id)
      onDeleted && onDeleted()
    } catch {
      setActionMsg('Failed to delete estimate.')
    }
  }

  const handleSaveAdminReview = async () => {
    if (commentFile && commentFile.size > 10 * 1024 * 1024) {
      setCommentError('File size must be 10 MB or less.')
      return
    }

    const statusChanged = statusValue !== (estimate.status || 'Estimation Initiation')
    const hasCommentOrFile = Boolean(commentText.trim() || commentFile)

    if (!statusChanged && !hasCommentOrFile) {
      setActionMsg('No review changes to save.')
      return
    }

    setReviewSaving(true)
    setCommentError('')
    setActionMsg('')

    try {
      if (statusChanged) {
        await adminAPI.updateEstimateStatus(id, statusValue)
      }
      if (hasCommentOrFile) {
        const normalizedComment = commentText.trim() || 'Client attachment uploaded.'
        await adminAPI.addComment(id, normalizedComment, commentFile)
      }
      setCommentText('')
      setCommentFile(null)
      setActionMsg('Admin review saved successfully.')
      load()
    } catch (err) {
      setCommentError(err.response?.data?.detail || 'Failed to save admin review.')
    } finally {
      setReviewSaving(false)
    }
  }

  const handleExportPdf = () => {
    window.print()
  }

  return (
    <div className="ap-detail">
      {actionMsg && <div className="ap-alert ap-alert--info" style={{ marginBottom: 12 }}>{actionMsg}</div>}

      <div className="ap-card">
        <div className="ap-header-top">
          <div>
            <h3 className="ap-card-title" style={{ marginBottom: 6 }}>{estimate.name}</h3>
            <div className="ap-header-badges">
              <span className="ap-badge ap-badge--green">${Number(estimate.total_fixed_cost || 0).toLocaleString()}</span>
              <span className={`ap-badge ${isEditable ? 'ap-badge--blue' : 'ap-badge--orange'}`}>
                {isEditable ? 'Editable' : 'Locked'}
              </span>
              <span className="ap-badge ap-badge--gray">v{estimate.version_number || 1}</span>
              <span className={`ap-badge ap-badge--status ${statusClass(estimate.status || 'Estimation Initiation')}`}>
                {estimate.status || 'Estimation Initiation'}
              </span>
            </div>
          </div>
          <div className="ap-action-bar">
            <button
              className={`ap-btn ap-btn--sm ${isEditable ? 'ap-btn--warning' : 'ap-btn--success'}`}
              onClick={handleLockToggle}
              disabled={locking}
              title={isEditable ? 'Lock editing' : 'Unlock editing'}
            >
              {locking ? '...' : isEditable ? 'Lock Editing' : 'Unlock Editing'}
            </button>
            <button className="ap-btn ap-btn--sm ap-btn--danger" onClick={handleDelete} title="Delete estimate">Delete</button>
            <button className="ap-btn ap-btn--sm ap-btn--view" onClick={handleExportPdf} title="Export PDF">Export PDF</button>
            <button className="ap-btn ap-btn--sm" onClick={() => onBack && onBack()} title="Back to estimates">Back to Estimates</button>
          </div>
        </div>

        <div className="ap-detail-grid">
          <div className="ap-detail-item">
            <span className="ap-detail-label">Client</span>
            <span className="ap-detail-value">{estimate.client_name || '-'}</span>
          </div>
          <div className="ap-detail-item">
            <span className="ap-detail-label">Project Type</span>
            <span className="ap-detail-value">{estimate.project_info?.projectType || '-'}</span>
          </div>
          <div className="ap-detail-item">
            <span className="ap-detail-label">Currency</span>
            <span className="ap-detail-value">{estimate.currency || estimate.project_info?.currency || 'USD'}</span>
          </div>
          <div className="ap-detail-item">
            <span className="ap-detail-label">Total Hours</span>
            <span className="ap-detail-value">{estimate.total_estimated_hours ? `${estimate.total_estimated_hours}h` : '-'}</span>
          </div>
          <div className="ap-detail-item">
            <span className="ap-detail-label">Created</span>
            <span className="ap-detail-value">{estimate.created_at ? new Date(estimate.created_at).toLocaleString() : '-'}</span>
          </div>
          <div className="ap-detail-item">
            <span className="ap-detail-label">Updated</span>
            <span className="ap-detail-value">{estimate.updated_at ? new Date(estimate.updated_at).toLocaleString() : '-'}</span>
          </div>
        </div>
      </div>

      <div className="ap-card">
        <div className="ap-card-header">
          <h4 className="ap-card-title">Created By</h4>
        </div>
        <div className="ap-detail-grid">
          <div className="ap-detail-item">
            <span className="ap-detail-label">Name</span>
            <span className="ap-detail-value">{estimate.created_by_name || '-'}</span>
          </div>
          <div className="ap-detail-item">
            <span className="ap-detail-label">Email</span>
            <span className="ap-detail-value">{estimate.created_by_email || '-'}</span>
          </div>
        </div>
      </div>

      {Object.keys(techStack).length > 0 && (
        <div className="ap-card">
          <div className="ap-card-header">
            <h4 className="ap-card-title">Technology Stack</h4>
          </div>
          <div className="ap-detail-grid">
            {Object.entries(techStack).filter(([k, v]) => v && k !== 'stackLevel').map(([k, v]) => (
              <div key={k} className="ap-detail-item">
                <span className="ap-detail-label">{k.charAt(0).toUpperCase() + k.slice(1)}</span>
                <span className="ap-detail-value">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(estimate.modules || []).length > 0 && (
        <div className="ap-card">
          <div className="ap-card-header">
            <h4 className="ap-card-title">Modules & Features</h4>
          </div>
          {estimate.modules.map(mod => (
            <div key={mod.id} className="ap-module-block">
              <div className="ap-module-header">
                <strong>{mod.name}</strong>
                {mod.description && <span className="ap-td-muted"> - {mod.description}</span>}
              </div>
              {(mod.features || []).length > 0 && (
                <table className="ap-table ap-table--compact">
                  <thead>
                    <tr><th>Feature</th><th>Description</th><th>Complexity</th><th>Hours</th><th>Billable</th></tr>
                  </thead>
                  <tbody>
                    {mod.features.map(f => (
                      <tr key={f.id}>
                        <td>{f.name}</td>
                        <td className="ap-td-muted">{f.notes || f.description || '-'}</td>
                        <td>{typeof f.complexity === 'number' ? `${f.complexity}x` : f.complexity || '-'}</td>
                        <td>{(f.base_hours || f.estimated_hours || 0)}h</td>
                        <td>
                          <span className={`ap-badge ${f.is_billable ? 'ap-badge--green' : 'ap-badge--red'}`}>
                            {f.is_billable ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {estimate.proposal_summary && (
        <div className="ap-card">
          <div className="ap-card-header">
            <h4 className="ap-card-title">Proposal Summary</h4>
          </div>
          <p className="ap-proposal-text">{estimate.proposal_summary}</p>
        </div>
      )}

      <div className="ap-card">
        <div className="ap-card-header">
          <h4 className="ap-card-title">Admin Review</h4>
          {(estimate.comments || []).length > 0 && (
            <span className="ap-badge ap-badge--blue">{estimate.comments.length}</span>
          )}
        </div>

        <div className="ap-status-row" style={{ marginBottom: 12 }}>
          <label className="ap-detail-label">Project Status</label>
          <select value={statusValue} onChange={e => setStatusValue(e.target.value)}>
            {PROJECT_STATUSES.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <textarea
            className="ap-comment-textarea"
            rows={3}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="Write an admin comment for this estimate..."
          />
          <div style={{ marginTop: 8 }}>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.zip"
              onChange={e => setCommentFile(e.target.files?.[0] || null)}
            />
            {commentFile && <div className="muted" style={{ marginTop: 4 }}>Attached: {commentFile.name}</div>}
          </div>
          {commentError && <div className="ap-alert ap-alert--error" style={{ marginTop: 4 }}>{commentError}</div>}
          <button
            className="ap-btn ap-btn--sm ap-btn--primary"
            style={{ marginTop: 8 }}
            onClick={handleSaveAdminReview}
            disabled={reviewSaving}
          >
            {reviewSaving ? 'Saving...' : 'Save Admin Review'}
          </button>
        </div>

        {(estimate.comments || []).length === 0 ? (
          <p className="ap-empty">No comments yet.</p>
        ) : (
          <div className="ap-comment-list">
            {estimate.comments.map(c => (
              <div key={c.id} className="ap-comment-item">
                <div className="ap-comment-meta">
                  <strong>{c.user_name || 'Admin'}</strong>
                  <span className="ap-badge ap-badge--purple" style={{ marginLeft: 6 }}>{c.user_role || 'admin'}</span>
                  <span className="ap-td-muted" style={{ marginLeft: 8 }}>{new Date(c.created_at).toLocaleString()}</span>
                  {!c.is_read_by_estimator && <span className="ap-badge ap-badge--orange" style={{ marginLeft: 6 }}>Unread</span>}
                </div>
                <p className="ap-comment-text">{c.comment_text}</p>
                {c.file && (
                  <a href={toAbsoluteUrl(c.file.download_url || `/api/files/${c.file.id}`)} target="_blank" rel="noreferrer" className="ap-file-link">
                    {c.file.original_filename}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
