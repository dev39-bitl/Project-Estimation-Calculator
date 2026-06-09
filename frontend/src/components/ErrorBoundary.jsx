import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          padding: '40px 20px',
          textAlign: 'center',
          background: '#0B1B2E',
          border: '1px solid #1e4053',
          borderRadius: '12px',
          color: '#FFFFFF',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ marginBottom: '12px', fontSize: '1.5rem' }}>Something went wrong</h2>
          <p style={{ marginBottom: '24px', color: '#C9D6EA', fontSize: '1rem' }}>
            An error occurred while loading this admin page. Please try again.
          </p>

          {this.state.error && (
            <details style={{
              marginBottom: '24px',
              textAlign: 'left',
              background: '#10233A',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #1e4053',
              width: '100%',
              maxWidth: '500px',
            }}>
              <summary style={{ cursor: 'pointer', color: '#00AEEF', marginBottom: '8px' }}>
                Error Details
              </summary>
              <pre style={{
                background: '#0B1B2E',
                padding: '12px',
                borderRadius: '6px',
                overflow: 'auto',
                fontSize: '0.85rem',
                color: '#FCA5A5',
                margin: 0,
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.href = '/admin'}
              style={{
                background: '#1e4053',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.background = '#2B4564'}
              onMouseLeave={(e) => e.target.style.background = '#1e4053'}
            >
              ← Back to Admin Dashboard
            </button>
            <button
              onClick={this.handleReload}
              style={{
                background: '#00AEEF',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.background = '#0096D9'}
              onMouseLeave={(e) => e.target.style.background = '#00AEEF'}
            >
              🔄 Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
