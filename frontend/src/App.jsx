import React, { useState, useCallback, useEffect, useRef } from 'react'
import './App.css'
import ProjectInfoSection from './components/ProjectInfoSection'
import TechStackSection from './components/TechStackSection'
import ModulesSection from './components/ModulesSection'
import OverheadSection from './components/OverheadSection'
import EstimateSummary from './components/EstimateSummary'
import ProposalSummary from './components/ProposalSummary'
import SavedEstimates from './components/SavedEstimates'
import Login from './components/Login'
import Signup from './components/Signup'
import UserBadge from './components/UserBadge'
import AdminLogin from './components/admin/AdminLogin'
import AdminPanel from './components/admin/AdminPanel'
import { estimateAPI } from './services/api'
import { clearAuth } from './services/auth'
import { API_BASE_URL } from './config/apiConfig'
import brainiumLogo from './assets/brainium-logo.png'
import {
  defaultProjectInfo,
  defaultTechStack,
  defaultInternalCosts,
} from './data/defaults'

const WIZARD_STEPS = [
  { id: 'project', label: 'Project Info' },
  { id: 'tech', label: 'Technology' },
  { id: 'modules', label: 'Features & Modules' },
  { id: 'costs', label: 'Cost Settings' },
  { id: 'summary', label: 'Summary & Save' },
]

/**
 * Convert relative file URLs to absolute URLs
 * Uses the API_BASE_URL to construct proper URLs for both localhost and live server
 */
function toAbsoluteFileUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  // Remove /api suffix from API_BASE_URL and construct file URL
  const baseUrl = API_BASE_URL.replace('/api', '')
  return `${baseUrl}${url}`
}

