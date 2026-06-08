/**
 * Proposal Export Utility
 * Handles exporting fixed-cost proposals as text/PDF downloads
 */

export const generateProposalDocument = (projectInfo, breakdown) => {
  if (!breakdown) return ''

  const today = new Date().toLocaleDateString()
  const lines = [
    '═══════════════════════════════════════════════════════════',
    '          FIXED-COST PROJECT ESTIMATION PROPOSAL',
    '═══════════════════════════════════════════════════════════',
    '',
    `Date: ${today}`,
    `Project: ${projectInfo.name || 'Untitled Project'}`,
    projectInfo.clientName ? `Client: ${projectInfo.clientName}` : '',
    '',
    '───────────────────────────────────────────────────────────',
    'PROJECT OVERVIEW',
    '───────────────────────────────────────────────────────────',
    projectInfo.description || 'Project scope and objectives as agreed.',
    '',
    '───────────────────────────────────────────────────────────',
    'SCOPE BREAKDOWN',
    '───────────────────────────────────────────────────────────',
  ]

  // Module breakdown
  breakdown.modules.forEach(mod => {
    lines.push(`\n${mod.module_name}`)
    lines.push(`  Features: ${mod.feature_count}`)
    lines.push(`  Estimated Hours: ${mod.total_hours}h`)
    lines.push(`  Estimated Cost: $${mod.total_cost.toLocaleString()}`)
    
    mod.features.forEach(f => {
      lines.push(`    • ${f.feature_name} (${f.feature_type})`)
      lines.push(`      - Complexity: ${f.complexity}/10`)
      lines.push(`      - Calculated Hours: ${f.calculated_hours}h`)
      lines.push(`      - Role: ${f.assigned_role}`)
      if (!f.is_billable) lines.push('      - [Non-billable]')
    })
  })

  lines.push('')
  lines.push('───────────────────────────────────────────────────────────')
  lines.push('COST BREAKDOWN')
  lines.push('───────────────────────────────────────────────────────────')
  lines.push(`Development Subtotal        ${breakdown.subtotal_hours}h     $${breakdown.subtotal_cost.toLocaleString()}`)
  lines.push(`QA Testing (${breakdown.qa_percentage}%)              ${breakdown.qa_hours}h     $${breakdown.qa_cost.toLocaleString()}`)
  lines.push(`Project Management (${breakdown.pm_percentage}%)     ${breakdown.pm_hours}h     $${breakdown.pm_cost.toLocaleString()}`)
  lines.push(`Risk Buffer (${breakdown.risk_percentage}%)            ${breakdown.risk_hours}h     $${breakdown.risk_cost.toLocaleString()}`)
  lines.push('─────────────────────────────────────────────────────────')
  lines.push(`TOTAL ESTIMATED HOURS       ${breakdown.total_hours}h`)
  lines.push(`TOTAL FIXED PROJECT COST    $${breakdown.total_fixed_cost.toLocaleString()}`)
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('')
  lines.push('───────────────────────────────────────────────────────────')
  lines.push('ASSUMPTIONS & EXCLUSIONS')
  lines.push('───────────────────────────────────────────────────────────')
  lines.push('✓ This is a fixed-price estimate for the defined scope.')
  lines.push('✓ The estimate includes design, development, testing, and QA.')
  lines.push('✓ Assumes standard business hours and working days.')
  lines.push('✓ Third-party service integrations may incur additional costs.')
  lines.push('✓ This proposal is valid for 30 days from the issue date.')
  lines.push('')
  lines.push('EXCLUSIONS:')
  lines.push('✗ Hosting and infrastructure setup (separate from development).')
  lines.push('✗ Post-launch support and maintenance.')
  lines.push('✗ Training and documentation (unless specified).')
  lines.push('✗ Changes to approved scope.')
  lines.push('')
  lines.push('───────────────────────────────────────────────────────────')
  lines.push('SCOPE CHANGE POLICY')
  lines.push('───────────────────────────────────────────────────────────')
  lines.push('Any changes or additions to the defined scope will be subject to:')
  lines.push('1. Change request review and assessment.')
  lines.push('2. Updated cost and timeline estimate.')
  lines.push('3. Client approval before implementation.')
  lines.push('')
  lines.push('───────────────────────────────────────────────────────────')
  lines.push('NEXT STEPS')
  lines.push('───────────────────────────────────────────────────────────')
  lines.push('1. Review this proposal and confirm scope alignment.')
  lines.push('2. Schedule project kickoff meeting.')
  lines.push('3. Sign contract and finalize payment terms.')
  lines.push('4. Begin project initiation and planning.')
  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('For questions or clarifications, please contact us.')
  lines.push('═══════════════════════════════════════════════════════════')

  return lines.join('\n')
}

