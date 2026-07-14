import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'
import { useToast } from '../components/ToastContext'
import { Task } from '../lib/types'

type FilterType = 'all' | 'today' | 'upcoming' | 'completed'
type PriorityType = 'low' | 'medium' | 'high'

export default function TasksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium' as PriorityType,
  })

  const fetchTasks = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { nullsFirst: false })
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
      showToast('error', 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [user, showToast])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const filteredTasks = tasks.filter(task => {
    const today = new Date().toISOString().split('T')[0]
    
    switch (filter) {
      case 'today':
        return task.due_date === today && !task.completed
      case 'upcoming':
        return task.due_date && task.due_date > today && !task.completed
      case 'completed':
        return task.completed
      default:
        return !task.completed
    }
  })

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newTask.title.trim()) return

    try {
      const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        due_date: newTask.due_date || null,
        priority: newTask.priority,
      })

      if (error) throw error

      showToast('success', 'Task created')
      setNewTask({ title: '', description: '', due_date: '', priority: 'medium' })
      setShowNewTaskModal(false)
      fetchTasks()
    } catch (error) {
      console.error('Error creating task:', error)
      showToast('error', 'Failed to create task')
    }
  }

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !editingTask || !newTask.title.trim()) return

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          due_date: newTask.due_date || null,
          priority: newTask.priority,
        })
        .eq('id', editingTask.id)

      if (error) throw error

      showToast('success', 'Task updated')
      setEditingTask(null)
      setNewTask({ title: '', description: '', due_date: '', priority: 'medium' })
      fetchTasks()
    } catch (error) {
      console.error('Error updating task:', error)
      showToast('error', 'Failed to update task')
    }
  }

  const handleToggleComplete = async (task: Task) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          completed: !task.completed,
          completed_at: !task.completed ? new Date().toISOString() : null,
        })
        .eq('id', task.id)

      if (error) throw error

      setTasks(tasks.map(t => 
        t.id === task.id ? { ...t, completed: !t.completed, completed_at: !task.completed ? new Date().toISOString() : null } : t
      ))
      
      showToast('success', task.completed ? 'Task reopened' : 'Task completed')
    } catch (error) {
      console.error('Error toggling task:', error)
      showToast('error', 'Failed to update task')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error

      showToast('success', 'Task deleted')
      fetchTasks()
    } catch (error) {
      console.error('Error deleting task:', error)
      showToast('error', 'Failed to delete task')
    }
  }

  const openEditModal = (task: Task) => {
    setEditingTask(task)
    setNewTask({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date || '',
      priority: task.priority,
    })
  }

  const getPriorityColor = (priority: PriorityType) => {
    switch (priority) {
      case 'high': return '#f87171'
      case 'medium': return '#fbbf24'
      case 'low': return '#34d399'
    }
  }

  const formatDueDate = (date: string | null) => {
    if (!date) return null
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    
    if (date === today) return 'Today'
    if (date === tomorrow) return 'Tomorrow'
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const todayCount = tasks.filter(t => t.due_date === new Date().toISOString().split('T')[0] && !t.completed).length
  const upcomingCount = tasks.filter(t => {
    const today = new Date().toISOString().split('T')[0]
    return t.due_date && t.due_date > today && !t.completed
  }).length
  const completedCount = tasks.filter(t => t.completed).length
  const pendingCount = tasks.filter(t => !t.completed).length

  return (
    <div className="app">
      {/* Sidebar */}
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="nav-item-text">Notes</span>
            </button>
            <button
              className="nav-item active"
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <span className="nav-item-text">Tasks</span>
            </button>
            <button
              className="nav-item"
              onClick={() => navigate('/bookmarks')}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span className="nav-item-text">Bookmarks</span>
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Filters</div>
            <button
              className={`nav-item ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
              </svg>
              <span className="nav-item-text">All Pending</span>
              <span className="nav-item-badge">{pendingCount}</span>
            </button>
            <button
              className={`nav-item ${filter === 'today' ? 'active' : ''}`}
              onClick={() => setFilter('today')}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="nav-item-text">Today</span>
              <span className="nav-item-badge">{todayCount}</span>
            </button>
            <button
              className={`nav-item ${filter === 'upcoming' ? 'active' : ''}`}
              onClick={() => setFilter('upcoming')}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              <span className="nav-item-text">Upcoming</span>
              <span className="nav-item-badge">{upcomingCount}</span>
            </button>
            <button
              className={`nav-item ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span className="nav-item-text">Completed</span>
              <span className="nav-item-badge">{completedCount}</span>
            </button>
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
        </div>
      </aside>

      {/* Main Content */}
      <main className="app-content">
        <header className="main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
              {filter === 'today' ? '📅 Today\'s Tasks' :
               filter === 'upcoming' ? '📆 Upcoming Tasks' :
               filter === 'completed' ? '✅ Completed Tasks' :
               '📋 All Tasks'}
            </h1>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          <div className="main-header-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                setNewTask({ title: '', description: '', due_date: '', priority: 'medium' })
                setShowNewTaskModal(true)
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Task
            </button>
          </div>
        </header>

        <div className="main-content">
          {loading ? (
            <div className="auth-container">
              <div className="loading-spinner" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <h2 className="empty-state-title">
                {filter === 'completed' ? 'No completed tasks' : 'No tasks yet'}
              </h2>
              <p className="empty-state-description">
                {filter === 'completed' 
                  ? 'Complete some tasks to see them here'
                  : 'Create your first task to get started'}
              </p>
              {filter !== 'completed' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowNewTaskModal(true)}
                >
                  Create Task
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: 'var(--space-6)' }}>
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-4)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-xl)',
                    marginBottom: 'var(--space-3)',
                    opacity: task.completed ? 0.6 : 1,
                  }}
                >
                  <button
                    onClick={() => handleToggleComplete(task)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      border: `2px solid ${task.completed ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: task.completed ? 'var(--color-accent)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {task.completed && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 'var(--space-2)',
                      marginBottom: task.description ? 'var(--space-2)' : 0
                    }}>
                      <span style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        backgroundColor: getPriorityColor(task.priority),
                        flexShrink: 0,
                      }} />
                      <span style={{
                        fontWeight: 'var(--font-weight-medium)',
                        textDecoration: task.completed ? 'line-through' : 'none',
                        color: task.completed ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                      }}>
                        {task.title}
                      </span>
                    </div>
                    {task.description && (
                      <p style={{ 
                        fontSize: 'var(--font-size-sm)', 
                        color: 'var(--color-text-muted)',
                        marginBottom: 'var(--space-2)',
                        marginLeft: 'var(--space-4)',
                      }}>
                        {task.description}
                      </p>
                    )}
                    {task.due_date && (
                      <div style={{ 
                        fontSize: 'var(--font-size-xs)', 
                        color: 'var(--color-text-tertiary)',
                        marginLeft: 'var(--space-4)',
                      }}>
                        Due {formatDueDate(task.due_date)}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button
                      className="btn btn-icon btn-ghost"
                      onClick={() => openEditModal(task)}
                      style={{ padding: 'var(--space-1)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className="btn btn-icon btn-ghost"
                      onClick={() => handleDeleteTask(task.id)}
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

      {/* New Task Modal */}
      {(showNewTaskModal || editingTask) && (
        <div className="modal-overlay" onClick={() => { setShowNewTaskModal(false); setEditingTask(null) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingTask ? 'Edit Task' : 'New Task'}</h3>
              <button className="modal-close" onClick={() => { setShowNewTaskModal(false); setEditingTask(null) }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={editingTask ? handleUpdateTask : handleCreateTask}>
              <div className="form-group">
                <label className="form-label">Task title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="What needs to be done?"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="form-input"
                  placeholder="Add more details..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Due date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-input"
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as PriorityType })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowNewTaskModal(false); setEditingTask(null) }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTask ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
