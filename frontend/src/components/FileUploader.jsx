import React, { useEffect, useMemo, useRef, useState } from 'react'

function formatSize(bytes) {
  const n = Number(bytes || 0)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function getExt(name) {
  const value = String(name || '')
  const idx = value.lastIndexOf('.')
  return idx >= 0 ? value.slice(idx + 1).toLowerCase() : ''
}

function formatDateTime(value) {
  if (!value) return 'Unknown date'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Unknown date'
  return parsed.toLocaleString()
}

function roleLabel(role) {
  return String(role || '').toLowerCase() === 'admin' ? 'Admin Upload' : 'User Upload'
}

function roleClass(role) {
  return String(role || '').toLowerCase() === 'admin'
    ? 'file-role-badge file-role-badge--admin'
    : 'file-role-badge file-role-badge--user'
}

export default function FileUploader({
  files = [],
  existingFiles = [],
  onFilesChange,
  onRemoveFile,
  onUpload,
  multiple = true,
  maxSizeMB = 10,
  allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'txt', 'zip'],
  readonly = false,
  uploading = false,
  title = 'Supporting Documents',
  changeNote = '',
  externalError = '',
  containerRef,
  onValidationError,
}) {
  const inputRef = useRef(null)
  const localCardRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [errors, setErrors] = useState([])
  const [uploadComment, setUploadComment] = useState('')
  const [expandedComments, setExpandedComments] = useState({})

  const activeCardRef = containerRef || localCardRef

  const focusCard = () => {
    const node = activeCardRef?.current
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node.focus?.()
  }

  useEffect(() => {
    if (!externalError) return
    focusCard()
  }, [externalError])

  const accept = useMemo(() => allowedExtensions.map((ext) => `.${ext}`).join(','), [allowedExtensions])

  const validateAndMerge = (selected) => {
    const all = Array.from(selected || [])
    const nextErrors = []
    const maxBytes = maxSizeMB * 1024 * 1024
    const valid = []

    all.forEach((file) => {
      const ext = getExt(file.name)
      if (!allowedExtensions.includes(ext)) {
        nextErrors.push(`${file.name}: Unsupported file type`)
        return
      }
      if (file.size > maxBytes) {
        nextErrors.push(`${file.name}: File exceeds ${maxSizeMB}MB limit`)
        return
      }
      valid.push(file)
    })

    setErrors(nextErrors)
    if (nextErrors.length > 0) {
      onValidationError && onValidationError(nextErrors[0])
      focusCard()
    }

    if (valid.length === 0) return

    const merged = multiple ? [...files, ...valid] : [valid[0]]
    onFilesChange && onFilesChange(merged)
  }

  const handleBrowse = () => {
    if (readonly) return
    inputRef.current?.click()
  }

  const handleInputChange = (e) => {
    validateAndMerge(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    if (readonly) return
    setDragOver(false)
    validateAndMerge(e.dataTransfer.files)
  }

  const removeQueued = (index) => {
    if (readonly) return
    const next = files.filter((_, i) => i !== index)
    onFilesChange && onFilesChange(next)
    onRemoveFile && onRemoveFile({ type: 'queued', index })
  }

  const removeExisting = (file) => {
    if (readonly) return
    onRemoveFile && onRemoveFile({ type: 'existing', file })
  }

  const submitUpload = async () => {
    const trimmed = uploadComment.trim()
    if (trimmed.length > 500) {
      const msg = 'Document purpose/comment must be 500 characters or fewer'
      setErrors([msg])
      onValidationError && onValidationError(msg)
      focusCard()
      return
    }
    try {
      const result = await (onUpload && onUpload(files, trimmed))
      if (result !== false) {
        setUploadComment('')
        setErrors([])
      }
    } catch {
      // Parent handles upload errors; keep comment text so user can retry.
    }
  }

  const toggleComment = (fileId) => {
    setExpandedComments((prev) => ({ ...prev, [fileId]: !prev[fileId] }))
  }

  return (
    <div ref={activeCardRef} tabIndex={-1} className="file-uploader-card supporting-documents-card">
      <div className="file-uploader-head">
        <h4>{title}</h4>
        {!readonly && (
          <button type="button" className="ap-btn ap-btn--sm" onClick={handleBrowse}>Browse Files</button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />

      <div
        className={`file-dropzone file-drop-zone${dragOver ? ' file-dropzone--active' : ''}${readonly ? ' file-dropzone--readonly' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!readonly) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={handleBrowse}
        role="button"
        tabIndex={readonly ? -1 : 0}
        onKeyDown={(e) => {
          if (!readonly && (e.key === 'Enter' || e.key === ' ')) handleBrowse()
        }}
      >
        <div className="file-dropzone-icon">📎</div>
        <div className="file-dropzone-text">Drag and drop files here or click to browse</div>
        <div className="file-dropzone-hint">Allowed: {allowedExtensions.join(', ')} | Max: {maxSizeMB}MB each</div>
      </div>

      {errors.length > 0 && (
        <div className="file-errors">
          {errors.map((err, idx) => (
            <div key={`${err}-${idx}`} className="file-error-item">{err}</div>
          ))}
        </div>
      )}

      {externalError && <div className="file-errors"><div className="file-error-item">{externalError}</div></div>}

      {files.length > 0 && (
        <div className="file-list-wrap">
          <div className="file-list-title">Selected Files</div>
          <ul className="file-list supporting-files-list supporting-files-list--queued">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="supporting-file-card">
                <div className="supporting-file-left">
                  <div className="supporting-file-title-wrap">
                    <span className="file-icon">FILE</span>
                    <span className="file-name">{file.name}</span>
                  </div>
                  <div className="supporting-file-meta">Selected for upload</div>
                </div>
                <div className="supporting-file-right">
                  <span className="file-size">{formatSize(file.size)}</span>
                  <span className="file-status">Ready</span>
                  {!readonly && (
                    <button type="button" className="file-remove-btn supporting-file-remove-btn" onClick={() => removeQueued(index)}>Remove</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!readonly && files.length > 0 && (
        <div className="file-upload-comment-wrap">
          <label htmlFor="upload-comment">Document Purpose / Comment</label>
          <div className="file-upload-comment-helper">
            Add a short note so admin/user understands why these files are attached.
          </div>
          <textarea
            id="upload-comment"
            value={uploadComment}
            onChange={(e) => setUploadComment(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Example: Client shared revised requirement, design reference, change request, quotation support, approval note, etc."
          />
          <div className="file-upload-comment-hint">
            This comment applies to selected files. Optional but strongly recommended. ({uploadComment.length}/500)
          </div>
        </div>
      )}

      {changeNote && changeNote.trim() && (
        <div className="estimate-change-note">
          <strong>Estimate Change Note:</strong> {changeNote.trim()}
        </div>
      )}

      {existingFiles.length > 0 && (
        <div className="file-list-wrap">
          <div className="file-list-title">Uploaded Files</div>
          <ul className="file-list supporting-files-list">
            {existingFiles.map((file) => (
              <li key={file.id} className="supporting-file-card">
                <div className="supporting-file-left">
                  <div className="supporting-file-title-wrap">
                    <span className="file-icon">FILE</span>
                    <span className="file-name">{file.original_filename}</span>
                  </div>
                  <div className="supporting-file-meta">
                    Uploaded by: {file.uploaded_by_name || 'Unknown user'}
                    {file.uploaded_by_email ? ` (${file.uploaded_by_email})` : ''}
                    {' · '}
                    {formatDateTime(file.created_at)}
                    {' · '}
                    <span className={roleClass(file.uploaded_by_role)}>{roleLabel(file.uploaded_by_role)}</span>
                  </div>
                  {(() => {
                    const commentText = file.upload_comment && file.upload_comment.trim()
                      ? file.upload_comment.trim()
                      : 'No comment added'
                    const isLong = commentText.length > 120
                    const expanded = Boolean(expandedComments[file.id])
                    return (
                      <>
                        <div className={`supporting-file-comment${expanded ? ' expanded' : ''}`}>
                          {isLong && !expanded ? `${commentText.slice(0, 120)}...` : commentText}
                        </div>
                        {isLong && (
                          <button
                            type="button"
                            className="supporting-file-comment-toggle"
                            onClick={() => toggleComment(file.id)}
                          >
                            {expanded ? 'View less' : 'View more'}
                          </button>
                        )}
                      </>
                    )
                  })()}
                </div>
                <div className="supporting-file-right">
                  <span className="file-size">{formatSize(file.file_size || 0)}</span>
                  <span className="file-status file-status--uploaded">Uploaded</span>
                  {file.download_url && (
                    <a className="ap-btn ap-btn--sm admin-btn-view" href={file.download_url} target="_blank" rel="noreferrer">Download</a>
                  )}
                  {!readonly && (
                    <button type="button" className="file-remove-btn supporting-file-remove-btn" onClick={() => removeExisting(file)}>Remove</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!readonly && onUpload && (
        <div className="file-upload-actions">
          <button
            type="button"
            className="primary-action-btn"
            onClick={submitUpload}
            disabled={uploading || files.length === 0}
          >
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      )}
    </div>
  )
}
