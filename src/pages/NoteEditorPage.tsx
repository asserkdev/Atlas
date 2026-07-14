import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'
import { useToast } from '../components/ToastContext'
import { Note, Folder, Project, NoteTemplate } from '../lib/types'

// Note templates
const TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Note',
    description: 'Start from scratch',
    icon: '📄',
    content: '',
  },
  {
    id: 'meeting',
    name: 'Meeting Notes',
    description: 'Capture meeting discussions',
    icon: '📅',
    content: `<h1>Meeting Notes</h1>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
<p><strong>Attendees:</strong> </p>

<h2>Agenda</h2>
<ul>
<li>Topic 1</li>
<li>Topic 2</li>
</ul>

<h2>Discussion</h2>
<p></p>

<h2>Action Items</h2>
<ul>
<li>[ ] Task 1</li>
<li>[ ] Task 2</li>
</ul>

<h2>Next Steps</h2>
<p></p>`,
  },
  {
    id: 'todo',
    name: 'Task List',
    description: 'Track your tasks',
    icon: '✅',
    content: `<h1>My Tasks</h1>

<h2>In Progress</h2>
<ul>
<li>[ ] Task 1</li>
<li>[ ] Task 2</li>
</ul>

<h2>Completed</h2>
<ul>
<li>[x] Completed task</li>
</ul>

<h2>Notes</h2>
<p></p>`,
  },
  {
    id: 'daily',
    name: 'Daily Journal',
    description: 'Daily reflection',
    icon: '📓',
    content: `<h1>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h1>

<h2>Morning Intentions</h2>
<p></p>

<h2>Top 3 Priorities</h2>
<ol>
<li></li>
<li></li>
<li></li>
</ol>

<h2>Evening Reflection</h2>
<p><strong>What went well:</strong> </p>
<p><strong>What could improve:</strong> </p>
<p><strong>Grateful for:</strong> </p>`,
  },
]

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
  const [showTemplateModal, setShowTemplateModal] = useState(false)
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

  // Calculate word count and reading time
  const stats = useMemo(() => {
    if (!editor) return { words: 0, chars: 0, readTime: 0 }
    
    const text = editor.getText()
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const chars = text.length
    const readTime = Math.ceil(words / 200) // Average reading speed: 200 words/min
    
    return { words, chars, readTime }
  }, [editor?.getText()])

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
      // Calculate word count from content
      const textContent = (content || editor?.getHTML() || '').replace(/<[^>]*>/g, ' ')
      const wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0
      
      const { error } = await supabase
        .from('notes')
        .update({
          title: title || 'Untitled Note',
          content: content || editor?.getHTML() || '',
          word_count: wordCount,
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
    if (!user) return

    // If no ID, we're creating a new note - show template picker
    if (!id || id === 'new') {
      setShowTemplateModal(true)
      setLoading(false)
      return
    }

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

  const handleCreateFromTemplate = async (template: NoteTemplate) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: user.id,
          title: template.id === 'blank' ? 'Untitled Note' : template.name,
          content: template.content,
        })
        .select()
        .single()

      if (error) throw error

      showToast('success', `Created from ${template.name} template`)
      setShowTemplateModal(false)
      navigate(`/note/${data.id}`)
    } catch (error) {
      console.error('Error creating note from template:', error)
      showToast('error', 'Failed to create note')
    }
  }

  const handleExportMarkdown = () => {
    if (!title || !editor) return

    // Convert HTML to simple markdown
    let markdown = `# ${title}\n\n`
    
    const html = editor.getHTML()
    
    // Simple HTML to markdown conversion
    let md = html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<ul[^>]*>/gi, '')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>/gi, '')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()

    markdown += md

    // Create and download file
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showToast('success', 'Exported as Markdown')
  }

  const handleToggleStarred = async () => {
    if (!note) return

    try {
      const { error } = await supabase
        .from('notes')
        .update({ starred: !note.starred })
        .eq('id', note.id)

      if (error) throw error

      setNote({ ...note, starred: !note.starred })
      showToast('success', note.starred ? 'Removed from starred' : 'Added to starred')
    } catch (error) {
      console.error('Error toggling starred:', error)
      showToast('error', 'Failed to update note')
    }
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
            
            {note && (
              <button
                className="btn btn-icon btn-ghost"
                onClick={handleToggleStarred}
                title={note.starred ? 'Remove from starred' : 'Add to starred'}
                style={{ color: note.starred ? 'var(--color-accent)' : 'inherit' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={note.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            )}

            <button
              className="btn btn-ghost"
              onClick={handleExportMarkdown}
              title="Export as Markdown"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>

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

          {/* Stats */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            <span>{stats.words} words</span>
            <span>{stats.chars} characters</span>
            <span>{stats.readTime} min read</span>
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

      {/* Template Picker Modal */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => navigate('/')}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Note</h3>
              <button className="modal-close" onClick={() => navigate('/')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
              Choose a template to get started
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleCreateFromTemplate(template)}
                  style={{
                    padding: 'var(--space-5)',
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-xl)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)'
                    e.currentTarget.style.background = 'var(--color-bg-card-hover)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                    e.currentTarget.style.background = 'var(--color-bg-tertiary)'
                  }}
                >
                  <span style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)', display: 'block' }}>
                    {template.icon}
                  </span>
                  <h4 style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-1)', color: 'var(--color-text-primary)' }}>
                    {template.name}
                  </h4>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    {template.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
