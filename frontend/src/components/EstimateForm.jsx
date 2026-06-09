import React, { useState, useEffect } from 'react'
import { estimateAPI } from '../services/api'
import './EstimateForm.css'

function EstimateForm({ onEstimateCreated, loadEstimate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [complexityScore, setComplexityScore] = useState(5)
  const [resourceCost, setResourceCost] = useState(75)
  const [features, setFeatures] = useState([
    { id: Date.now(), title: 'Feature 1', hours: 8, costPerHour: 75 },
  ])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (loadEstimate) {
      // load basic fields from backend estimate; features (frontend-only) try from localStorage
      setName(loadEstimate.name || '')
      setDescription(loadEstimate.description || '')
      setResourceCost(loadEstimate.resource_cost || 75)
      setComplexityScore(loadEstimate.complexity_score || 5)

      const saved = localStorage.getItem(`features:${loadEstimate.id}`)
      if (saved) setFeatures(JSON.parse(saved))
    }
  }, [loadEstimate])

  const addFeature = () => {
    setFeatures(prev => [...prev, { id: Date.now(), title: '', hours: 1, costPerHour: resourceCost }])
  }

  const updateFeature = (id, key, value) => {
    setFeatures(prev => prev.map(f => (f.id === id ? { ...f, [key]: value } : f)))
  }

  const removeFeature = (id) => {
    setFeatures(prev => prev.filter(f => f.id !== id))
  }

  const calculateTotals = () => {
    const totalHours = features.reduce((s, f) => s + Number(f.hours || 0), 0)
    const totalCost = features.reduce((s, f) => s + (Number(f.hours || 0) * Number(f.costPerHour || resourceCost)), 0)
    return { totalHours, totalCost }
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const { totalHours, totalCost } = calculateTotals()

      const payload = {
        name: name || 'Untitled Proposal',
        description,
        effort_hours: Math.max(0.5, Math.round(totalHours * 10) / 10),
        complexity_score: Number(complexityScore),
        resource_cost: Number(resourceCost),
      }

      const res = await estimateAPI.createEstimate(payload)
      const saved = res.data
      // store features locally keyed by backend id so we can reload them later
      try { localStorage.setItem(`features:${saved.id}`, JSON.stringify(features)) } catch (e) { /* ignore */ }

      setSuccess('Saved estimate to server')
      onEstimateCreated && onEstimateCreated(saved)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save estimate')
    } finally {
      setLoading(false)
    }
  }

  const handleCalculate = () => {
    // simple client-side calculate action
    setError('')
    setSuccess('')
    const { totalHours, totalCost } = calculateTotals()
    setSuccess(`Calculated: ${totalHours}h — $${totalCost.toFixed(2)}`)
  }

  const handleLoadSaved = async () => {
    setLoading(true)
    setError('')
    try {
      await estimateAPI.getAllEstimates()
      setSuccess('Loaded saved estimates in panel')
    } catch (err) {
      setError('Failed to load saved estimates')
    } finally {
      setLoading(false)
    }
  }

  const { totalHours, totalCost } = calculateTotals()

  return (
    <div className="card">
      <div className="space-between">
        <h3>Estimate Details</h3>
        <div className="muted">Proposal inputs</div>
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}
      {success && <div className="success-message" role="status">{success}</div>}

      <div style={{marginTop:12}}>
        <label className="muted">Project Name</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Client Project Name" />
      </div>

      <div style={{marginTop:10}}>
        <label className="muted">Description</label>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Short client-facing summary" />
      </div>

      <div style={{marginTop:12}} className="card">
        <div className="space-between"><strong>Features</strong><button className="btn btn-ghost" onClick={addFeature}>Add Feature</button></div>
        <div style={{marginTop:10, display:'grid', gap:10}}>
          {features.map(f => (
            <div key={f.id} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 40px',gap:8,alignItems:'center'}}>
              <input placeholder="Feature title" value={f.title} onChange={e=>updateFeature(f.id,'title',e.target.value)} />
              <input type="number" min="0" step="0.5" value={f.hours} onChange={e=>updateFeature(f.id,'hours',Number(e.target.value))} />
              <input type="number" min="0" step="0.01" value={f.costPerHour} onChange={e=>updateFeature(f.id,'costPerHour',Number(e.target.value))} />
              <button className="btn btn-ghost" onClick={()=>removeFeature(f.id)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:'flex',gap:12,marginTop:14,alignItems:'center'}}>
        <div style={{flex:1}}>
          <label className="muted">Complexity (1-10)</label>
          <input type="range" min={1} max={10} value={complexityScore} onChange={e=>setComplexityScore(e.target.value)} />
          <div className="muted">{complexityScore}</div>
        </div>

        <div style={{width:140}}>
          <label className="muted">Default Hourly Rate</label>
          <input type="number" value={resourceCost} onChange={e=>setResourceCost(Number(e.target.value))} />
        </div>
      </div>

      <div style={{display:'flex',gap:10,marginTop:16}}>
        <button className="btn btn-primary" onClick={handleCalculate} type="button">Calculate Estimate</button>
        <button className="primary-action-btn" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Estimate'}</button>
        <button className="btn btn-ghost" onClick={handleLoadSaved} type="button">Load Saved Estimates</button>
      </div>

      <div style={{marginTop:16}} className="card">
        <div className="space-between"><div className="muted">Total Hours</div><div>{totalHours} h</div></div>
        <div className="space-between" style={{marginTop:8}}><div className="muted">Total Cost</div><div>${totalCost.toFixed(2)}</div></div>
      </div>
    </div>
  )
}

export default EstimateForm