function App() {
  const [projectInfo, setProjectInfo] = useState(defaultProjectInfo)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('current_user'))
    } catch (e) {
      return null
    }
  })
  const [authView, setAuthView] = useState('login')
  const [techStack, setTechStack] = useState(defaultTechStack)
  const [internalCosts, setInternalCosts] = useState(defaultInternalCosts)
  const [modules, setModules] = useState([
    {
      id: 1,
      name: 'Module 1',
      description: '',
      features: [
        {
          id: Date.now(),
          name: 'Feature 1',
          description: '',
          complexity: 'medium',
          estimatedHours: 8,
          isBillable: true,
        },
      ],
    },
  ])

  const [breakdown, setBreakdown] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [savedKey, setSavedKey] = useState(0)
  const [estimatorView, setEstimatorView] = useState('saved')
  const [wizardMode, setWizardMode] = useState('create')
  const [activeStep, setActiveStep] = useState(0)
  const [editingEstimateId, setEditingEstimateId] = useState(null)
  const [loadedEstimateId, setLoadedEstimateId] = useState(null)
  const [changeComment, setChangeComment] = useState('')
  const [loadedEstimateComments, setLoadedEstimateComments] = useState([])
  const [isLoadedEstimateEditable, setIsLoadedEstimateEditable] = useState(true)
  const [logoFailed, setLogoFailed] = useState(false)
  const [currentDraftId, setCurrentDraftId] = useState(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle')

  const autoSaveTimerRef = useRef(null)
  const lastAutoSavedPayloadRef = useRef('')
  const autoSaveStatusTimerRef = useRef(null)

  const isViewMode = wizardMode === 'view'

  const calculateBreakdown = useCallback(async () => {
    setError('')
    try {
      let subtotalHours = 0
      let billableHours = 0
      const moduleBreakdowns = []
      const complexityMultipliers = { low: 1.0, medium: 1.5, high: 2.0 }

      for (const module of modules) {
        let moduleHours = 0
        let moduleCost = 0
        const features = []

        for (const feature of module.features) {
          const multiplier = complexityMultipliers[feature.complexity] || 1.0
          const featureHours = (feature.estimatedHours || 0) * multiplier
          const featureCost = feature.isBillable ? featureHours * (internalCosts.hourlyRate || 20) : 0

          features.push({
            feature_name: feature.name || 'Untitled Feature',
            description: feature.description || '',
            complexity: feature.complexity || 'medium',
            estimated_hours: feature.estimatedHours || 0,
            hours_with_multiplier: parseFloat(featureHours.toFixed(2)),
            internal_cost: parseFloat(featureCost.toFixed(2)),
            billable: feature.isBillable,
          })

          moduleHours += featureHours
          if (feature.isBillable) {
            moduleCost += featureCost
            billableHours += featureHours
          }
          subtotalHours += featureHours
        }

        moduleBreakdowns.push({
          module_name: module.name || 'Untitled Module',
          module_description: module.description || '',
          total_hours: parseFloat(moduleHours.toFixed(2)),
          total_cost: parseFloat(moduleCost.toFixed(2)),
          features,
        })
      }

      const hourlyRate = internalCosts.hourlyRate || 20
      const qaPercent = (internalCosts.qaPercentage || 15) / 100
      const pmPercent = (internalCosts.pmPercentage || 10) / 100
      const riskPercent = (internalCosts.riskPercentage || 10) / 100

      const qaHours = subtotalHours * qaPercent
      const pmHours = subtotalHours * pmPercent
      const riskHours = subtotalHours * riskPercent
      const qaCost = qaHours * hourlyRate
      const pmCost = pmHours * hourlyRate
      const riskCost = riskHours * hourlyRate
      const totalHours = subtotalHours + qaHours + pmHours + riskHours
      const totalCost = billableHours * hourlyRate + qaCost + pmCost + riskCost

      setBreakdown({
        modules: moduleBreakdowns,
        subtotal_hours: parseFloat(subtotalHours.toFixed(2)),
        billable_hours: parseFloat(billableHours.toFixed(2)),
        qa_percentage: internalCosts.qaPercentage,
        qa_hours: parseFloat(qaHours.toFixed(2)),
        qa_cost: parseFloat(qaCost.toFixed(2)),
        pm_percentage: internalCosts.pmPercentage,
        pm_hours: parseFloat(pmHours.toFixed(2)),
        pm_cost: parseFloat(pmCost.toFixed(2)),
        risk_percentage: internalCosts.riskPercentage,
        risk_hours: parseFloat(riskHours.toFixed(2)),
        risk_cost: parseFloat(riskCost.toFixed(2)),
        total_hours: parseFloat(totalHours.toFixed(2)),
        total_fixed_cost: parseFloat(totalCost.toFixed(2)),
        hourly_rate: hourlyRate,
      })
    } catch (err) {
      setError('Unable to calculate estimate. Please review input values.')
    }
  }, [internalCosts, modules])

  const hasMinimumUsefulData = useCallback(() => {
    if ((projectInfo.name || '').trim()) return true
    if ((techStack.primary || '').trim()) return true

    for (const module of modules || []) {
      if ((module?.name || '').trim()) return true
      for (const feature of module?.features || []) {
        if ((feature?.name || '').trim()) return true
        if (Number(feature?.estimatedHours || 0) > 0) return true
      }
    }
    return false
  }, [projectInfo.name, techStack.primary, modules])

  const buildEstimatePayload = useCallback(() => ({
    name: projectInfo.name || 'Untitled Estimate',
    description: projectInfo.description || '',
    client_name: projectInfo.clientName || '',
    tech_stack_json: {
      primary: techStack.primary || '',
      frontend: techStack.frontend || '',
      backend: techStack.backend || '',
      mobile: techStack.mobile || '',
      database: techStack.database || '',
      platform: techStack.platform || '',
      cloud: techStack.cloud || '',
      ai: techStack.ai || '',
    },
    project_info: {
      projectType: projectInfo.projectType || '',
      preparedBy: 'Brainium',
      hourlyRate: internalCosts.hourlyRate || 20,
      currency: internalCosts.currency || 'USD',
    },
    modules: modules.map(m => ({
      name: m.name || 'Untitled Module',
      description: m.description || '',
      features: m.features.map(f => ({
        name: f.name || 'Untitled Feature',
        description: f.description || '',
        complexity: f.complexity || 'medium',
        estimated_hours: f.estimatedHours || 0,
        is_billable: f.isBillable !== false,
      })),
    })),
    settings: {
      qa_percentage: internalCosts.qaPercentage || 15,
      pm_percentage: internalCosts.pmPercentage || 10,
      risk_percentage: internalCosts.riskPercentage || 10,
    },
    proposal_summary: breakdown
      ? `Fixed-cost proposal for ${projectInfo.name || 'Project'} - ${breakdown.total_hours}h - $${Number(breakdown.total_fixed_cost).toLocaleString()}`
      : '',
    estimate_data_json: {
      breakdown,
      project_info: projectInfo,
      tech_stack: techStack,
      modules,
      internalCosts,
      activeStep,
      mode: wizardMode,
      currentDraftId,
    },
    is_editable: true,
    last_change_comment: editingEstimateId ? changeComment.trim() : undefined,
  }), [
    projectInfo,
    techStack,
    internalCosts,
    modules,
    breakdown,
    activeStep,
    wizardMode,
    currentDraftId,
    editingEstimateId,
    changeComment,
  ])

  const saveEstimate = async () => {
    if (isViewMode) {
      setError('View mode is read-only. Switch to edit mode to update this estimate.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (editingEstimateId && !changeComment.trim()) {
        setError('Change comment is required before updating an estimate.')
        setSaving(false)
        return
      }

      const payload = buildEstimatePayload()
      const targetId = editingEstimateId || currentDraftId || null
      console.log('[Save Estimate] mode:', targetId ? 'update' : 'create')
      console.log('[Save Estimate] payload:', payload)
      const response = targetId
        ? await estimateAPI.updateEstimate(targetId, payload)
        : await estimateAPI.createEstimate(payload)

      if (response?.data?.id) {
        setAutoSaveStatus('idle')
        setCurrentDraftId(null)
        lastAutoSavedPayloadRef.current = ''
        setSuccess(targetId ? 'Estimate updated successfully!' : 'Estimate saved successfully!')
        setSavedKey(prev => prev + 1)
        setEstimatorView('saved')
        setWizardMode('create')
        setEditingEstimateId(null)
        setLoadedEstimateId(null)
        setChangeComment('')
      } else {
        setError('Failed to save estimate: invalid backend response')
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail) {
        const detailText = typeof detail === 'string' ? detail : JSON.stringify(detail)
        setError(`Failed to save estimate: ${detailText}`)
      } else {
        setError(`Error saving estimate: ${err.message || 'Unable to connect to backend'}`)
      }
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const userRaw = localStorage.getItem('current_user')
    if (userRaw && !currentUser) {
      try {
        setCurrentUser(JSON.parse(userRaw))
      } catch (e) {
        setCurrentUser(null)
      }
    }
  }, [currentUser])

  const handleLogin = user => {
    setCurrentUser(user)
    setEstimatorView('saved')
    setActiveStep(0)
  }

  const handleLogout = () => {
    clearAuth()
    setCurrentUser(null)
    setAuthView('login')
    setEstimatorView('saved')
    setActiveStep(0)
  }

  const handleLoadEstimate = (estimate, editMode = true) => {
    if (!estimate) return
    setError('')
    setSuccess('')

    setLoadedEstimateId(estimate.id || null)
    setEditingEstimateId(estimate.id || null)
    setCurrentDraftId(null)
    setAutoSaveStatus('idle')
    lastAutoSavedPayloadRef.current = ''
    setChangeComment('')
    setLoadedEstimateComments(estimate.comments || [])
    setIsLoadedEstimateEditable(estimate.is_editable !== false)

    // If estimator opens a locked estimate, force view-only mode
    const locked = estimate.is_editable === false
    if (locked) editMode = false

    // Mark admin comments as read
    if (estimate.id) {
      estimateAPI.markCommentsRead(estimate.id).catch(() => {})
    }

    if (!editMode) {
      setEditingEstimateId(null)
      setCurrentDraftId(null)
      setWizardMode('view')
    } else {
      if (estimate.is_draft || String(estimate.status || '').toLowerCase() === 'draft') {
        setEditingEstimateId(null)
        setCurrentDraftId(estimate.id || null)
        setWizardMode('create')
      } else {
        setWizardMode('edit')
      }
    }

    const normalizeComplexity = value => {
      if (typeof value === 'string') return value
      if (Number(value) >= 2) return 'high'
      if (Number(value) <= 1) return 'low'
      return 'medium'
    }

    setProjectInfo({
      name: estimate.name || '',
      clientName: estimate.client_name || '',
      projectType: estimate.project_info?.projectType || '',
      currency: estimate.project_info?.currency || defaultProjectInfo.currency,
      description: estimate.description || '',
    })

    setTechStack({
      primary: estimate.tech_stack_json?.primary || '',
      frontend: estimate.tech_stack_json?.frontend || '',
      backend: estimate.tech_stack_json?.backend || '',
      mobile: estimate.tech_stack_json?.mobile || '',
      database: estimate.tech_stack_json?.database || '',
      platform: estimate.tech_stack_json?.platform || '',
      cloud: estimate.tech_stack_json?.cloud || '',
      ai: estimate.tech_stack_json?.ai || '',
    })

    setInternalCosts({
      currency: estimate.project_info?.currency || 'USD',
      hourlyRate: estimate.project_info?.hourlyRate ?? 20,
      qaPercentage: estimate.settings?.qa_percentage ?? defaultInternalCosts.qaPercentage,
      pmPercentage: estimate.settings?.pm_percentage ?? defaultInternalCosts.pmPercentage,
      riskPercentage: estimate.settings?.risk_percentage ?? defaultInternalCosts.riskPercentage,
    })

    setModules(
      (estimate.modules || []).map((m, moduleIndex) => ({
        id: m.id || moduleIndex + 1,
        name: m.name || `Module ${moduleIndex + 1}`,
        description: m.description || '',
        features: (m.features || []).map((f, featureIndex) => ({
          id: f.id || `${moduleIndex}-${featureIndex}`,
          name: f.name || `Feature ${featureIndex + 1}`,
          description: f.description || f.notes || '',
          complexity: normalizeComplexity(f.complexity),
          estimatedHours: f.estimated_hours ?? f.base_hours ?? 0,
          isBillable: f.is_billable !== false,
        })),
      }))
    )

    setEstimatorView('wizard')
    const restoredStep = Number(estimate.estimate_data_json?.activeStep)
    setActiveStep(Number.isFinite(restoredStep) ? Math.max(0, Math.min(restoredStep, 4)) : 4)
    setTimeout(() => calculateBreakdown(), 100)
  }

  const resetEstimate = () => {
    setProjectInfo(defaultProjectInfo)
    setTechStack(defaultTechStack)
    setInternalCosts(defaultInternalCosts)
    setModules([
      {
        id: 1,
        name: 'Module 1',
        description: '',
        features: [
          {
            id: Date.now(),
            name: 'Feature 1',
            description: '',
            complexity: 'medium',
            estimatedHours: 8,
            isBillable: true,
          },
        ],
      },
    ])
    setBreakdown(null)
    setError('')
    setSuccess('')
    setActiveStep(0)
    setWizardMode('create')
    setEditingEstimateId(null)
    setLoadedEstimateId(null)
    setChangeComment('')
    setLoadedEstimateComments([])
    setIsLoadedEstimateEditable(true)
    setCurrentDraftId(null)
    setAutoSaveStatus('idle')
    lastAutoSavedPayloadRef.current = ''
  }

  const openNewEstimateWizard = () => {
    resetEstimate()
    setEstimatorView('wizard')
  }

  useEffect(() => {
    if (!currentUser || estimatorView !== 'wizard' || isViewMode) return
    if (saving) return
    if (wizardMode !== 'create') return
    if (!hasMinimumUsefulData()) return

    const payload = buildEstimatePayload()
    const serialized = JSON.stringify(payload)
    if (serialized === lastAutoSavedPayloadRef.current) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving')
        const response = currentDraftId
          ? await estimateAPI.updateDraft(currentDraftId, payload)
          : await estimateAPI.createDraft(payload)
        const savedId = response?.data?.id
        if (savedId && !currentDraftId) {
          setCurrentDraftId(savedId)
          setLoadedEstimateId(savedId)
        }
        lastAutoSavedPayloadRef.current = serialized
        setAutoSaveStatus('saved')
      } catch (err) {
        console.error('[AutoSave Draft] failed', err)
        setAutoSaveStatus('error')
      }
    }, 2000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [
    currentUser,
    estimatorView,
    isViewMode,
    saving,
    wizardMode,
    currentDraftId,
    buildEstimatePayload,
    hasMinimumUsefulData,
  ])

  useEffect(() => {
    if (autoSaveStatus !== 'saved') return
    if (autoSaveStatusTimerRef.current) {
      clearTimeout(autoSaveStatusTimerRef.current)
    }
    autoSaveStatusTimerRef.current = setTimeout(() => setAutoSaveStatus('idle'), 2500)
    return () => {
      if (autoSaveStatusTimerRef.current) clearTimeout(autoSaveStatusTimerRef.current)
    }
  }, [autoSaveStatus])

  const isStepComplete = index => {
    if (index === 0) {
      return Boolean(projectInfo.name && projectInfo.name.trim())
    }
    if (index === 1) {
      return Boolean(techStack.primary && techStack.primary.trim())
    }
    if (index === 2) {
      return modules.some(module =>
        (module.features || []).some(feature => feature.name?.trim() && Number(feature.estimatedHours) > 0)
      )
    }
    if (index === 3) {
      const rate = Number(internalCosts.hourlyRate)
      return rate > 0
    }
    if (index === 4) {
      return Boolean(breakdown)
    }
    return false
  }

  const goToNextStep = async () => {
    if (!isStepComplete(activeStep)) {
      if (activeStep === 0) setError('Project Name is required.')
      if (activeStep === 1) setError('Primary Technology / Platform is required.')
      if (activeStep === 2) setError('Add at least one feature with title and estimated hours.')
      if (activeStep === 3) setError('Please provide a valid hourly rate.')
      return
    }

    setError('')
    const next = Math.min(activeStep + 1, WIZARD_STEPS.length - 1)
    if (next === 4) {
      await calculateBreakdown()
    }
    setActiveStep(next)
  }

  const goToPrevStep = () => {
    setError('')
    setActiveStep(prev => Math.max(0, prev - 1))
  }

  const getStepClass = index => {
    if (index === activeStep) return 'wizard-step active'
    if (index < activeStep || isStepComplete(index)) return 'wizard-step completed'
    return 'wizard-step upcoming'
  }

  const renderCurrentStep = () => {
    if (activeStep === 0) {
      return <ProjectInfoSection projectInfo={projectInfo} setProjectInfo={setProjectInfo} />
    }
    if (activeStep === 1) {
      return <TechStackSection techStack={techStack} setTechStack={setTechStack} />
    }
    if (activeStep === 2) {
      return <ModulesSection modules={modules} setModules={setModules} />
    }
    if (activeStep === 3) {
      return <OverheadSection internalCosts={internalCosts} setInternalCosts={setInternalCosts} />
    }
    return (
      <div className="summary-layout">
        <EstimateSummary modules={modules} internalCosts={internalCosts} />
        <ProposalSummary breakdown={breakdown} projectInfo={projectInfo} techStack={techStack} modules={modules} />

        {loadedEstimateComments.length > 0 && (
          <div className="card admin-comments-section">
            <h4>Admin Comments</h4>
            {loadedEstimateComments.map(comment => (
              <div key={comment.id} className="admin-comment-bubble">
                <div className="meta">
                  <strong>{comment.user_name || 'Admin'}</strong> ({comment.user_role || 'admin'})
                  {' • '}
                  {comment.created_at ? new Date(comment.created_at).toLocaleString() : 'N/A'}
                </div>
                <div className="text">{comment.comment_text}</div>
                {comment.file && (
                  <a
                    href={toAbsoluteFileUrl(comment.file.download_url || `/api/files/${comment.file.id}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="ap-file-link"
                  >
                    {comment.file.original_filename}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {!isLoadedEstimateEditable && loadedEstimateComments.length > 0 && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontWeight: 600 }}>
              Editing is locked by admin. You can review comments in view-only mode.
            </div>
          </div>
        )}
        {wizardMode === 'edit' && editingEstimateId && (
          <div className="card" style={{ marginTop: 12 }}>
            <label htmlFor="change-comment"><strong>Change Comment (required for update)</strong></label>
            <textarea
              id="change-comment"
              value={changeComment}
              onChange={e => setChangeComment(e.target.value)}
              placeholder="Describe what changed in this estimate version"
              rows={3}
            />
          </div>
        )}
      </div>
    )
  }

  const startEditFromView = () => {
    if (!loadedEstimateId || !isLoadedEstimateEditable) return
    setEditingEstimateId(loadedEstimateId)
    setWizardMode('edit')
    setActiveStep(4)
  }

  if (currentUser && currentUser.role === 'admin') {
    return <AdminPanel user={currentUser} onLogout={handleLogout} />
  }

  if (!currentUser && authView === 'admin-login') {
    return <AdminLogin onLogin={handleLogin} switchToUserLogin={() => setAuthView('login')} />
  }

  if (!currentUser && authView === 'login') {
    return (
      <Login
        onLogin={handleLogin}
        switchToSignup={() => setAuthView('signup')}
        switchToAdminLogin={() => setAuthView('admin-login')}
      />
    )
  }

  if (!currentUser && authView === 'signup') {
    return <Signup onSignup={handleLogin} switchToLogin={() => setAuthView('login')} />
  }

  return (
    <div className="dashboard-root">
      {currentUser && currentUser.role !== 'admin' && (
        <>
          <header className="dashboard-header">
            <div className="header-brand">
              <div className="brand-logo-wrap" style={{}}>
                <img
                  src={brainiumLogo}
                  alt="Brainium"
                  className="brand-logo-image"
                  onError={() => setLogoFailed(true)}
                  style={{ display: logoFailed ? 'none' : 'block' }}
                />
                <span className="brand-logo-fallback" style={{ display: logoFailed ? 'inline-flex' : 'none' }}>Brainium</span>
              </div>
              <div>
                <h1>Project Estimation Dashboard</h1>
                <p className="subtitle">Build and manage fixed-cost project estimates</p>
              </div>
            </div>
            <div className="header-actions">
              <UserBadge user={currentUser} onLogout={handleLogout} />
            </div>
          </header>

          {error && <div className="feedback error-message">{error}</div>}
          {success && <div className="feedback success-message">{success}</div>}

          {estimatorView === 'saved' && (
            <main className="dashboard-main-single">
              <SavedEstimates
                refreshKey={savedKey}
                onLoad={handleLoadEstimate}
                onAddNew={openNewEstimateWizard}
              />
            </main>
          )}

          {estimatorView === 'wizard' && (
            <main className="wizard-main">
              <div className="wizard-shell card">
                <div className="space-between wizard-head">
                  <h3>{wizardMode === 'view' ? 'View Estimate' : (editingEstimateId ? 'Edit Estimate' : 'Create New Estimate')}</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {wizardMode === 'view' && isLoadedEstimateEditable && (
                      <button className="btn btn-secondary" onClick={startEditFromView}>
                        Edit Estimate
                      </button>
                    )}
                    <button className="btn btn-ghost" onClick={() => setEstimatorView('saved')}>
                      Back to My Estimates
                    </button>
                  </div>
                </div>

                {!isViewMode && wizardMode === 'create' && autoSaveStatus !== 'idle' && (
                  <div className="draft-save-status">
                    {autoSaveStatus === 'saving' && 'Auto-saving...'}
                    {autoSaveStatus === 'saved' && 'Draft saved'}
                    {autoSaveStatus === 'error' && 'Auto-save failed'}
                  </div>
                )}

                <div className="wizard-steps">
                  {WIZARD_STEPS.map((step, index) => (
                    <button
                      key={step.id}
                      className={getStepClass(index)}
                      onClick={() => setActiveStep(index)}
                      type="button"
                    >
                      <span className="wizard-step-index">{index + 1}</span>
                      <span className="wizard-step-label">{step.label}</span>
                    </button>
                  ))}
                </div>

                <div className="wizard-content">
                  <fieldset disabled={isViewMode} style={{ border: 0, margin: 0, padding: 0 }}>
                    {renderCurrentStep()}
                  </fieldset>
                </div>

                {!isViewMode && (
                  <div className="wizard-footer">
                    <div className="wizard-footer-left">
                      <button className="btn btn-ghost" onClick={resetEstimate} type="button">
                        Reset
                      </button>
                      {activeStep > 0 && (
                        <button className="btn btn-secondary" onClick={goToPrevStep} type="button">
                          Back
                        </button>
                      )}
                    </div>

                    <div className="wizard-footer-right">
                      {activeStep < WIZARD_STEPS.length - 1 && (
                        <button className="btn btn-primary" onClick={goToNextStep} type="button">
                          Next →
                        </button>
                      )}
                      {activeStep === WIZARD_STEPS.length - 1 && (
                        <>
                          <button className="btn btn-secondary" onClick={calculateBreakdown} type="button">
                            Calculate Estimate
                          </button>
                          <button className="btn btn-primary" onClick={saveEstimate} disabled={saving || !breakdown} type="button">
                            {saving ? 'Saving...' : (editingEstimateId ? 'Update Estimate →' : 'Save Estimate →')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </main>
          )}
        </>
      )}
    </div>
  )
}

export default App
