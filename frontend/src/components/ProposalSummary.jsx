import React, { useState, useRef } from 'react'
import FormattedProposalSummary from './FormattedProposalSummary'

function ProposalSummary({ breakdown, projectInfo, techStack, modules }) {
  const [proposalText, setProposalText] = useState('')
  const [isEditingProposal, setIsEditingProposal] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState('')
  const copyTimeoutRef = useRef(null)

  const generateProposalText = () => {
    if (!breakdown) return ''

    const heading = 'Fixed-Cost Project Estimate'
    const projectLines = [
      `Project: ${projectInfo.name || 'Untitled Project'}`,
      `Client: ${projectInfo.clientName || 'Client Name'}`,
      `Project Type: ${projectInfo.projectType || 'Fixed-Cost Delivery'}`,
      `Primary Technology: ${techStack.primary || 'Not specified'}`,
      '',
    ]

    const scopeLines = (modules || []).flatMap(module => {
      const moduleHeader = `- ${module.name || 'Untitled Module'}`
      const featureLines = (module.features || []).map(feature => {
        const featureTitle = feature.name || 'Untitled Feature'
        const description = feature.description?.trim() ? `: ${feature.description.trim()}` : ''
        return `  - ${featureTitle}${description}`
      })
      return [moduleHeader, ...featureLines]
    })

    const noteLines = []
    if (projectInfo.description?.trim()) {
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

    const lines = [
      heading,
      '',
      ...projectLines,
      'Scope Summary:',
      ...(scopeLines.length ? scopeLines : ['- Scope to be finalized']),
      '',
      `Estimated Implementation Hours: ${breakdown.total_hours}h`,
      `Final Fixed Project Cost: $${breakdown.total_fixed_cost.toLocaleString()}`,
      '',
      'Notes:',
      ...(finalNotes.length ? finalNotes.map(t => `- ${t}`) : ['- No additional notes provided.']),
    ]

    return lines.join('\n')
  }

  const displayText = isEditingProposal ? proposalText : (proposalText || generateProposalText())

  const handleCopyProposal = async () => {
    try {
      await navigator.clipboard.writeText(displayText)
      setCopyFeedback('Copied')
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopyFeedback(''), 2000)
    } catch (err) {
      setCopyFeedback('Unable to copy')
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopyFeedback(''), 2000)
    }
  }

  return (
    <div className="card proposal-summary-card">
      <div className="space-between" style={{ marginBottom: 14 }}>
        <h3>Client Proposal Summary</h3>
        <div className="proposal-summary-actions">
          <button
            className="btn btn-ghost"
            onClick={handleCopyProposal}
            title="Copy proposal to clipboard"
          >
            {copyFeedback || 'Copy'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (!isEditingProposal) {
                setProposalText(generateProposalText())
              }
              setIsEditingProposal(prev => !prev)
            }}
          >
            {isEditingProposal ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      <div className="proposal-summary-scroll">
        {isEditingProposal ? (
          <textarea
            value={proposalText}
            onChange={e => setProposalText(e.target.value)}
            className="proposal-editor"
          />
        ) : (
          <FormattedProposalSummary
            projectInfo={projectInfo}
            techStack={techStack}
            modules={modules}
            breakdown={breakdown}
            proposalText={displayText}
          />
        )}
      </div>

    </div>
  )
}

export default ProposalSummary
