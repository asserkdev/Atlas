import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'
import { useToast } from '../components/ToastContext'
import { Note, Folder, Project } from '../lib/types'

export default function NoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  
  const [note, setNote] = useState<Note | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (note) {
        scheduleAutoSave(editor.getHTML())
      }
    },
  })

  const scheduleAutoSave = useCallback((content: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      await saveNote(content)
    }, 1000)
  }, [note, title])

  const saveNote = async (content?: string) => {
    if (!note || !user) return
    
    setSaving(true)
    try {
      const { error } = await supabase
        .from('notes')
        .update({
          title: title || 'Untitled Note',
          content: content || editor?.getHTML() || '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', note.id)

      if (error) throw error
      setLastSaved(new Date())
    } catch (error) {
      console.error('Error saving note:', error)
      showToast('error', 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  const fetchNote = useCallback(async () => {
    if (!user || !id) return

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      if (!data) {
        navigate('/')
        return
      }

      setNote(data)
      setTitle(data.title)
      editor?.commands.setContent(data.content || '')
      setLastSaved(new Date(data.updated_at))
    } catch (error) {
      console.error('Error fetching note:', error)
      showToast('error', 'Failed to load note')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [user, id, navigate, editor, showToast])

  const fetchFoldersAndProjects = useCallback(async () => {
    if (!user) return

    try {
      const [foldersRes, projectsRes] = await Promise.all([
        supabase.from('folders').select('*').eq('user_id', user.id).order('name'),
        supabase.from('projects').select('*').eq('user_id', user.id).order('name'),
      ])

      setFolders(foldersRes.data || [])
      setProjects(projectsRes.data || [])
    } catch (error) {
      console.error('Error fetching folders/projects:', error)
    }
  }, [user])

  useEffect(() => {
    fetchNote()
    fetchFoldersAndProjects()

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [fetchNote, fetchFoldersAndProjects])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    if (note) {
      scheduleAutoSave(editor?.getHTML() || '')
    }
  }

  const handleMoveNote = async (folderId: string | null, projectId: string | null) => {
    if (!note) return

    try {
      const { error } = await supabase
        .from('notes')
        .update({
          folder_id: folderId,
          project_id: projectId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', note.id)

      if (error) throw error
      
      showToast('success', 'Note moved')
      setShowMoveModal(false)
      fetchNote()
    } catch (error) {
      console.error('Error moving note:', error)
      showToast('error', 'Failed to move note')
    }
  }

  const handleDeleteNote = async () => {
    if (!note || !confirm('Delete this note?')) return

    try {
      const { error } = await supabase.from('notes').delete().eq('id', note.id)
      if (error) throw error

      showToast('success', 'Note deleted')
      navigate('/')
    } catch (error) {
      console.error('Error deleting note:', error)
      showToast('error', 'Failed to delete note')
    }
  }

  const formatLastSaved = () => {
    if (!lastSaved) return ''
    const now = new Date()
    const diff = now.getTime() - lastSaved.getTime()
    const seconds = Math.floor(diff / 1000)
    
    if (seconds < 5) return 'Just now'
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    return lastSaved.toLocaleTimeString()
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
      {/* Sidebar - simplified for editor */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">CAMBRIC</h1>
          <p className="sidebar-tagline">Atlas</p>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-section">
            <button
              className="nav-item"
              onClick={() => navigate('/')}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span className="nav-item-text">Back to Notes</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="app-content">
        <header className="main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          </div>

          <div className="main-header-actions">
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {saving ? (
                <>
                  <span className="loading-spinner" style={{ width: 16, height: 16, marginRight: 'var(--space-2)' }} />
                  Saving...
                </>
              ) : (
                formatLastSaved()
              )}
            </span>
            
            <button
              className="btn btn-ghost"
              onClick={() => setShowMoveModal(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Move
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => saveNote()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save
            </button>

            <button
              className="btn btn-danger"
              onClick={handleDeleteNote}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete
            </button>
          </div>
        </header>

        <div className="editor-container">
          <input
            type="text"
            className="editor-title"
            placeholder="Untitled Note"
            value={title}
            onChange={handleTitleChange}
          />
          
          <div className="editor-meta">
            <span>Created {note && new Date(note.created_at).toLocaleDateString()}</span>
            {note?.folder_id && folders.find(f => f.id === note.folder_id) && (
              <span>in {folders.find(f => f.id === note.folder_id)?.name}</span>
            )}
            {note?.project_id && projects.find(p => p.id === note.project_id) && (
              <span>Project: {projects.find(p => p.id === note.project_id)?.name}</span>
            )}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)', padding: 'var(--space-2)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
            <button
              className={`btn btn-icon btn-ghost ${editor?.isActive('bold') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              style={{ background: editor?.isActive('bold') ? 'var(--color-accent-muted)' : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
              </svg>
            </button>
            <button
              className={`btn btn-icon btn-ghost ${editor?.isActive('italic') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              style={{ background: editor?.isActive('italic') ? 'var(--color-accent-muted)' : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="4" x2="10" y2="4" />
                <line x1="14" y1="20" x2="5" y2="20" />
                <line x1="15" y1="4" x2="9" y2="20" />
              </svg>
            </button>
            <button
              className={`btn btn-icon btn-ghost ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              style={{ background: editor?.isActive('heading', { level: 1 }) ? 'var(--color-accent-muted)' : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12h8" />
                <path d="M4 18V6" />
                <path d="M12 18V6" />
                <path d="M17 10v8" />
                <path d="M17 10l3-2" />
              </svg>
            </button>
            <button
              className={`btn btn-icon btn-ghost ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              style={{ background: editor?.isActive('heading', { level: 2 }) ? 'var(--color-accent-muted)' : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12h8" />
                <path d="M4 18V6" />
                <path d="M12 18V6" />
                <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
              </svg>
            </button>
            <div style={{ width: 1, background: 'var(--color-border)', margin: '0 var(--space-2)' }} />
            <button
              className={`btn btn-icon btn-ghost ${editor?.isActive('bulletList') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              style={{ background: editor?.isActive('bulletList') ? 'var(--color-accent-muted)' : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <circle cx="4" cy="6" r="1" fill="currentColor" />
                <circle cx="4" cy="12" r="1" fill="currentColor" />
                <circle cx="4" cy="18" r="1" fill="currentColor" />
              </svg>
            </button>
            <button
              className={`btn btn-icon btn-ghost ${editor?.isActive('orderedList') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              style={{ background: editor?.isActive('orderedList') ? 'var(--color-accent-muted)' : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="10" y1="6" x2="21" y2="6" />
                <line x1="10" y1="12" x2="21" y2="12" />
                <line x1="10" y1="18" x2="21" y2="18" />
                <text x="3" y="7" fontSize="6" fill="currentColor">1</text>
                <text x="3" y="13" fontSize="6" fill="currentColor">2</text>
                <text x="3" y="19" fontSize="6" fill="currentColor">3</text>
              </svg>
            </button>
            <div style={{ width: 1, background: 'var(--color-border)', margin: '0 var(--space-2)' }} />
            <button
              className={`btn btn-icon btn-ghost ${editor?.isActive('blockquote') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              style={{ background: editor?.isActive('blockquote') ? 'var(--color-accent-muted)' : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" />
              </svg>
            </button>
            <button
              className={`btn btn-icon btn-ghost ${editor?.isActive('codeBlock') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              style={{ background: editor?.isActive('codeBlock') ? 'var(--color-accent-muted)' : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>
          </div>

          <div className="editor-body">
            <EditorContent editor={editor} />
          </div>
        </div>
      </main>

      {/* Move Modal */}
      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Move Note</h3>
              <button className="modal-close" onClick={() => setShowMoveModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                Current Location
              </h4>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                {note?.folder_id ? `Folder: ${folders.find(f => f.id === note.folder_id)?.name}` : 'No folder'}
                {note?.project_id && ` | Project: ${projects.find(p => p.id === note.project_id)?.name}`}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Move to folder</label>
              <select
                className="form-input"
                value={note?.folder_id || ''}
                onChange={(e) => handleMoveNote(e.target.value || null, note?.project_id || null)}
              >
                <option value="">No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Move to project</label>
              <select
                className="form-input"
                value={note?.project_id || ''}
                onChange={(e) => handleMoveNote(note?.folder_id || null, e.target.value || null)}
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMoveModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
