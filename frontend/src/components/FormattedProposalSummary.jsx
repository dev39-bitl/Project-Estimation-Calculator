import React from 'react'

/**
 * Renders proposal summary as structured HTML with headings, lists, and paragraphs.
 * Accepts either raw text or structured data and generates appropriate display format.
 */
function FormattedProposalSummary({ projectInfo, techStack, modules, breakdown, proposalText }) {
  const hasStructuredData = projectInfo || techStack || modules || breakdown
  
  // If we have structured data, render formatted HTML. Otherwise parse plain text.
  if (hasStructuredData && breakdown) {
    const noteLines = []
    if (projectInfo?.description?.trim()) {
      noteLines.push(projectInfo.description.trim())
    }
    ;(modules || []).forEach(module => {
      ;(module.features || []).forEach(feature => {
        if (feature.description?.trim()) {
          noteLines.push(`${feature.name || 'Feature'}: ${feature.description.trim()}`)
        }
      })
    })
    const finalNotes = [...new Set(noteLines)].slice(0, 8)

    return (
      <div className="proposal-formatted-html">
        <section className="proposal-section">
          <h3 className="proposal-title">Fixed-Cost Project Estimate</h3>
        </section>

        <section className="proposal-section">
          <h4 className="proposal-subtitle">Project Information</h4>
          <ul className="proposal-list">
            <li><strong>Project:</strong> {projectInfo?.name || 'Untitled Project'}</li>
            <li><strong>Client:</strong> {projectInfo?.clientName || 'Client Name'}</li>
            <li><strong>Project Type:</strong> {projectInfo?.projectType || 'Fixed-Cost Delivery'}</li>
            <li><strong>Primary Technology:</strong> {techStack?.primary || 'Not specified'}</li>
          </ul>
        </section>

        {modules && modules.length > 0 && (
          <section className="proposal-section">
            <h4 className="proposal-subtitle">Scope Summary</h4>
            <ul className="proposal-scope-list">
              {modules.map((module, modIdx) => (
                <li key={`mod-${modIdx}`} className="proposal-module-item">
                  <strong>{module.name || 'Untitled Module'}</strong>
                  {module.features && module.features.length > 0 && (
                    <ul className="proposal-features-sublist">
                      {module.features.map((feature, fIdx) => (
                        <li key={`feat-${modIdx}-${fIdx}`}>
                          <span className="proposal-feature-name">{feature.name || 'Untitled Feature'}</span>
                          {feature.description?.trim() && (
                            <p className="proposal-feature-description">{feature.description.trim()}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="proposal-section">
          <h4 className="proposal-subtitle">Estimate Summary</h4>
          <ul className="proposal-list">
            <li><strong>Estimated Implementation Hours:</strong> {breakdown?.total_hours}h</li>
            <li><strong>Final Fixed Project Cost:</strong> ${breakdown?.total_fixed_cost.toLocaleString()}</li>
          </ul>
        </section>

        {finalNotes.length > 0 && (
          <section className="proposal-section">
            <h4 className="proposal-subtitle">Notes</h4>
            <ul className="proposal-list">
              {finalNotes.map((note, idx) => (
                <li key={`note-${idx}`}>{note}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    )
  }

  // Fallback: render plain text in pre-formatted style if no structured data
  return (
    <div className="proposal-formatted-text">
      <pre>{proposalText || 'No proposal content available.'}</pre>
    </div>
  )
}

export default FormattedProposalSummary
