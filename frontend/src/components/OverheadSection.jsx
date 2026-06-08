import React from 'react'

function OverheadSection({ internalCosts, setInternalCosts }) {
  const handleChange = (field, value) => {
    setInternalCosts(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="card">
      <h3>Cost Settings</h3>
      <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
        <div className="overhead-top-row">
          <div>
            <label className="muted">Currency</label>
            <input
              type="text"
              value={internalCosts.currency || 'USD'}
              onChange={e => handleChange('currency', (e.target.value || 'USD').toUpperCase())}
              placeholder="USD"
            />
          </div>
          <div>
            <label className="muted">Internal Hourly Rate *</label>
            <input
              type="number"
              value={internalCosts.hourlyRate || 20}
              min="1"
              step="1"
              onChange={e => handleChange('hourlyRate', Number(e.target.value))}
              placeholder="20"
              required
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Internal rate only — not shown in client proposal.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <label className="muted">QA Effort %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={internalCosts.qaPercentage || 15}
              onChange={e => handleChange('qaPercentage', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="muted">PM Effort %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={internalCosts.pmPercentage || 10}
              onChange={e => handleChange('pmPercentage', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="muted">Risk Buffer %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={internalCosts.riskPercentage || 10}
              onChange={e => handleChange('riskPercentage', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
          The effort percentages above are applied to the subtotal hours to calculate additional QA, PM, and risk overhead hours. These costs are internal-only and not shown to clients.
        </div>
      </div>
    </div>
  )
}

export default OverheadSection
