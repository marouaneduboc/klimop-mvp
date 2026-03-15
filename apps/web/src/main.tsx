import React, { Component, ErrorInfo, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string | null }> {
  state = { hasError: false, error: null as string | null }
  static getDerivedStateFromError(err: Error) { return { hasError: true, error: err.message } }
  componentDidCatch(err: Error, info: ErrorInfo) { console.error(err, info) }
  render() {
    if (this.state.hasError)
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 560 }}>
          <h1 style={{ margin: '0 0 12px 0' }}>Something went wrong</h1>
          <p style={{ color: '#888', margin: 0 }}>{this.state.error}</p>
          <button type="button" onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: 16 }}>
            Try again
          </button>
        </div>
      )
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
