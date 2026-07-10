import { useState, useEffect } from 'react'
import { useAuth } from '../components/AuthContext'

type AuthMode = 'signin' | 'signup' | 'magic-link' | 'magic-link-sent' | 'forgot-password'

export default function AuthPage() {
  const { signIn, signUp, signInWithMagicLink, resetPassword } = useAuth()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reset') === 'true') {
      setMode('forgot-password')
    }
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    const { error } = await signUp(email, password)
    if (error) {
      setError(error.message)
    } else {
      setError('')
      alert('Check your email for the confirmation link!')
    }
    setLoading(false)
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signInWithMagicLink(email)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setMode('magic-link-sent')
    }
    setLoading(false)
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await resetPassword(email)
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  if (mode === 'magic-link-sent') {
    return (
      <div className="auth-page">
        <header className="auth-header">
          <h1 className="auth-logo">CAMBRIC</h1>
          <p className="auth-tagline">Atlas</p>
        </header>
        
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-magic-link-sent">
              <svg className="auth-magic-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <h2 className="auth-magic-link-title">Check your email</h2>
              <p className="auth-magic-link-text">
                We sent a magic link to <span className="auth-magic-link-email">{email}</span>
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => setMode('signin')}
              >
                Back to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (resetSent) {
    return (
      <div className="auth-page">
        <header className="auth-header">
          <h1 className="auth-logo">CAMBRIC</h1>
          <p className="auth-tagline">Atlas</p>
        </header>
        
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-magic-link-sent">
              <svg className="auth-magic-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <h2 className="auth-magic-link-title">Check your email</h2>
              <p className="auth-magic-link-text">
                We sent a password reset link to <span className="auth-magic-link-email">{email}</span>
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setMode('signin')
                  setResetSent(false)
                }}
              >
                Back to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <header className="auth-header">
        <h1 className="auth-logo">CAMBRIC</h1>
        <p className="auth-tagline">Atlas</p>
      </header>

      <div className="auth-container">
        <div className="auth-card">
          {mode === 'signin' && (
            <>
              <h2 className="auth-title">Welcome back</h2>
              <p className="auth-subtitle">Sign in to your Atlas workspace</p>

              {error && (
                <div className="auth-alert error">
                  <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </div>
              )}

              <form className="auth-form" onSubmit={handleSignIn}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%', padding: '12px' }}
                >
                  {loading ? <span className="loading-spinner" /> : 'Sign in'}
                </button>
              </form>

              <div className="auth-divider">or</div>

              <button
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => setMode('magic-link')}
              >
                Continue with magic link
              </button>

              <p className="auth-footer">
                Don't have an account?{' '}
                <a href="#" onClick={() => setMode('signup')}>
                  Sign up
                </a>
                <br />
                <a href="#" onClick={(e) => { e.preventDefault(); setMode('forgot-password') }}>
                  Forgot password?
                </a>
              </p>
            </>
          )}

          {mode === 'signup' && (
            <>
              <h2 className="auth-title">Create account</h2>
              <p className="auth-subtitle">Start your Atlas workspace</p>

              {error && (
                <div className="auth-alert error">
                  <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </div>
              )}

              <form className="auth-form" onSubmit={handleSignUp}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Create a password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%', padding: '12px' }}
                >
                  {loading ? <span className="loading-spinner" /> : 'Create account'}
                </button>
              </form>

              <p className="auth-footer">
                Already have an account?{' '}
                <a href="#" onClick={() => setMode('signin')}>
                  Sign in
                </a>
              </p>
            </>
          )}

          {mode === 'magic-link' && (
            <>
              <h2 className="auth-title">Magic link</h2>
              <p className="auth-subtitle">We'll email you a sign-in link</p>

              {error && (
                <div className="auth-alert error">
                  <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </div>
              )}

              <form className="auth-form" onSubmit={handleMagicLink}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%', padding: '12px' }}
                >
                  {loading ? <span className="loading-spinner" /> : 'Send magic link'}
                </button>
              </form>

              <p className="auth-footer">
                <a href="#" onClick={() => setMode('signin')}>
                  Back to sign in
                </a>
              </p>
            </>
          )}

          {mode === 'forgot-password' && (
            <>
              <h2 className="auth-title">Reset password</h2>
              <p className="auth-subtitle">We'll send you a reset link</p>

              {error && (
                <div className="auth-alert error">
                  <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </div>
              )}

              <form className="auth-form" onSubmit={handleForgotPassword}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%', padding: '12px' }}
                >
                  {loading ? <span className="loading-spinner" /> : 'Send reset link'}
                </button>
              </form>

              <p className="auth-footer">
                <a href="#" onClick={() => setMode('signin')}>
                  Back to sign in
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
