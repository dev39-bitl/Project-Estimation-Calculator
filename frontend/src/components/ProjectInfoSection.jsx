import React from 'react'

function ProjectInfoSection({ projectInfo, setProjectInfo }) {
  const handleChange = (field, value) => {
    setProjectInfo(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="card">
      <h3>Project Info</h3>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="muted">Project Name *</label>
          <input
            type="text"
            value={projectInfo.name}
            onChange={e => handleChange('name', e.target.value)}
            placeholder="e.g., E-Commerce Platform"
            required
          />
        </div>

        <div>
          <label className="muted">Client Name (Optional)</label>
          <input
            type="text"
            value={projectInfo.clientName || ''}
            onChange={e => handleChange('clientName', e.target.value)}
            placeholder="e.g., ABC Corporation"
          />
        </div>

        <div>
          <label className="muted">Project Type</label>
          <input
            type="text"
            value={projectInfo.projectType || ''}
            onChange={e => handleChange('projectType', e.target.value)}
            placeholder="e.g., SaaS Platform, E-Commerce Website"
          />
        </div>

        <div>
          <label className="muted">Project Description</label>
          <textarea
            value={projectInfo.description}
            onChange={e => handleChange('description', e.target.value)}
            placeholder="Brief summary of project scope and goals"
            rows={4}
          />
        </div>
      </div>
    </div>
  )
}

export default ProjectInfoSection
