import React from 'react'

function TechStackSection({ techStack, setTechStack }) {
  const handleChange = (field, value) => {
    setTechStack(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="card">
      <h3>Technology Stack</h3>
      <div style={{ marginTop: 14, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="muted">Primary Technology / Platform *</label>
          <input
            type="text"
            value={techStack.primary || ''}
            onChange={e => handleChange('primary', e.target.value)}
            placeholder="e.g., WordPress, React, Laravel, Shopify, Custom Web App, Mobile App"
            required
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Enter the main technology or platform for this project.
          </div>
        </div>

        <div>
          <label className="muted">Frontend (Optional)</label>
          <input
            type="text"
            value={techStack.frontend || ''}
            onChange={e => handleChange('frontend', e.target.value)}
            placeholder="e.g., React, Vue, Angular"
          />
        </div>

        <div>
          <label className="muted">Backend (Optional)</label>
          <input
            type="text"
            value={techStack.backend || ''}
            onChange={e => handleChange('backend', e.target.value)}
            placeholder="e.g., Python FastAPI, Node.js, Laravel"
          />
        </div>

        <div>
          <label className="muted">Database (Optional)</label>
          <input
            type="text"
            value={techStack.database || ''}
            onChange={e => handleChange('database', e.target.value)}
            placeholder="e.g., PostgreSQL, MongoDB, MySQL"
          />
        </div>

        <div>
          <label className="muted">Mobile (Optional)</label>
          <input
            type="text"
            value={techStack.mobile || ''}
            onChange={e => handleChange('mobile', e.target.value)}
            placeholder="e.g., iOS, Android, React Native"
          />
        </div>

        <div>
          <label className="muted">CMS / Platform (Optional)</label>
          <input
            type="text"
            value={techStack.platform || ''}
            onChange={e => handleChange('platform', e.target.value)}
            placeholder="e.g., WordPress, Shopify, Custom CMS"
          />
        </div>

        <div>
          <label className="muted">Cloud / Hosting (Optional)</label>
          <input
            type="text"
            value={techStack.cloud || ''}
            onChange={e => handleChange('cloud', e.target.value)}
            placeholder="e.g., AWS, Azure, GCP, Vercel"
          />
        </div>

        <div>
          <label className="muted">AI / Automation (Optional)</label>
          <input
            type="text"
            value={techStack.ai || ''}
            onChange={e => handleChange('ai', e.target.value)}
            placeholder="e.g., ChatGPT Integration, ML Model, Automation"
          />
        </div>
      </div>
    </div>
  )
}

export default TechStackSection
