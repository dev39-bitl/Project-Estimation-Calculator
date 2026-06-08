import React from 'react'

const COMPLEXITY_OPTIONS = [
  { label: 'Low', value: 'low', multiplier: 1.0 },
  { label: 'Medium', value: 'medium', multiplier: 1.5 },
  { label: 'High', value: 'high', multiplier: 2.0 },
]

function ModulesSection({ modules, setModules }) {
  const addModule = () => {
    const newModule = {
      id: Date.now(),
      name: `Module ${modules.length + 1}`,
      description: '',
      features: [],
    }
    setModules(prev => [...prev, newModule])
  }

  const updateModule = (moduleId, key, value) => {
    setModules(prev => prev.map(m => (m.id === moduleId ? { ...m, [key]: value } : m)))
  }

  const deleteModule = (moduleId) => {
    setModules(prev => prev.filter(m => m.id !== moduleId))
  }

  const addFeature = (moduleId) => {
    setModules(prev =>
      prev.map(m =>
        m.id === moduleId
          ? {
              ...m,
              features: [
                ...m.features,
                {
                  id: Date.now(),
                  name: `Feature ${m.features.length + 1}`,
                  description: '',
                  complexity: 'medium',
                  estimatedHours: 8,
                  isBillable: true,
                },
              ],
            }
          : m
      )
    )
  }

  const updateFeature = (moduleId, featureId, key, value) => {
    setModules(prev =>
      prev.map(m =>
        m.id === moduleId
          ? {
              ...m,
              features: m.features.map(f =>
                f.id === featureId ? { ...f, [key]: value } : f
              ),
            }
          : m
      )
    )
  }

  const deleteFeature = (moduleId, featureId) => {
    setModules(prev =>
      prev.map(m =>
        m.id === moduleId
          ? { ...m, features: m.features.filter(f => f.id !== featureId) }
          : m
      )
    )
  }

  return (
    <div className="card">
      <div className="space-between">
        <h3>Modules & Features</h3>
        <button className="btn btn-ghost" onClick={addModule}>+ Add Module</button>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {modules.map(module => (
          <div key={module.id} className="module-card">
            <div className="module-header">
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={module.name}
                  onChange={e => updateModule(module.id, 'name', e.target.value)}
                  placeholder="Module name"
                  className="module-title"
                />
                <textarea
                  value={module.description}
                  onChange={e => updateModule(module.id, 'description', e.target.value)}
                  placeholder="Module scope / description"
                  rows={2}
                  className="module-description"
                />
              </div>
              <button className="btn btn-ghost" onClick={() => deleteModule(module.id)}>Delete</button>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="space-between" style={{ marginBottom: 10 }}>
                <span className="muted">Features ({module.features.length})</span>
                <button className="btn btn-ghost" onClick={() => addFeature(module.id)}>+ Add Feature</button>
              </div>

              {module.features.length === 0 && <div className="loading">No features added yet.</div>}

              {module.features.map(feature => (
                <div key={feature.id} className="feature-grid">
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="muted">Feature Title *</label>
                    <input
                      type="text"
                      value={feature.name}
                      onChange={e => updateFeature(module.id, feature.id, 'name', e.target.value)}
                      placeholder="e.g., User login, Product listing, Payment integration"
                      required
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="muted">Feature Description / Requirements</label>
                    <textarea
                      value={feature.description || ''}
                      onChange={e => updateFeature(module.id, feature.id, 'description', e.target.value)}
                      placeholder="Describe what this feature entails and any specific requirements"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="muted">Estimated Hours *</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={feature.estimatedHours}
                      onChange={e => updateFeature(module.id, feature.id, 'estimatedHours', Number(e.target.value))}
                      placeholder="e.g., 8"
                      required
                    />
                  </div>

                  <div>
                    <label className="muted">Complexity *</label>
                    <select
                      value={feature.complexity}
                      onChange={e => updateFeature(module.id, feature.id, 'complexity', e.target.value)}
                    >
                      {COMPLEXITY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label} ({option.multiplier}x)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <label className="muted" style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={feature.isBillable}
                        onChange={e => updateFeature(module.id, feature.id, 'isBillable', e.target.checked)}
                        style={{ marginRight: 6 }}
                      />
                      Billable
                    </label>
                    <button className="btn btn-ghost" onClick={() => deleteFeature(module.id, feature.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ModulesSection

