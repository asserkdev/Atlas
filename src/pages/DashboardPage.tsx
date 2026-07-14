import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'
import { useToast } from '../components/ToastContext'
import { Note, Folder, Project } from '../lib/types'

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  
  const [notes, setNotes] = useState<Note[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')

  const fetchData = useCallback(async () => {
    if (!user) return

    try {
      const [foldersRes, projectsRes, notesRes] = await Promise.all([
        supabase.from('folders').select('*').eq('user_id', user.id).order('name'),
        supabase.from('projects').select('*').eq('user_id', user.id).order('name'),
        supabase.from('notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      ])

      if (foldersRes.error) throw foldersRes.error
      if (projectsRes.error) throw projectsRes.error
      if (notesRes.error) throw notesRes.error

      setFolders(foldersRes.data || [])
      setProjects(projectsRes.data || [])
      setNotes(notesRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      showToast('error', 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [user, showToast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Create Welcome to Atlas note for new users
  const handleCreateWelcomeNote = async () => {
    if (!user) return

    try {
      const welcomeContent = `<h1>Welcome to Atlas</h1>
<p>Atlas is your personal knowledge workspace. Here's how to get started:</p>

<h2>Creating Notes</h2>
<p>Click the "New Note" button to create your first note. Notes support rich formatting including:</p>
<ul>
<li><strong>Bold</strong> and <em>italic</em> text</li>
<li>Multiple heading levels</li>
<li>Bullet and numbered lists</li>
<li>Blockquotes and code blocks</li>
</ul>

<h2>Organizing with Folders and Projects</h2>
<p>Use folders to group related notes together. Projects let you collect notes around specific goals or topics.</p>

<h2>Autosave</h2>
<p>Your notes save automatically as you type. No need to manually save!</p>

<h2>Search</h2>
<p>Use the search bar to quickly find notes by title or content.</p>

<p>Happy note-taking! 📝</p>`

      const { data, error } = await supabase.from('notes').insert({
        user_id: user.id,
        title: 'Welcome to Atlas',
        content: welcomeContent,
      }).select().single()

      if (error) throw error

      showToast('success', 'Welcome note created')
      navigate(`/note/${data.id}`)
    } catch (error) {
      console.error('Error creating welcome note:', error)
      showToast('error', 'Failed to create welcome note')
    }
  }

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFolder = !selectedFolder || note.folder_id === selectedFolder.id
    const matchesProject = !selectedProject || note.project_id === selectedProject.id

    return matchesSearch && matchesFolder && matchesProject
  })

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newItemName.trim()) return

    try {
      const { error } = await supabase.from('folders').insert({
        user_id: user.id,
        name: newItemName.trim(),
      })

      if (error) throw error

      showToast('success', 'Folder created')
      setNewItemName('')
      setShowNewFolderModal(false)
      fetchData()
    } catch (error) {
      console.error('Error creating folder:', error)
      showToast('error', 'Failed to create folder')
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newItemName.trim()) return

    try {
      const { error } = await supabase.from('projects').insert({
        user_id: user.id,
        name: newItemName.trim(),
        description: newItemDescription.trim() || null,
      })

      if (error) throw error

      showToast('success', 'Project created')
      setNewItemName('')
      setNewItemDescription('')
      setShowNewProjectModal(false)
      fetchData()
    } catch (error) {
      console.error('Error creating project:', error)
      showToast('error', 'Failed to create project')
    }
  }

  const handleCreateNote = async (folderId?: string, projectId?: string) => {
    if (!user) return

    try {
      const { data, error } = await supabase.from('notes').insert({
        user_id: user.id,
        title: 'Untitled Note',
        content: '',
        folder_id: folderId || null,
        project_id: projectId || null,
      }).select().single()

      if (error) throw error

      showToast('success', 'Note created')
      navigate(`/note/${data.id}`)
    } catch (error) {
      console.error('Error creating note:', error)
      showToast('error', 'Failed to create note')
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return

    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId)
      if (error) throw error

      showToast('success', 'Note deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting note:', error)
      showToast('error', 'Failed to delete note')
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder and all notes inside?')) return

    try {
      await supabase.from('notes').delete().eq('folder_id', folderId)
      const { error } = await supabase.from('folders').delete().eq('id', folderId)
      if (error) throw error

      if (selectedFolder?.id === folderId) {
        setSelectedFolder(null)
      }
      showToast('success', 'Folder deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting folder:', error)
      showToast('error', 'Failed to delete folder')
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete this project and all notes inside?')) return

    try {
      await supabase.from('notes').delete().eq('project_id', projectId)
      const { error } = await supabase.from('projects').delete().eq('id', projectId)
      if (error) throw error

      if (selectedProject?.id === projectId) {
        setSelectedProject(null)
      }
      showToast('success', 'Project deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting project:', error)
      showToast('error', 'Failed to delete project')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  const getPreview = (content: string) => {
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    return text.length > 100 ? text.slice(0, 100) + '...' : text
  }

  if (loading) {
    return (
      <div className="app">
        <div className="auth-container" style={{ marginLeft: 'var(--sidebar-width)' }}>
          <div className="loading-spinner" />
        </div>
      </div>
    )
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
          {/* Quick Actions */}
          <div className="sidebar-section">
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginBottom: 'var(--space-3)' }}
              onClick={() => handleCreateNote()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Note
            </button>
          </div>

          {/* All Notes */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">Overview</div>
            <button
              className={`nav-item ${!selectedFolder && !selectedProject ? 'active' : ''}`}
              onClick={() => {
                setSelectedFolder(null)
                setSelectedProject(null)
              }}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span className="nav-item-text">All Notes</span>
              <span className="nav-item-badge">{notes.length}</span>
            </button>
          </div>

          {/* Folders */}
          <div className="sidebar-section">
            <div className="sidebar-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Folders
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => setShowNewFolderModal(true)}
                style={{ padding: '2px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            {folders.map((folder) => (
              <div key={folder.id} className="dropdown">
                <button
                  className={`nav-item ${selectedFolder?.id === folder.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedFolder(folder)
                    setSelectedProject(null)
                  }}
                >
                  <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="nav-item-text">{folder.name}</span>
                </button>
                <div className="dropdown-menu" style={{ display: 'none' }}>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setNewItemName(folder.name)
                      setShowNewFolderModal(true)
                    }}
                  >
                    Rename
                  </div>
                  <div
                    className="dropdown-item danger"
                    onClick={() => handleDeleteFolder(folder.id)}
                  >
                    Delete
                  </div>
                </div>
              </div>
            ))}
            {folders.length === 0 && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', padding: 'var(--space-2) var(--space-3)' }}>
                No folders yet
              </p>
            )}
          </div>

          {/* Projects */}
          <div className="sidebar-section">
            <div className="sidebar-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Projects
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => setShowNewProjectModal(true)}
                style={{ padding: '2px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            {projects.map((project) => (
              <div key={project.id} className="dropdown">
                <button
                  className={`nav-item ${selectedProject?.id === project.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedProject(project)
                    setSelectedFolder(null)
                  }}
                >
                  <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                  <span className="nav-item-text">{project.name}</span>
                </button>
                <div className="dropdown-menu" style={{ display: 'none' }}>
                  <div
                    className="dropdown-item danger"
                    onClick={() => handleDeleteProject(project.id)}
                  >
                    Delete
                  </div>
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', padding: 'var(--space-2) var(--space-3)' }}>
                No projects yet
              </p>
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="nav-item" style={{ marginBottom: 'var(--space-2)' }}>
            <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="nav-item-text">{user?.email}</span>
          </div>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Menu Toggle */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={{ position: 'fixed', top: 'var(--space-4)', left: 'var(--space-4)', zIndex: 200 }}
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

      {/* Main Content */}
      <main className="app-content">
        <header className="main-header">
          <div className="search-bar">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="main-header-actions">
            {selectedFolder && (
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                {selectedFolder.name}
              </span>
            )}
            {selectedProject && (
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                {selectedProject.name}
              </span>
            )}
            <button
              className="btn btn-primary"
              onClick={() => handleCreateNote(selectedFolder?.id, selectedProject?.id)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Note
            </button>
          </div>
        </header>

        <div className="main-content">
          {filteredNotes.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <h2 className="empty-state-title">
                {searchQuery ? 'No notes found' : 'No notes yet'}
              </h2>
              <p className="empty-state-description">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Create your first note to start building your knowledge workspace'}
              </p>
              {!searchQuery && (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleCreateNote(selectedFolder?.id, selectedProject?.id)}
                    style={{ marginBottom: 'var(--space-3)' }}
                  >
                    Create your first note
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleCreateWelcomeNote}
                    style={{ fontSize: 'var(--font-size-sm)' }}
                  >
                    Or start with Welcome to Atlas
                  </button>
                </>
              )}
            </div>
          ) : (
            <div style={{ padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-xl)',
                    padding: 'var(--space-5)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                  onClick={() => navigate(`/note/${note.id}`)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                    e.currentTarget.style.background = 'var(--color-bg-card-hover)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
                    e.currentTarget.style.background = 'var(--color-bg-secondary)'
                  }}
                >
                  <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
                    {note.title || 'Untitled Note'}
                  </h3>
                  {note.content && (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: '1.6' }}>
                      {getPreview(note.content)}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                      {formatDate(note.updated_at)}
                    </span>
                    <button
                      className="btn btn-icon btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteNote(note.id)
                      }}
                      style={{ padding: 'var(--space-1)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="modal-overlay" onClick={() => setShowNewFolderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Folder</h3>
              <button className="modal-close" onClick={() => setShowNewFolderModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <div className="form-group">
                <label className="form-label">Folder name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="My Folder"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewFolderModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="modal-overlay" onClick={() => setShowNewProjectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Project</h3>
              <button className="modal-close" onClick={() => setShowNewProjectModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label className="form-label">Project name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="My Project"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Project description"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewProjectModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
