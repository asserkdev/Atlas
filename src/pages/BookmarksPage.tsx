import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'
import { useToast } from '../components/ToastContext'
import { AppLayout } from '../components/AppLayout'
import { Bookmark } from '../lib/types'

export default function BookmarksPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewBookmarkModal, setShowNewBookmarkModal] = useState(false)
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)
  const [showArchived, _setShowArchived] = useState(false)
  const [newBookmark, setNewBookmark] = useState({
    url: '',
    title: '',
    description: '',
  })

  const fetchBookmarks = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setBookmarks(data || [])
    } catch (error) {
      console.error('Error fetching bookmarks:', error)
      showToast('error', 'Failed to load bookmarks')
    } finally {
      setLoading(false)
    }
  }, [user, showToast])

  useEffect(() => {
    fetchBookmarks()
  }, [fetchBookmarks])

  const filteredBookmarks = bookmarks.filter(b => b.archived === showArchived)

  const handleCreateBookmark = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newBookmark.url.trim()) return

    // Validate URL
    let url = newBookmark.url.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    try {
      // Try to fetch title from URL if not provided
      let title = newBookmark.title.trim()
      if (!title) {
        try {
          const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`)
          const html = await response.text()
          const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
          if (match) {
            title = match[1].trim()
          }
        } catch {
          title = new URL(url).hostname
        }
      }

      // Try to get favicon
      const hostname = new URL(url).hostname
      const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`

      const { error } = await supabase.from('bookmarks').insert({
        user_id: user.id,
        url,
        title: title || hostname,
        description: newBookmark.description.trim() || null,
        favicon,
      })

      if (error) throw error

      showToast('success', 'Bookmark saved')
      setNewBookmark({ url: '', title: '', description: '' })
      setShowNewBookmarkModal(false)
      fetchBookmarks()
    } catch (error) {
      console.error('Error creating bookmark:', error)
      showToast('error', 'Failed to save bookmark')
    }
  }

  const handleUpdateBookmark = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !editingBookmark || !newBookmark.url.trim()) return

    let url = newBookmark.url.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    try {
      const hostname = new URL(url).hostname
      const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`

      const { error } = await supabase
        .from('bookmarks')
        .update({
          url,
          title: newBookmark.title.trim() || hostname,
          description: newBookmark.description.trim() || null,
          favicon,
        })
        .eq('id', editingBookmark.id)

      if (error) throw error

      showToast('success', 'Bookmark updated')
      setEditingBookmark(null)
      setNewBookmark({ url: '', title: '', description: '' })
      fetchBookmarks()
    } catch (error) {
      console.error('Error updating bookmark:', error)
      showToast('error', 'Failed to update bookmark')
    }
  }

  const handleToggleArchive = async (bookmark: Bookmark) => {
    try {
      const { error } = await supabase
        .from('bookmarks')
        .update({ archived: !bookmark.archived })
        .eq('id', bookmark.id)

      if (error) throw error

      setBookmarks(bookmarks.map(b => 
        b.id === bookmark.id ? { ...b, archived: !b.archived } : b
      ))
      
      showToast('success', bookmark.archived ? 'Bookmark restored' : 'Bookmark archived')
    } catch (error) {
      console.error('Error toggling archive:', error)
      showToast('error', 'Failed to update bookmark')
    }
  }

  const handleDeleteBookmark = async (bookmarkId: string) => {
    if (!confirm('Delete this bookmark?')) return

    try {
      const { error } = await supabase.from('bookmarks').delete().eq('id', bookmarkId)
      if (error) throw error

      showToast('success', 'Bookmark deleted')
      fetchBookmarks()
    } catch (error) {
      console.error('Error deleting bookmark:', error)
      showToast('error', 'Failed to delete bookmark')
    }
  }

  const openEditModal = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark)
    setNewBookmark({
      url: bookmark.url,
      title: bookmark.title || '',
      description: bookmark.description || '',
    })
  }

  const openUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <AppLayout>
      <header className="main-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
            {showArchived ? '📦 Archived' : '🔖 Bookmarks'}
          </h1>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            {filteredBookmarks.length} bookmarks
          </span>
        </div>

        <div className="main-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setNewBookmark({ url: '', title: '', description: '' })
              setShowNewBookmarkModal(true)
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Bookmark
          </button>
        </div>
      </header>

      <div className="main-content" style={{ padding: 'var(--space-6)' }}>
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
          </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <h2 className="empty-state-title">
                {showArchived ? 'No archived bookmarks' : 'No bookmarks yet'}
              </h2>
              <p className="empty-state-description">
                {showArchived 
                  ? 'Archive some bookmarks to see them here'
                  : 'Save links for later reading'}
              </p>
              {!showArchived && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowNewBookmarkModal(true)}
                >
                  Add Bookmark
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: 'var(--space-6)' }}>
              {filteredBookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-4)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-xl)',
                    marginBottom: 'var(--space-3)',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
                  }}
                >
                  {/* Favicon */}
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                    {bookmark.favicon ? (
                      <img 
                        src={bookmark.favicon} 
                        alt="" 
                        style={{ width: 24, height: 24 }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 'var(--space-2)',
                      marginBottom: bookmark.description ? 'var(--space-1)' : 0,
                    }}>
                      <span 
                        style={{ 
                          fontWeight: 'var(--font-weight-medium)',
                          color: 'var(--color-text-primary)',
                          cursor: 'pointer',
                        }}
                        onClick={() => openUrl(bookmark.url)}
                      >
                        {bookmark.title || new URL(bookmark.url).hostname}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: 'var(--font-size-xs)', 
                      color: 'var(--color-text-tertiary)',
                      marginBottom: bookmark.description ? 'var(--space-2)' : 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {new URL(bookmark.url).hostname}
                    </div>
                    {bookmark.description && (
                      <p style={{ 
                        fontSize: 'var(--font-size-sm)', 
                        color: 'var(--color-text-muted)',
                      }}>
                        {bookmark.description}
                      </p>
                    )}
                    <div style={{ 
                      fontSize: 'var(--font-size-xs)', 
                      color: 'var(--color-text-tertiary)',
                      marginTop: 'var(--space-2)',
                    }}>
                      Saved {formatDate(bookmark.created_at)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button
                      className="btn btn-icon btn-ghost"
                      onClick={() => openUrl(bookmark.url)}
                      title="Open link"
                      style={{ padding: 'var(--space-1)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </button>
                    <button
                      className="btn btn-icon btn-ghost"
                      onClick={() => openEditModal(bookmark)}
                      title="Edit"
                      style={{ padding: 'var(--space-1)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className="btn btn-icon btn-ghost"
                      onClick={() => handleToggleArchive(bookmark)}
                      title={bookmark.archived ? 'Restore' : 'Archive'}
                      style={{ padding: 'var(--space-1)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="21 8 21 21 3 21 3 8" />
                        <rect x="1" y="3" width="22" height="5" />
                        <line x1="10" y1="12" x2="14" y2="12" />
                      </svg>
                    </button>
                    <button
                      className="btn btn-icon btn-ghost"
                      onClick={() => handleDeleteBookmark(bookmark.id)}
                      title="Delete"
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

      {/* New Bookmark Modal */}
      {(showNewBookmarkModal || editingBookmark) && (
        <div className="modal-overlay" onClick={() => { setShowNewBookmarkModal(false); setEditingBookmark(null) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingBookmark ? 'Edit Bookmark' : 'Add Bookmark'}</h3>
              <button className="modal-close" onClick={() => { setShowNewBookmarkModal(false); setEditingBookmark(null) }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={editingBookmark ? handleUpdateBookmark : handleCreateBookmark}>
              <div className="form-group">
                <label className="form-label">URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com"
                  value={newBookmark.url}
                  onChange={(e) => setNewBookmark({ ...newBookmark, url: e.target.value })}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Title (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Custom title or leave blank to auto-fetch"
                  value={newBookmark.title}
                  onChange={(e) => setNewBookmark({ ...newBookmark, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <textarea
                  className="form-input"
                  placeholder="Why is this important? What do you want to remember?"
                  value={newBookmark.description}
                  onChange={(e) => setNewBookmark({ ...newBookmark, description: e.target.value })}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowNewBookmarkModal(false); setEditingBookmark(null) }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingBookmark ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
