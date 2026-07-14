import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './components/AuthContext'
import { ToastProvider } from './components/ToastContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { QuickSearchModal } from './components/QuickSearchModal'
import { registerAtlasShortcuts } from './lib/keyboard'
import { isConfigured } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import NoteEditorPage from './pages/NoteEditorPage'
import TasksPage from './pages/TasksPage'
import BookmarksPage from './pages/BookmarksPage'

// Debug flag - shows simple page first to diagnose issues
const DEBUG_MODE = false

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
  const [showQuickSearch, setShowQuickSearch] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  // Global keyboard shortcuts using centralized manager
  useEffect(() => {
    const unregister = registerAtlasShortcuts({
      onSearch: () => user && setShowQuickSearch(true),
      onNewNote: () => user && (window.location.href = '/note/new'),
      onNavigateNotes: () => navigate('/'),
      onNavigateTasks: () => navigate('/tasks'),
      onNavigateBookmarks: () => navigate('/bookmarks')
    })

    // Also handle Escape for quick search
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showQuickSearch) {
        setShowQuickSearch(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      unregister()
      window.removeEventListener('keydown', handleEscape)
    }
  }, [user, showQuickSearch, navigate])

  if (DEBUG_MODE) {
    return <DebugPage />
  }
  
  if (!isConfigured) {
    return <SetupRequiredPage />
  }

  return (
    <ErrorBoundary level="page">
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
              <ErrorBoundary level="section">
                <DashboardPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/note/:id"
          element={
            <ProtectedRoute>
              <ErrorBoundary level="section">
                <NoteEditorPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/note/new"
          element={
            <ProtectedRoute>
              <ErrorBoundary level="section">
                <NoteEditorPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <ErrorBoundary level="section">
                <TasksPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookmarks"
          element={
            <ProtectedRoute>
              <ErrorBoundary level="section">
                <BookmarksPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {user && (
        <QuickSearchModal 
          isOpen={showQuickSearch} 
          onClose={() => setShowQuickSearch(false)} 
        />
      )}
    </ErrorBoundary>
  )
}

// Get the base path for GitHub Pages subdirectory deployment
const basename = import.meta.env.DEV ? '/' : '/Atlas/'

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
