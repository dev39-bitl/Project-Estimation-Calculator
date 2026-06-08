import React from 'react'

const COMPLEXITY_OPTIONS = [
  { label: 'Low', value: 'low', multiplier: 1.0 },
  { label: 'Medium', value: 'medium', multiplier: 1.5 },
  { label: 'High', value: 'high', multiplier: 2.0 },
]

const DEFAULT_FEATURE = (index) => ({
  id: Date.now(),
  name: `Feature ${index + 1}`,
  description: '',
  complexity: 'low',
  estimatedHours: 8,
  isBillable: true,
})

function ModulesSection({ modules, setModules }) {
  const moduleRefs = React.useRef({})
  const featureRefs = React.useRef({})

  const addModule = () => {
    const newModuleId = Date.now()
    const newModule = {
      id: newModuleId,
      name: `Module ${modules.length + 1}`,
      description: '',
      features: [],
    }
    setModules(prev => [...prev, newModule])
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        moduleRefs.current[newModuleId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  const updateModule = (moduleId, key, value) => {
    setModules(prev => prev.map(m => (m.id === moduleId ? { ...m, [key]: value } : m)))
  }

  const deleteModule = (moduleId) => {
    setModules(prev => prev.filter(m => m.id !== moduleId))
  }

  const addFeature = (moduleId) => {
    const newFeatureId = Date.now()
    setModules(prev =>
      prev.map(m =>
        m.id === moduleId
          ? {
              ...m,
              features: [
                ...m.features,
                {
                  ...DEFAULT_FEATURE(m.features.length),
                  id: newFeatureId,
                  name: `Feature ${m.features.length + 1}`,
                },
              ],
            }
          : m
      )
    )
    const key = `${moduleId}-${newFeatureId}`
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        featureRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    })
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
      <div className="mf-section-header">
        <h3>Modules &amp; Features</h3>
        <span className="mf-section-hint">Organize your project into modules, then add features inside each module.</span>
      </div>

      <div className="mf-module-list">
        {modules.length === 0 && (
          <div className="mf-empty">No modules yet. Click &ldquo;+ Add Module&rdquo; below to get started.</div>
        )}

        {modules.map((module, modIdx) => (
          <div
            key={module.id}
            className={`mf-module-card ${modIdx % 2 === 1 ? 'mf-module-card--alt' : ''}`}
            ref={el => { moduleRefs.current[module.id] = el }}
          >
            {/* Module header row */}
            <div className="mf-module-top">
              <div className="mf-module-label">Module {modIdx + 1}</div>
              <button
                className="btn mf-btn-delete-module"
                title="Delete this module"
                onClick={() => deleteModule(module.id)}
              >
                🗑 Delete Module
              </button>
            </div>

            <div className="mf-module-body">
              <div className="mf-field mf-field--full">
                <label>Module Title</label>
                <input
                  type="text"
                  value={module.name}
                  onChange={e => updateModule(module.id, 'name', e.target.value)}
                  placeholder="e.g., Authentication, Dashboard, Payments"
                  className="mf-module-title-input"
                />
              </div>
              <div className="mf-field mf-field--full">
                <label>Module Description</label>
                <textarea
                  value={module.description}
                  onChange={e => updateModule(module.id, 'description', e.target.value)}
                  placeholder="Describe the scope and purpose of this module"
                  rows={2}
                  className="mf-module-desc-input"
                />
              </div>
            </div>

            {/* Features */}
            <div className="mf-features-section">
              <div className="mf-features-header">
                <span className="mf-features-label">
                  Features
                  <span className="mf-feature-count">{module.features.length}</span>
                </span>
              </div>

              {module.features.length === 0 && (
                <div className="mf-no-features">No features yet. Click &ldquo;+ Add Feature&rdquo; below.</div>
              )}

              <div className="mf-feature-list">
                {module.features.map((feature, featIdx) => (
                  <div
                    key={feature.id}
                    className={`mf-feature-card ${featIdx % 2 === 1 ? 'mf-feature-card--alt' : ''}`}
                    ref={el => { featureRefs.current[`${module.id}-${feature.id}`] = el }}
                  >
                    <div className="mf-feature-label-row">
                      <span className="mf-feature-pill">Feature {featIdx + 1}</span>
                      <button
                        className="btn mf-btn-remove-feature"
                        title="Remove this feature"
                        onClick={() => deleteFeature(module.id, feature.id)}
                      >
                        ✕ Remove
                      </button>
                    </div>

                    <div className="mf-feature-body">
                      <div className="mf-field mf-field--full">
                        <label>Feature Title *</label>
                        <input
                          type="text"
                          value={feature.name}
                          onChange={e => updateFeature(module.id, feature.id, 'name', e.target.value)}
                          placeholder="e.g., User login, Product listing, Payment integration"
                          required
                        />
                      </div>

                      <div className="mf-field mf-field--full">
                        <label>Feature Description / Requirements</label>
                        <textarea
                          value={feature.description || ''}
                          onChange={e => updateFeature(module.id, feature.id, 'description', e.target.value)}
                          placeholder="Describe what this feature entails and any specific requirements"
                          rows={2}
                        />
                      </div>

                      <div className="mf-field">
                        <label>Estimated Hours *</label>
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

                      <div className="mf-field">
                        <label>Complexity *</label>
                        <select
                          value={feature.complexity || 'low'}
                          onChange={e => updateFeature(module.id, feature.id, 'complexity', e.target.value)}
                        >
                          {COMPLEXITY_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label} ({option.multiplier}x)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mf-field mf-field--billable">
                        <label className="mf-checkbox-label">
                          <input
                            type="checkbox"
                            checked={feature.isBillable}
                            onChange={e => updateFeature(module.id, feature.id, 'isBillable', e.target.checked)}
                          />
                          <span>Billable</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mf-add-feature-row">
                <button className="btn mf-btn-add-feature" onClick={() => addFeature(module.id)}>
                  + Add Feature
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="mf-add-module-row">
          <button className="btn mf-btn-add-module" onClick={addModule}>
            + Add Module
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModulesSection

