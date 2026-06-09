import React, { useState } from 'react'
import AdminDashboard from './AdminDashboard'
import AdminUsers from './AdminUsers'
import AdminEstimates from './AdminEstimates'
import AdminEstimateDetails from './AdminEstimateDetails'
import AdminReports from './AdminReports'
import AdminProfile from './AdminProfile'
import ErrorBoundary from '../ErrorBoundary'
import brainiumLogo from '../../assets/brainium-logo.png'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'users', label: 'Users', icon: '👥' },
  { key: 'estimates', label: 'Estimates', icon: '📋' },
  { key: 'reports', label: 'Reports', icon: '📥' },
  { key: 'profile', label: 'Profile', icon: '⚙️' },
]

export default function AdminPanel({ user, onLogout }) {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [selectedEstimateId, setSelectedEstimateId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleViewEstimate = (id) => {
    setSelectedEstimateId(id)
    setActiveSection('estimate-detail')
  }

  const handleNav = (key) => {
    setActiveSection(key)
    if (key !== 'estimate-detail') setSelectedEstimateId(null)
    setSidebarOpen(false)
  }

  const sectionTitle = {
    dashboard: 'Dashboard',
    users: 'Users',
    estimates: 'All Estimates',
    'estimate-detail': 'Estimate Details',
    reports: 'Reports',
    profile: 'My Profile',
  }[activeSection] || 'Admin'

  return (
    <div className="ap-root">
      {/* Top Navbar */}
      <header className="ap-navbar">
        <div className="ap-navbar-left">
          <button className="ap-menu-btn" onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle menu">☰</button>
          <div className="ap-logo ap-logo-wrap">
            <img
              src={brainiumLogo}
              alt="Brainium"
              onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'inline-flex' }}
            />
            <span className="ap-logo-fallback">Brainium</span>
            <span className="ap-logo-label">Admin</span>
          </div>
        </div>
        <div className="ap-navbar-right">
          <div className="ap-user-info">
            <span className="ap-user-name">{user?.full_name || user?.email}</span>
            <span className="ap-user-role-badge">Admin</span>
          </div>
          <button className="ap-logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <div className="ap-body">
        {/* Sidebar */}
        <aside className={`ap-sidebar${sidebarOpen ? ' ap-sidebar--open' : ''}`}>
          <nav className="ap-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                className={`ap-nav-item${activeSection === item.key ? ' ap-nav-item--active' : ''}`}
                onClick={() => handleNav(item.key)}
              >
                <span className="ap-nav-icon">{item.icon}</span>
                <span className="ap-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && <div className="ap-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* Main Content */}
        <main className="ap-main">
          <div className="ap-page-header">
            <h1 className="ap-page-title">{sectionTitle}</h1>
            {activeSection === 'estimate-detail' && (
              <button className="ap-back-btn" onClick={() => handleNav('estimates')}>← Back to Estimates</button>
            )}
          </div>

          <ErrorBoundary>
            <div className="ap-content">
              {activeSection === 'dashboard' && <AdminDashboard onViewEstimate={handleViewEstimate} />}
              {activeSection === 'users' && <AdminUsers />}
              {activeSection === 'estimates' && <AdminEstimates onView={handleViewEstimate} onDeleted={() => {}} />}
              {activeSection === 'estimate-detail' && <AdminEstimateDetails id={selectedEstimateId} onDeleted={() => setActiveSection('estimates')} onBack={() => handleNav('estimates')} />}
              {activeSection === 'reports' && <AdminReports />}
              {activeSection === 'profile' && <AdminProfile />}
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
