import React, { useState, useEffect } from 'react'
import { estimateAPI } from '../services/api'
import './EstimateList.css'

function EstimateList({ refresh }) {
  const [estimates, setEstimates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchEstimates()
  }, [refresh])

  const fetchEstimates = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await estimateAPI.getAllEstimates(0, 100)
      setEstimates(response.data)
    } catch (err) {
      setError('Failed to fetch estimates')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this estimate?')) {
      try {
        await estimateAPI.deleteEstimate(id)
        setEstimates(estimates.filter(e => e.id !== id))
      } catch (err) {
        setError('Failed to delete estimate')
      }
    }
  }

  return (
    <div className="estimate-list">
      <h2>Project Estimates</h2>

      {error && <div className="error-message">{error}</div>}

      {loading && <div className="loading">Loading estimates...</div>}

      {!loading && estimates.length === 0 && (
        <div className="no-estimates">No estimates yet. Create one to get started!</div>
      )}

      {!loading && estimates.length > 0 && (
        <div className="estimates-grid">
          {estimates.map(estimate => (
            <div key={estimate.id} className="estimate-card">
              <div className="estimate-header">
                <h3>{estimate.name}</h3>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(estimate.id)}
                  title="Delete estimate"
                >
                  ✕
                </button>
              </div>

              {estimate.description && (
                <p className="description">{estimate.description}</p>
              )}

              <div className="estimate-details">
                <div className="detail-item">
                  <span className="label">Effort Hours:</span>
                  <span className="value">{estimate.effort_hours}h</span>
                </div>
                <div className="detail-item">
                  <span className="label">Complexity:</span>
                  <span className="value">{estimate.complexity_score}/10</span>
                </div>
                <div className="detail-item">
                  <span className="label">Hourly Rate:</span>
                  <span className="value">${estimate.resource_cost.toFixed(2)}</span>
                </div>
              </div>

              <div className="estimate-footer">
                <div className="total-cost">
                  <span className="label">Total Cost:</span>
                  <span className="amount">${estimate.total_cost.toFixed(2)}</span>
                </div>
              </div>

              <div className="estimate-meta">
                <small>
                  Created: {new Date(estimate.created_at).toLocaleDateString()}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default EstimateList
