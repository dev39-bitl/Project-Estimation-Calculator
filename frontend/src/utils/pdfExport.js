/**
 * Brainium Professional Estimate PDF Export
 * Opens a styled HTML page in a new tab ready to Print → Save as PDF
 */

function fmt(num, currency = 'USD') {
  return `${currency} ${Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtHours(h) {
  return `${Number(h || 0).toFixed(1)}h`
}

function safeStr(v, fallback = '—') {
  return v ? String(v) : fallback
}

function techStackRows(ts) {
  if (!ts || typeof ts !== 'object') return ''
  const labels = {
    frontend: 'Frontend',
    backend: 'Backend',
    database: 'Database',
    platform: 'Platform / CMS',
    stackLevel: 'Stack Complexity',
  }
  return Object.entries(ts)
    .filter(([, v]) => v)
    .map(([k, v]) => `
      <tr>
        <td class="ts-key">${labels[k] || k.charAt(0).toUpperCase() + k.slice(1)}</td>
        <td>${safeStr(v)}</td>
      </tr>`)
    .join('')
}

function modulesSection(modules, currency) {
  if (!modules || modules.length === 0) return ''
  return modules.map(mod => `
    <div class="module-block">
      <div class="module-title">${safeStr(mod.name)}</div>
      ${mod.description ? `<div class="module-desc">${mod.description}</div>` : ''}
      ${(mod.features || []).length > 0 ? `
      <table class="features-table">
        <thead>
          <tr>
            <th>Feature</th>
            <th>Description</th>
            <th>Complexity</th>
            <th>Hours</th>
            <th>Billable</th>
          </tr>
        </thead>
        <tbody>
          ${mod.features.map(f => `
          <tr>
            <td>${safeStr(f.name)}</td>
            <td class="muted">${safeStr(f.notes || f.description)}</td>
            <td class="center">${typeof f.complexity === 'number' ? `${f.complexity}×` : safeStr(f.complexity)}</td>
            <td class="center">${fmtHours(f.base_hours || f.estimated_hours)}</td>
            <td class="center">${f.is_billable ? '<span class="yes">Yes</span>' : '<span class="no">No</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<p class="muted no-features">No features defined.</p>'}
    </div>`).join('')
}

function commentsSection(comments) {
  if (!comments || comments.length === 0) return ''
  return `
    <div class="section">
      <h3 class="section-title">Admin Comments</h3>
      ${comments.map(c => `
        <div class="comment-block">
          <div class="comment-meta">
            <strong>${safeStr(c.user_name, 'Admin')}</strong>
            &bull;
            <span class="muted">${new Date(c.created_at).toLocaleString()}</span>
          </div>
          <p class="comment-text">${safeStr(c.comment_text)}</p>
          ${c.file ? `<div class="comment-file">📎 ${c.file.original_filename}</div>` : ''}
        </div>`).join('')}
    </div>`
}

function versionsSection(versions) {
  if (!versions || versions.length === 0) return ''
  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number)
  return `
    <div class="section">
      <h3 class="section-title">Version History</h3>
      <table class="features-table">
        <thead>
          <tr><th>Version</th><th>Changed By</th><th>Date</th><th>Change Note</th></tr>
        </thead>
        <tbody>
          ${sorted.map(v => `
          <tr>
            <td class="center"><span class="badge-v">v${v.version_number}</span></td>
            <td>${safeStr(v.created_by_name)}</td>
            <td class="muted">${new Date(v.created_at).toLocaleDateString()}</td>
            <td>${safeStr(v.last_change_comment)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`
}

export function exportEstimatePDF(estimate, logoUrl) {
  const currency = estimate.currency || estimate.project_info?.currency || 'USD'
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const pi = estimate.project_info || {}
  const settings = estimate.settings || {}
  const qaPct = settings.qa_percentage ?? 15
  const pmPct = settings.pm_percentage ?? 10
  const riskPct = settings.risk_percentage ?? 10

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Brainium" class="brand-logo" />`
    : `<span class="brand-text">Brainium</span>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fixed-Cost Estimate — ${safeStr(estimate.name, 'Untitled')}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 18mm 15mm 18mm 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 11pt; line-height: 1.55; background: #fff; }

    /* ── Header ────────────────────────────────── */
    .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 3px solid #00AEEF; margin-bottom: 20px; }
    .brand-logo { height: 44px; object-fit: contain; }
    .brand-text { font-size: 22pt; font-weight: 800; color: #00AEEF; letter-spacing: -0.5px; }
    .header-right { text-align: right; }
    .header-right h1 { font-size: 14pt; font-weight: 700; color: #0f172a; }
    .header-right .export-date { font-size: 9pt; color: #64748b; margin-top: 2px; }

    /* ── Badges ─────────────────────────────────── */
    .badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 9pt; font-weight: 700; border: 1px solid transparent; }
    .badge-status { background: #dbeafe; color: #1e40af; border-color: #93c5fd; }
    .badge-version { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
    .badge-cost { background: #dcfce7; color: #166534; border-color: #86efac; font-size: 11pt; }
    .badge-lock-editable { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .badge-lock-locked { background: #ffedd5; color: #9a3412; border-color: #fdba74; }
    .badge-v { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 7px; font-size: 9pt; font-weight: 700; }

    /* ── Sections ───────────────────────────────── */
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11pt; font-weight: 700; color: #00AEEF; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; }

    /* ── Info grid ──────────────────────────────── */
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; }
    .info-item { display: flex; flex-direction: column; gap: 1px; }
    .info-label { font-size: 8pt; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
    .info-value { font-size: 10.5pt; color: #0f172a; font-weight: 500; }

    /* ── Tech stack ─────────────────────────────── */
    .ts-key { color: #475569; font-weight: 600; width: 170px; }

    /* ── Cost breakdown ─────────────────────────── */
    .breakdown-table { width: 100%; border-collapse: collapse; }
    .breakdown-table th, .breakdown-table td { padding: 7px 12px; text-align: left; border: 1px solid #e2e8f0; }
    .breakdown-table thead tr { background: #f8fafc; }
    .breakdown-table th { font-size: 9pt; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
    .breakdown-table .total-row td { font-weight: 700; background: #f0fdf4; color: #166534; font-size: 11pt; }
    .breakdown-table .num { text-align: right; }

    /* ── Modules ────────────────────────────────── */
    .module-block { margin-bottom: 14px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
    .module-title { background: #f8fafc; padding: 7px 12px; font-weight: 700; font-size: 10.5pt; color: #0f172a; border-bottom: 1px solid #e2e8f0; }
    .module-desc { padding: 4px 12px 0; font-size: 9pt; color: #64748b; }
    .no-features { padding: 8px 12px; font-size: 9pt; }

    /* ── Features table ─────────────────────────── */
    .features-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    .features-table th { background: #f8fafc; padding: 6px 10px; text-align: left; font-size: 8.5pt; font-weight: 700; color: #475569; border: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.04em; }
    .features-table td { padding: 6px 10px; border: 1px solid #f1f5f9; vertical-align: middle; }
    .features-table tbody tr:nth-child(even) td { background: #fafafa; }
    .center { text-align: center; }
    .yes { color: #16a34a; font-weight: 700; }
    .no { color: #9f1239; font-weight: 700; }

    /* ── Proposal summary ───────────────────────── */
    .proposal-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; font-size: 10pt; line-height: 1.65; color: #334155; white-space: pre-wrap; }

    /* ── Comments / Version ─────────────────────── */
    .comment-block { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; }
    .comment-meta { font-size: 9pt; color: #64748b; margin-bottom: 4px; }
    .comment-text { font-size: 10pt; color: #334155; white-space: pre-wrap; }
    .comment-file { font-size: 9pt; color: #2563eb; margin-top: 4px; }

    /* ── Footer ─────────────────────────────────── */
    .footer { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9pt; color: #94a3b8; }
    .footer-brand { font-weight: 700; color: #00AEEF; }

    /* ── Shared ─────────────────────────────────── */
    .muted { color: #64748b; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>${logoHtml}</div>
    <div class="header-right">
      <h1>Fixed-Cost Project Estimate</h1>
      <div class="export-date">Exported: ${today}</div>
    </div>
  </div>

  <!-- Title + badges -->
  <div style="margin-bottom:14px;">
    <h2 style="font-size:15pt;color:#0f172a;margin-bottom:8px;">${safeStr(estimate.name, 'Untitled Project')}</h2>
    <div class="badges">
      <span class="badge badge-cost">${fmt(estimate.total_fixed_cost, currency)}</span>
      <span class="badge badge-version">v${estimate.version_number || 1}</span>
      <span class="badge badge-status">${safeStr(estimate.status, 'Estimation Initiation')}</span>
      <span class="badge ${estimate.is_editable !== false ? 'badge-lock-editable' : 'badge-lock-locked'}">
        ${estimate.is_editable !== false ? 'Editable' : 'Locked'}
      </span>
    </div>
  </div>

  <!-- Project Info -->
  <div class="section">
    <h3 class="section-title">Project Information</h3>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Project Name</span><span class="info-value">${safeStr(estimate.name)}</span></div>
      <div class="info-item"><span class="info-label">Client</span><span class="info-value">${safeStr(estimate.client_name)}</span></div>
      <div class="info-item"><span class="info-label">Project Type</span><span class="info-value">${safeStr(pi.projectType)}</span></div>
      <div class="info-item"><span class="info-label">Currency</span><span class="info-value">${currency}</span></div>
      <div class="info-item"><span class="info-label">Created</span><span class="info-value">${estimate.created_at ? new Date(estimate.created_at).toLocaleDateString() : '—'}</span></div>
      <div class="info-item"><span class="info-label">Last Updated</span><span class="info-value">${estimate.updated_at ? new Date(estimate.updated_at).toLocaleDateString() : '—'}</span></div>
    </div>
  </div>

  <!-- Estimator Info -->
  <div class="section">
    <h3 class="section-title">Estimator</h3>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Name</span><span class="info-value">${safeStr(estimate.created_by_name)}</span></div>
      <div class="info-item"><span class="info-label">Email</span><span class="info-value">${safeStr(estimate.created_by_email)}</span></div>
    </div>
  </div>

  ${Object.keys(estimate.tech_stack_json || {}).filter(k => estimate.tech_stack_json[k]).length > 0 ? `
  <!-- Tech Stack -->
  <div class="section">
    <h3 class="section-title">Technology Stack</h3>
    <table class="features-table" style="max-width:500px;">
      <tbody>${techStackRows(estimate.tech_stack_json)}</tbody>
    </table>
  </div>` : ''}

  <!-- Modules & Features -->
  ${(estimate.modules || []).length > 0 ? `
  <div class="section">
    <h3 class="section-title">Modules &amp; Features</h3>
    ${modulesSection(estimate.modules, currency)}
  </div>` : ''}

  <!-- Cost Breakdown -->
  <div class="section">
    <h3 class="section-title">Estimate Breakdown</h3>
    <table class="breakdown-table">
      <thead>
        <tr><th>Item</th><th class="num">Hours</th><th class="num">Amount (${currency})</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Development Subtotal</td>
          <td class="num">${fmtHours(estimate.subtotal_hours)}</td>
          <td class="num">${fmt(estimate.subtotal_cost, currency)}</td>
        </tr>
        <tr>
          <td>QA Testing (${qaPct}%)</td>
          <td class="num">${fmtHours(estimate.qa_hours)}</td>
          <td class="num">${fmt(estimate.qa_cost, currency)}</td>
        </tr>
        <tr>
          <td>Project Management (${pmPct}%)</td>
          <td class="num">${fmtHours(estimate.pm_hours)}</td>
          <td class="num">${fmt(estimate.pm_cost, currency)}</td>
        </tr>
        <tr>
          <td>Risk Buffer (${riskPct}%)</td>
          <td class="num">${fmtHours(estimate.risk_buffer_hours)}</td>
          <td class="num">${fmt(estimate.risk_buffer_cost, currency)}</td>
        </tr>
        <tr class="total-row">
          <td>Total Fixed-Cost Estimate</td>
          <td class="num">${fmtHours(estimate.total_estimated_hours)}</td>
          <td class="num">${fmt(estimate.total_fixed_cost, currency)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${estimate.proposal_summary ? `
  <!-- Proposal Summary -->
  <div class="section">
    <h3 class="section-title">Proposal Summary</h3>
    <div class="proposal-box">${estimate.proposal_summary}</div>
  </div>` : ''}

  ${commentsSection(estimate.comments)}

  ${versionsSection(estimate.versions)}

  <!-- Footer -->
  <div class="footer">
    <span class="footer-brand">Brainium Technologies</span>
    <span>Generated ${today}</span>
    <span>Confidential — Internal Use</span>
  </div>

</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site to export PDF.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  // Delay print to allow logo image to load
  setTimeout(() => {
    win.print()
  }, 600)
}
