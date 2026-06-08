import React from 'react'

const COMPLEXITY_MULTIPLIERS = {
  low: 1.0,
  medium: 1.5,
  high: 2.0,
}

function EstimateSummary({ modules, internalCosts }) {
  if (!modules || modules.length === 0) {
    return (
      <div className="card">
        <h3>Estimate Summary</h3>
        <div className="loading">Add features to view the estimate breakdown.</div>
      </div>
    )
  }

  // Calculate breakdown
  let subtotalHours = 0
  let billableHours = 0

  modules.forEach(module => {
    module.features?.forEach(feature => {
      const multiplier = COMPLEXITY_MULTIPLIERS[feature.complexity] || 1.0
      const featureHours = (feature.estimatedHours || 0) * multiplier
      subtotalHours += featureHours
      if (feature.isBillable) {
        billableHours += featureHours
      }
    })
  })

  const hourlyRate = internalCosts?.hourlyRate || 20
  const qaPercent = (internalCosts?.qaPercentage || 15) / 100
  const pmPercent = (internalCosts?.pmPercentage || 10) / 100
  const riskPercent = (internalCosts?.riskPercentage || 10) / 100

  const qaHours = subtotalHours * qaPercent
  const pmHours = subtotalHours * pmPercent
  const riskHours = subtotalHours * riskPercent

  const subtotalCost = billableHours * hourlyRate
  const qaCost = qaHours * hourlyRate
  const pmCost = pmHours * hourlyRate
  const riskCost = riskHours * hourlyRate

  const totalHours = subtotalHours + qaHours + pmHours + riskHours
  const totalCost = subtotalCost + qaCost + pmCost + riskCost

  const metricCards = [
    { key: 'feature-hours', icon: '🧩', label: 'Feature Hours', value: `${subtotalHours.toFixed(1)}h` },
    { key: 'qa-hours', icon: '✅', label: 'QA Hours', badge: `${(qaPercent * 100).toFixed(0)}%`, value: `${qaHours.toFixed(1)}h` },
    { key: 'pm-hours', icon: '📋', label: 'PM Hours', badge: `${(pmPercent * 100).toFixed(0)}%`, value: `${pmHours.toFixed(1)}h` },
    { key: 'risk-hours', icon: '⚠️', label: 'Risk Hours', badge: `${(riskPercent * 100).toFixed(0)}%`, value: `${riskHours.toFixed(1)}h` },
    { key: 'feature-cost', icon: '💻', label: 'Feature Cost', value: `$${subtotalCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}` },
    { key: 'qa-cost', icon: '🧪', label: 'QA Cost', value: `$${qaCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}` },
    { key: 'pm-cost', icon: '🗂️', label: 'PM Cost', value: `$${pmCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}` },
    { key: 'risk-cost', icon: '🛡️', label: 'Risk Cost', value: `$${riskCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}` },
    { key: 'total-hours', icon: '⏱️', label: 'Total Hours', value: `${totalHours.toFixed(1)}h`, strong: true },
    { key: 'final-cost', icon: '💰', label: 'Final Fixed Cost', value: `$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, strong: true },
  ]

  return (
    <div className="card">
      <h3>Estimate Breakdown</h3>

      <div className="breakdown-metric-grid">
        {metricCards.map(card => (
          <div key={card.key} className={`breakdown-metric-card ${card.strong ? 'strong' : ''}`}>
            <div className="breakdown-metric-icon">{card.icon}</div>
            <div className="breakdown-metric-content">
              <div className="breakdown-metric-label-row">
                <span className="breakdown-metric-label">{card.label}</span>
                {card.badge && <span className="breakdown-metric-badge">{card.badge}</span>}
              </div>
              <div className="breakdown-metric-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
        Based on {subtotalHours.toFixed(1)} estimated feature hours with {qaPercent * 100}% QA, {pmPercent * 100}% PM, and {riskPercent * 100}% risk buffer. Non-billable features included in hours but excluded from cost.
      </div>
    </div>
  )
}

export default EstimateSummary
