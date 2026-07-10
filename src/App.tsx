import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthContext'
import { ToastProvider } from './components/ToastContext'
import { isConfigured } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import NoteEditorPage from './pages/NoteEditorPage'

function SetupRequiredPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-primary)',
      padding: '2rem'
    }}>
      <div style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: '1rem',
        padding: '3rem',
        maxWidth: '500px',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#fff',
          marginBottom: '1rem'
        }}>Setup Required</h1>
        <p style={{
          color: '#a1a1aa',
          marginBottom: '1.5rem',
          lineHeight: '1.6'
        }}>
          Atlas needs Supabase configuration to work. Please set the following environment variables:
        </p>
        <div style={{
          background: 'var(--color-bg-tertiary)',
          padding: '1rem',
          borderRadius: '0.5rem',
          textAlign: 'left',
          marginBottom: '1.5rem'
        }}>
          <code style={{ color: '#67e8f9', fontSize: '0.875rem' }}>
            VITE_SUPABASE_URL=your-project-url<br/>
            VITE_SUPABASE_ANON_KEY=your-anon-key
          </code>
        </div>
        <p style={{ color: '#71717a', fontSize: '0.875rem' }}>
          See the README for setup instructions.
        </p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="auth-container">
        <div className="loading-spinner" />
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />
  }
  
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="auth-container">
        <div className="loading-spinner" />
      </div>
    )
  }
  
  if (user) {
    return <Navigate to="/" replace />
  }
  
  return <>{children}</>
}

function AppRoutes() {
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
