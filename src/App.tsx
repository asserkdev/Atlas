import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthContext'
import { ToastProvider } from './components/ToastContext'
import { isConfigured } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import NoteEditorPage from './pages/NoteEditorPage'

// Debug flag - shows simple page first to diagnose issues
const DEBUG_MODE = true

function DebugPage() {
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
  const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
  
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0f',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      padding: '2rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#67e8f9', marginBottom: '1rem' }}>ATLAS</h1>
        <p style={{ color: '#a1a1aa', marginBottom: '1.5rem' }}>Knowledge Workspace</p>
        <div style={{
          background: '#1a1a2e',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          margin: '1rem auto',
          maxWidth: '400px',
          textAlign: 'left'
        }}>
          <p><strong style={{ color: '#67e8f9' }}>Supabase URL:</strong> {supabaseUrl || 'NOT SET'}</p>
          <p><strong style={{ color: '#67e8f9' }}>Supabase Key:</strong> {supabaseKey ? '***' + supabaseKey.slice(-4) : 'NOT SET'}</p>
          <p><strong style={{ color: '#67e8f9' }}>Configured:</strong> {isConfigured ? 'YES ✓' : 'NO ✗'}</p>
        </div>
        <p style={{ color: '#a1a1aa' }}>If you can see this, the app is loading!</p>
      </div>
    </div>
  )
}

function SetupRequiredPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0f',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      padding: '2rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#67e8f9' }}>ATLAS</h1>
        <p style={{ color: '#a1a1aa' }}>Setup Required</p>
        <p style={{ color: '#a1a1aa' }}>Please set environment variables in GitHub Secrets:</p>
        <div style={{ marginTop: '1rem' }}>
          <code style={{ color: '#67e8f9', background: '#1a1a2e', padding: '0.5rem', borderRadius: '0.25rem', display: 'block', marginBottom: '0.5rem' }}>
            VITE_SUPABASE_URL
          </code>
          <code style={{ color: '#67e8f9', background: '#1a1a2e', padding: '0.5rem', borderRadius: '0.25rem', display: 'block' }}>
            VITE_SUPABASE_ANON_KEY
          </code>
        </div>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, authError } = useAuth()
  
  if (loading) {
    return (
      <div className="auth-container">
        <div className="loading-spinner" />
      </div>
    )
  }
  
  if (authError) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Connection Error</h2>
          <p className="error-message">{authError}</p>
          <p>Please check your Supabase configuration.</p>
        </div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />
  }
  
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, authError } = useAuth()
  
  if (loading) {
    return (
      <div className="auth-container">
        <div className="loading-spinner" />
      </div>
    )
  }
  
  if (authError) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Connection Error</h2>
          <p className="error-message">{authError}</p>
          <p>Please check your Supabase configuration.</p>
        </div>
      </div>
    )
  }
  
  if (user) {
    return <Navigate to="/" replace />
  }
  
  return <>{children}</>
}

function AppRoutes() {
  if (DEBUG_MODE) {
    return <DebugPage />
  }
  
  if (!isConfigured) {
    return <SetupRequiredPage />
  }

  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/note/:id"
        element={
          <ProtectedRoute>
            <NoteEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/note/new"
        element={
          <ProtectedRoute>
            <NoteEditorPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
