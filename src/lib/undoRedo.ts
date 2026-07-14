/**
 * Undo/Redo stack for editor operations
 */

export interface UndoableAction {
  id: string
  type: string
  description: string
  undo: () => void | Promise<void>
  redo: () => void | Promise<void>
  timestamp: number
}

interface ActionStack {
  past: UndoableAction[]
  future: UndoableAction[]
}

class UndoManager {
  private stacks = new Map<string, ActionStack>()
  private maxSize: number
  private listeners: Set<(key: string, stack: ActionStack) => void> = new Set()

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }

  /**
   * Get or create stack for a context
   */
  private getStack(key: string): ActionStack {
    if (!this.stacks.has(key)) {
      this.stacks.set(key, { past: [], future: [] })
    }
    return this.stacks.get(key)!
  }

  /**
   * Push an undoable action
   */
  push(key: string, action: Omit<UndoableAction, 'id' | 'timestamp'>): void {
    const stack = this.getStack(key)
    
    const fullAction: UndoableAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }

    // Add to past, clear future
    stack.past.push(fullAction)
    stack.future = []

    // Trim if over max size
    if (stack.past.length > this.maxSize) {
      stack.past.shift()
    }

    this.notifyListeners(key, stack)
  }

  /**
   * Undo the last action
   */
  async undo(key: string): Promise<boolean> {
    const stack = this.getStack(key)
    
    if (stack.past.length === 0) {
      return false
    }

    const action = stack.past.pop()!
    await action.undo()
    stack.future.push(action)

    this.notifyListeners(key, stack)
    return true
  }

  /**
   * Redo the last undone action
   */
  async redo(key: string): Promise<boolean> {
    const stack = this.getStack(key)
    
    if (stack.future.length === 0) {
      return false
    }

    const action = stack.future.pop()!
    await action.redo()
    stack.past.push(action)

    this.notifyListeners(key, stack)
    return true
  }

  /**
   * Clear the stack for a key
   */
  clear(key: string): void {
    this.stacks.delete(key)
    this.notifyListeners(key, { past: [], future: [] })
  }

  /**
   * Clear all stacks
   */
  clearAll(): void {
    this.stacks.clear()
    this.listeners.forEach(cb => cb('', { past: [], future: [] }))
  }

  /**
   * Check if undo is available
   */
  canUndo(key: string): boolean {
    return this.getStack(key).past.length > 0
  }

  /**
   * Check if redo is available
   */
  canRedo(key: string): boolean {
    return this.getStack(key).future.length > 0
  }

  /**
   * Get stack info
   */
  getStackInfo(key: string): { past: number; future: number } {
    const stack = this.getStack(key)
    return {
      past: stack.past.length,
      future: stack.future.length
    }
  }

  /**
   * Subscribe to stack changes
   */
  subscribe(callback: (key: string, stack: ActionStack) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notifyListeners(key: string, stack: ActionStack): void {
    this.listeners.forEach(cb => cb(key, stack))
  }
}

export const undoManager = new UndoManager()

// Hook for React components
export function useUndoRedo(contextKey: string) {
  return {
    push: (action: Omit<UndoableAction, 'id' | 'timestamp'>) => 
      undoManager.push(contextKey, action),
    undo: () => undoManager.undo(contextKey),
    redo: () => undoManager.redo(contextKey),
    canUndo: () => undoManager.canUndo(contextKey),
    canRedo: () => undoManager.canRedo(contextKey),
    clear: () => undoManager.clear(contextKey),
    info: () => undoManager.getStackInfo(contextKey)
  }
}

// ==========================================
// Editor-specific undo/redo
// ==========================================

export interface EditorState {
  content: string
  selection?: { from: number; to: number }
}

export interface EditorAction {
  type: 'insert' | 'delete' | 'format' | 'replace'
  description: string
  before: EditorState
  after: EditorState
}

/**
 * Create an editor undo/redo action
 */
export function createEditorAction(
  type: EditorAction['type'],
  description: string,
  _before: EditorState,
  _after: EditorState
): Omit<UndoableAction, 'id' | 'timestamp'> {
  return {
    type,
    description,
    undo: () => {
      // This would be implemented by the editor component
      // using the stored before/after states
    },
    redo: () => {
      // This would be implemented by the editor component
    }
  }
}
