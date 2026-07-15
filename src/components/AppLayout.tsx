import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { supabase } from '../lib/supabase'
import { useState } from 'react'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      showToast('error', 'Failed to sign out')
    }
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="sidebar-logo">CAMBRIC</h1>
          <p className="sidebar-tagline">Atlas</p>
        </div>

        <div className="sidebar-content">
          {/* Workspace Navigation */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">Workspace</div>
            <button
              className={`nav-item ${isActive('/') ? 'active' : ''}`}
              onClick={() => navigate('/')}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span className="nav-item-text">Notes</span>
            </button>
            <button
              className={`nav-item ${isActive('/tasks') ? 'active' : ''}`}
              onClick={() => navigate('/tasks')}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <span className="nav-item-text">Tasks</span>
            </button>
            <button
              className={`nav-item ${isActive('/bookmarks') ? 'active' : ''}`}
              onClick={() => navigate('/bookmarks')}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span className="nav-item-text">Bookmarks</span>
            </button>
          </div>

          {/* User Info */}
          <div className="sidebar-section" style={{ marginTop: 'auto' }}>
            <div className="sidebar-section-title">Account</div>
            <div className="nav-item" style={{ cursor: 'default' }}>
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span className="nav-item-text" style={{ fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email?.split('@')[0]}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email}
                </span>
              </div>
            </div>
            <button
              className="nav-item"
              onClick={handleSignOut}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="nav-item-text">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="app-content">
        {children}
      </main>

      {/* Mobile Menu Toggle */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={{ position: 'fixed', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 200 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {mobileMenuOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>
    </div>
  )
}
