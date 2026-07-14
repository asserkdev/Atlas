import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { Note } from '../lib/types'

interface QuickSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function QuickSearchModal({ isOpen, onClose }: QuickSearchModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Note[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const searchNotes = useCallback(async (searchQuery: string) => {
    if (!user || !searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
        .order('updated_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setResults(data || [])
      setSelectedIndex(0)
    } catch (error) {
      console.error('Error searching notes:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchNotes(query)
    }, 200)
    return () => clearTimeout(debounceTimer)
  }, [query, searchNotes])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      navigate(`/note/${results[selectedIndex].id}`)
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const getPreview = (content: string, maxLength: number = 100) => {
    // Strip HTML tags
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  if (!isOpen) return null

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{ alignItems: 'flex-start', paddingTop: '15vh' }}
    >
      <div 
        className="modal" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 600, width: '90%', padding: 0, overflow: 'hidden' }}
      >
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-base)',
              }}
            />
            <span style={{ 
              fontSize: 'var(--font-size-xs)', 
              color: 'var(--color-text-tertiary)',
              background: 'var(--color-bg-tertiary)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)'
            }}>
              ESC
            </span>
          </div>
        </div>

        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <div className="loading-spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : results.length === 0 && query ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No notes found for "{query}"
            </div>
          ) : results.length === 0 && !query ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <p style={{ marginBottom: 'var(--space-2)' }}>Start typing to search</p>
              <p style={{ fontSize: 'var(--font-size-xs)' }}>↑↓ to navigate, Enter to select</p>
            </div>
          ) : (
            results.map((note, index) => (
              <div
                key={note.id}
                onClick={() => {
                  navigate(`/note/${note.id}`)
                  onClose()
                }}
                style={{
                  padding: 'var(--space-4)',
                  cursor: 'pointer',
                  background: index === selectedIndex ? 'var(--color-bg-tertiary)' : 'transparent',
                  borderLeft: index === selectedIndex ? '2px solid var(--color-accent)' : '2px solid transparent',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ 
                  fontWeight: 'var(--font-weight-medium)', 
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-1)'
                }}>
                  {note.title || 'Untitled Note'}
                </div>
                {note.content && (
                  <div style={{ 
                    fontSize: 'var(--font-size-sm)', 
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.5
                  }}>
                    {getPreview(note.content)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ 
          padding: 'var(--space-3)', 
          borderTop: '1px solid var(--color-border-subtle)',
          display: 'flex',
          gap: 'var(--space-4)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)'
        }}>
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  )
}
