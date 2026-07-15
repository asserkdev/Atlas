import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'
import { useToast } from '../components/ToastContext'
import { AppLayout } from '../components/AppLayout'
import { Note, Folder, Project, Tag } from '../lib/types'

export default function DashboardPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  
  const [notes, setNotes] = useState<Note[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)
  const [showStarred, setShowStarred] = useState(false)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [showNewTagModal, setShowNewTagModal] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newTagColor, setNewTagColor] = useState('#67e8f9')

  const fetchData = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const notesRes = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (notesRes.error) {
        throw new Error(`Notes: ${notesRes.error.message}`)
      }

      const notesWithDefaults = (notesRes.data || []).map(note => ({
        ...note,
        starred: note.starred ?? false,
        word_count: note.word_count ?? 0,
      }))

      setNotes(notesWithDefaults)

      try {
        const [foldersRes, projectsRes, tagsRes] = await Promise.all([
          supabase.from('folders').select('*').eq('user_id', user.id).order('name'),
          supabase.from('projects').select('*').eq('user_id', user.id).order('name'),
          supabase.from('tags').select('*').eq('user_id', user.id).order('name'),
        ])

        if (!foldersRes.error) setFolders(foldersRes.data || [])
        if (!projectsRes.error) setProjects(projectsRes.data || [])
        if (!tagsRes.error) setTags(tagsRes.data || [])
      } catch {
        console.log('Optional tables not available')
      }

    } catch (err: any) {
      console.error('Error fetching data:', err)
      setError(err.message || 'Failed to load notes')
      showToast('error', 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [user, showToast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const createWelcomeNote = async () => {
    if (!user) return

    try {
      const { error } = await supabase.from('notes').insert({
        user_id: user.id,
        title: 'Welcome to Atlas',
        content: `<h1>Welcome to Atlas! 🚀</h1>
<p>Atlas is your personal knowledge workspace. Here you can:</p>
<ul>
<li><strong>Take Notes</strong> — Capture ideas, thoughts, and information</li>
<li><strong>Manage Tasks</strong> — Track what you need to do</li>
<li><strong>Save Bookmarks</strong> — Keep links for later</li>
</ul>
<h2>Quick Tips</h2>
<ul>
<li>Use <strong>⌘/Ctrl + K</strong> to quickly search notes</li>
<li>Click the <strong>star</strong> icon to favorite notes</li>
<li>Organize with <strong>folders</strong> and <strong>tags</strong></li>
</ul>
<p>Happy note-taking! 📝</p>`,
      })

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error creating welcome note:', error)
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

  const handleToggleStarred = async (noteId: string, currentStarred: boolean) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ starred: !currentStarred })
        .eq('id', noteId)

      if (error) throw error

      setNotes(notes.map(note => 
        note.id === noteId ? { ...note, starred: !currentStarred } : note
      ))
      
      showToast('success', currentStarred ? 'Removed from starred' : 'Added to starred')
    } catch (error) {
      console.error('Error toggling starred:', error)
      showToast('error', 'Failed to update note')
    }
  }

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

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newItemName.trim()) return

    try {
      const { error } = await supabase.from('tags').insert({
        user_id: user.id,
        name: newItemName.trim().toLowerCase(),
        color: newTagColor,
      })

      if (error) throw error

      showToast('success', 'Tag created')
      setNewItemName('')
      setNewTagColor('#67e8f9')
      setShowNewTagModal(false)
      fetchData()
    } catch (error) {
      console.error('Error creating tag:', error)
      showToast('error', 'Failed to create tag')
    }
  }

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFolder = !selectedFolder || note.folder_id === selectedFolder.id
    const matchesProject = !selectedProject || note.project_id === selectedProject.id
    const matchesStarred = !showStarred || note.starred

    return matchesSearch && matchesFolder && matchesProject && matchesStarred
  })

  const starredNotes = notes.filter(note => note.starred)

  const getPreview = (content: string) => {
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    return text.length > 100 ? text.slice(0, 100) + '...' : text
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return d.toLocaleDateString()
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="loading-container">
          <div className="loading-spinner" />
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 className="empty-state-title">Unable to load notes</h2>
          <p className="empty-state-description">{error}</p>
          <button className="btn btn-primary" onClick={fetchData}>
            Try Again
          </button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <header className="main-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
            {showStarred ? '⭐ Starred' : 
             selectedTag ? `# ${selectedTag.name}` :
             selectedFolder ? selectedFolder.name :
             selectedProject ? selectedProject.name :
             'All Notes'}
          </h1>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            {filteredNotes.length} notes
          </span>
        </div>

        <div className="main-header-actions">
          <div className="search-bar">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search... (⌘K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
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
        <aside className="notes-sidebar">
          <div className="sidebar-section">
            <button
              className={`nav-item ${!selectedFolder && !selectedProject && !showStarred ? 'active' : ''}`}
              onClick={() => {
                setSelectedFolder(null)
                setSelectedProject(null)
                setSelectedTag(null)
                setShowStarred(false)
              }}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="nav-item-text">All Notes</span>
              <span className="nav-item-badge">{notes.length}</span>
            </button>
            <button
              className={`nav-item ${showStarred ? 'active' : ''}`}
              onClick={() => {
                setSelectedFolder(null)
                setSelectedProject(null)
                setSelectedTag(null)
                setShowStarred(true)
              }}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill={showStarred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="nav-item-text">Starred</span>
              <span className="nav-item-badge">{starredNotes.length}</span>
            </button>
          </div>

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
              <button
                key={folder.id}
                className={`nav-item ${selectedFolder?.id === folder.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedFolder(folder)
                  setSelectedProject(null)
                  setSelectedTag(null)
                  setShowStarred(false)
                }}
              >
                <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="nav-item-text">{folder.name}</span>
              </button>
            ))}
            {folders.length === 0 && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', padding: '0 var(--space-3)' }}>No folders</p>
            )}
          </div>

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
              <button
                key={project.id}
                className={`nav-item ${selectedProject?.id === project.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedProject(project)
                  setSelectedFolder(null)
                  setSelectedTag(null)
                  setShowStarred(false)
                }}
              >
                <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                <span className="nav-item-text">{project.name}</span>
              </button>
            ))}
            {projects.length === 0 && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', padding: '0 var(--space-3)' }}>No projects</p>
            )}
          </div>

          {tags.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Tags</div>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  className={`nav-item ${selectedTag?.id === tag.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedTag(tag)
                    setSelectedFolder(null)
                    setSelectedProject(null)
                    setShowStarred(false)
                  }}
                  style={{ gap: 'var(--space-2)' }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: tag.color, flexShrink: 0 }} />
                  <span className="nav-item-text">{tag.name}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="notes-grid">
          {notes.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <h2 className="empty-state-title">No notes yet</h2>
              <p className="empty-state-description">Create your first note to get started</p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <button className="btn btn-primary" onClick={() => handleCreateNote()}>
                  Create Note
                </button>
                <button className="btn btn-secondary" onClick={createWelcomeNote}>
                  Create Welcome Note
                </button>
              </div>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <h2 className="empty-state-title">No notes found</h2>
              <p className="empty-state-description">Try adjusting your search or filters</p>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                className="note-card"
                onClick={() => navigate(`/note/${note.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                  <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', flex: 1 }}>
                    {note.title || 'Untitled Note'}
                  </h3>
                  <button
                    className="btn btn-icon btn-ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleStarred(note.id, note.starred)
                    }}
                    style={{ padding: 'var(--space-1)', color: note.starred ? 'var(--color-accent)' : 'inherit' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={note.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                </div>
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
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {showNewFolderModal && (
        <div className="modal-overlay" onClick={() => setShowNewFolderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Folder</h3>
              <button className="modal-close" onClick={() => setShowNewFolderModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <div className="form-group">
                <label className="form-label">Folder name</label>
                <input type="text" className="form-input" placeholder="My Folder" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} autoFocus required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewFolderModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewProjectModal && (
        <div className="modal-overlay" onClick={() => setShowNewProjectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Project</h3>
              <button className="modal-close" onClick={() => setShowNewProjectModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label className="form-label">Project name</label>
                <input type="text" className="form-input" placeholder="My Project" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} autoFocus required />
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input type="text" className="form-input" placeholder="Project description" value={newItemDescription} onChange={(e) => setNewItemDescription(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewProjectModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewTagModal && (
        <div className="modal-overlay" onClick={() => setShowNewTagModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Tag</h3>
              <button className="modal-close" onClick={() => setShowNewTagModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateTag}>
              <div className="form-group">
                <label className="form-label">Tag name</label>
                <input type="text" className="form-input" placeholder="e.g. important" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} autoFocus required />
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {['#67e8f9', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#f472b6', '#60a5fa'].map((color) => (
                    <button key={color} type="button" onClick={() => setNewTagColor(color)} style={{
                      width: 32, height: 32, borderRadius: 'var(--radius-md)', backgroundColor: color,
                      border: newTagColor === color ? '2px solid white' : '2px solid transparent', cursor: 'pointer',
                    }} />
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewTagModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
