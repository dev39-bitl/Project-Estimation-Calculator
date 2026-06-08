import React, { useState } from 'react'
import { adminAPI } from '../../services/adminApi'

export default function AdminReports() {
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingEstimates, setLoadingEstimates] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const downloadCsv = async (apiCall, filename, setLoading) => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await apiCall()
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setSuccess(`${filename} downloaded successfully`)
    } catch (e) {
      setError(`Failed to export ${filename}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ap-card">
      <div className="ap-card-header">
        <h3 className="ap-card-title">Export Reports</h3>
      </div>

      {error && <div className="ap-alert ap-alert--error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="ap-alert ap-alert--success" style={{ marginBottom: 16 }}>{success}</div>}

      <div className="ap-report-grid">
        <div className="ap-report-card">
          <div className="ap-report-icon">👥</div>
          <h4>Users Report</h4>
          <p>Export all registered users including name, email, role, and status.</p>
          <button
            className="ap-btn ap-btn--primary"
            onClick={() => downloadCsv(adminAPI.exportUsersCsv, 'users.csv', setLoadingUsers)}
            disabled={loadingUsers}
          >
            {loadingUsers ? 'Exporting…' : 'Export Users CSV'}
          </button>
        </div>

        <div className="ap-report-card">
          <div className="ap-report-icon">📋</div>
          <h4>Estimates Report</h4>
          <p>Export all estimates including project name, client, hours, value, and creator.</p>
          <button
            className="ap-btn ap-btn--primary"
            onClick={() => downloadCsv(adminAPI.exportEstimatesCsv, 'estimates.csv', setLoadingEstimates)}
            disabled={loadingEstimates}
          >
            {loadingEstimates ? 'Exporting…' : 'Export Estimates CSV'}
          </button>
        </div>
      </div>
    </div>
  )
}