export const downloadProposalAsText = (projectInfo, breakdown) => {
  const content = generateProposalDocument(projectInfo, breakdown)
  const element = document.createElement('a')
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content))
  element.setAttribute('download', `proposal-${projectInfo.name || 'estimate'}-${Date.now()}.txt`)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

export const downloadProposalAsHTML = (projectInfo, breakdown) => {
  const content = generateProposalDocument(projectInfo, breakdown)
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Project Estimation Proposal</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 40px; }
    h1 { text-align: center; color: #2c3e50; }
    h2 { color: #34495e; margin-top: 30px; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    .cost-section { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .total { font-weight: bold; font-size: 18px; color: #27ae60; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    td, th { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background: #3498db; color: white; }
    .highlight { background: #fff3cd; padding: 2px 5px; }
    footer { text-align: center; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; color: #7f8c8d; }
  </style>
</head>
<body>
  <h1>Fixed-Cost Project Estimation</h1>
  <p><strong>Project:</strong> ${projectInfo.name || 'Untitled Project'}</p>
  ${projectInfo.clientName ? `<p><strong>Client:</strong> ${projectInfo.clientName}</p>` : ''}
  <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>

  <h2>Project Overview</h2>
  <p>${projectInfo.description || 'Project scope and objectives as agreed.'}</p>

  <h2>Cost Summary</h2>
  <div class="cost-section">
    <table>
      <tr>
        <th>Item</th>
        <th>Hours</th>
        <th>Cost</th>
      </tr>
      <tr>
        <td>Development Subtotal</td>
        <td>${breakdown.subtotal_hours}h</td>
        <td>$${breakdown.subtotal_cost.toLocaleString()}</td>
      </tr>
      <tr>
        <td>QA Testing (${breakdown.qa_percentage}%)</td>
        <td>${breakdown.qa_hours}h</td>
        <td>$${breakdown.qa_cost.toLocaleString()}</td>
      </tr>
      <tr>
        <td>Project Management (${breakdown.pm_percentage}%)</td>
        <td>${breakdown.pm_hours}h</td>
        <td>$${breakdown.pm_cost.toLocaleString()}</td>
      </tr>
      <tr>
        <td>Risk Buffer (${breakdown.risk_percentage}%)</td>
        <td>${breakdown.risk_hours}h</td>
        <td>$${breakdown.risk_cost.toLocaleString()}</td>
      </tr>
      <tr style="font-weight: bold; background: #e8f5e9;">
        <td>TOTAL</td>
        <td>${breakdown.total_hours}h</td>
        <td class="total">$${breakdown.total_fixed_cost.toLocaleString()}</td>
      </tr>
    </table>
  </div>

  <h2>Scope Breakdown</h2>
  ${breakdown.modules.map(m => `
    <h3>${m.module_name}</h3>
    <p>Features: ${m.feature_count} | Hours: ${m.total_hours}h | Cost: $${m.total_cost.toLocaleString()}</p>
  `).join('')}

  <h2>Assumptions & Exclusions</h2>
  <ul>
    <li>Fixed-price estimate for the defined scope.</li>
    <li>Assumes standard business hours and working days.</li>
    <li>Proposal valid for 30 days from issue date.</li>
    <li>Excludes hosting, post-launch support, and scope changes.</li>
  </ul>

  <footer>
    <p>For questions, please contact us.</p>
  </footer>
</body>
</html>
`
  const element = document.createElement('a')
  element.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent))
  element.setAttribute('download', `proposal-${projectInfo.name || 'estimate'}-${Date.now()}.html`)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}
