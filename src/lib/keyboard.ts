/**
 * Keyboard shortcuts and command palette system
 */

type ShortcutHandler = (event: KeyboardEvent) => void

interface Shortcut {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  handler: ShortcutHandler
  description?: string
  category?: string
  preventDefault?: boolean
}

interface Command {
  id: string
  name: string
  description?: string
  shortcut?: string
  icon?: string
  category?: string
  action: () => void | Promise<void>
}

class KeyboardManager {
  private shortcuts = new Map<string, Shortcut>()
  private enabled = true

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: Shortcut): () => void {
    const key = this.getKeyString(shortcut)
    this.shortcuts.set(key, shortcut)
    
    // Return unregister function
    return () => this.unregister(shortcut)
  }

  /**
   * Unregister a shortcut
   */
  unregister(shortcut: Shortcut): void {
    const key = this.getKeyString(shortcut)
    this.shortcuts.delete(key)
  }

  /**
   * Handle keyboard event
   */
  handle(event: KeyboardEvent): void {
    if (!this.enabled) return

    // Don't trigger shortcuts when typing in inputs (unless meta/ctrl)
    const target = event.target as HTMLElement
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
    
    for (const shortcut of this.shortcuts.values()) {
      if (this.matchesShortcut(event, shortcut)) {
        // Allow all shortcuts with ctrl/meta, block text input shortcuts
        if (isInput && !shortcut.meta && !shortcut.ctrl) {
          continue
        }

        if (shortcut.preventDefault !== false) {
          event.preventDefault()
        }
        shortcut.handler(event)
        return
      }
    }
  }

  /**
   * Enable/disable all shortcuts
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts(): Shortcut[] {
    return Array.from(this.shortcuts.values())
  }

  private getKeyString(shortcut: Shortcut): string {
    const parts: string[] = []
    if (shortcut.ctrl) parts.push('ctrl')
    if (shortcut.meta) parts.push('meta')
    if (shortcut.alt) parts.push('alt')
    if (shortcut.shift) parts.push('shift')
    parts.push(shortcut.key.toLowerCase())
    return parts.join('+')
  }

  private matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
    const key = event.key.toLowerCase()
    
    if (key !== shortcut.key.toLowerCase()) return false
    if (shortcut.ctrl && !event.ctrlKey) return false
    if (shortcut.meta && !event.metaKey) return false
    if (shortcut.alt && !event.altKey) return false
    if (shortcut.shift && !event.shiftKey) return false
    
    // If ctrl/meta specified, match regardless of other modifiers
    if (shortcut.ctrl || shortcut.meta) {
      return true
    }
    
    // Otherwise, exact match
    return !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
  }
}

export const keyboardManager = new KeyboardManager()

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean }): string {
  const isMac = navigator.platform.includes('Mac')
  const parts: string[] = []
  
  if (shortcut.meta || shortcut.ctrl) {
    parts.push(isMac ? '⌘' : 'Ctrl')
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt')
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift')
  }
  
  // Format special keys
  let key = shortcut.key
  switch (key.toLowerCase()) {
    case 'escape': key = 'Esc'; break
    case 'arrowup': key = '↑'; break
    case 'arrowdown': key = '↓'; break
    case 'arrowleft': key = '←'; break
    case 'arrowright': key = '→'; break
    case 'enter': key = '↵'; break
    case 'backspace': key = '⌫'; break
    default: key = key.toUpperCase()
  }
  
  parts.push(key)
  return parts.join(isMac ? '' : '+')
}

// ==========================================
// Command Palette
// ==========================================

class CommandPalette {
  private commands: Command[] = []
  private isOpen = false
  private searchFn?: (query: string, commands: Command[]) => Command[]
  private onClose?: () => void

  /**
   * Register commands
   */
  register(commands: Command[]): void {
    this.commands.push(...commands)
  }

  /**
   * Register single command
   */
  registerCommand(command: Command): () => void {
    this.commands.push(command)
    return () => {
      const index = this.commands.indexOf(command)
      if (index > -1) this.commands.splice(index, 1)
    }
  }

  /**
   * Set search function (for fuzzy search)
   */
  setSearch(fn: (query: string, commands: Command[]) => Command[]): void {
    this.searchFn = fn
  }

  /**
   * Set callbacks
   */
  setCallbacks(onClose: () => void): void {
    this.onClose = onClose
  }

  /**
   * Search commands
   */
  search(query: string): Command[] {
    if (!query.trim()) {
      // Return recent/frequently used commands first
      return this.commands.slice(0, 10)
    }

    const lowerQuery = query.toLowerCase()

    if (this.searchFn) {
      return this.searchFn(query, this.commands)
    }

    // Default fuzzy search
    const scored = this.commands.map(cmd => {
      let score = 0
      const name = cmd.name.toLowerCase()
      const desc = (cmd.description || '').toLowerCase()

      // Exact match
      if (name === lowerQuery) score = 100
      // Starts with
      else if (name.startsWith(lowerQuery)) score = 80
      // Contains
      else if (name.includes(lowerQuery)) score = 60
      // Description match
      else if (desc.includes(lowerQuery)) score = 40
      // Fuzzy character match
      else {
        let qi = 0
        for (let ni = 0; ni < name.length && qi < lowerQuery.length; ni++) {
          if (name[ni] === lowerQuery[qi]) {
            score += 5
            qi++
          }
        }
        if (qi < lowerQuery.length) score = 0
      }

      return { command: cmd, score }
    })

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.command)
  }

  /**
   * Open the palette
   */
  open(): void {
    this.isOpen = true
  }

  /**
   * Close the palette
   */
  close(): void {
    this.isOpen = false
    this.onClose?.()
  }

  /**
   * Toggle the palette
   */
  toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  /**
   * Check if open
   */
  getIsOpen(): boolean {
    return this.isOpen
  }

  /**
   * Get all commands
   */
  getCommands(): Command[] {
    return [...this.commands]
  }
}

export const commandPalette = new CommandPalette()

// ==========================================
// Keyboard Shortcuts for Atlas
// ==========================================

export function registerAtlasShortcuts(handlers: {
  onNewNote?: () => void
  onSearch?: () => void
  onSave?: () => void
  onDelete?: () => void
  onToggleStarred?: () => void
  onNavigateNotes?: () => void
  onNavigateTasks?: () => void
  onNavigateBookmarks?: () => void
  onToggleTheme?: () => void
  onUndo?: () => void
  onRedo?: () => void
}): () => void {
  const unregisters: (() => void)[] = []

  // New note
  if (handlers.onNewNote) {
    unregisters.push(
      keyboardManager.register({
        key: 'n',
        ctrl: true,
        handler: handlers.onNewNote,
        description: 'Create new note',
        category: 'Notes'
      })
    )
  }

  // Search
  if (handlers.onSearch) {
    unregisters.push(
      keyboardManager.register({
        key: 'k',
        ctrl: true,
        handler: handlers.onSearch,
        description: 'Search',
        category: 'General'
      })
    )
    unregisters.push(
      keyboardManager.register({
        key: 'k',
        meta: true,
        handler: handlers.onSearch,
        description: 'Search',
        category: 'General'
      })
    )
  }

  // Save
  if (handlers.onSave) {
    unregisters.push(
      keyboardManager.register({
        key: 's',
        ctrl: true,
        handler: handlers.onSave,
        description: 'Save',
        category: 'General'
      })
    )
  }

  // Delete
  if (handlers.onDelete) {
    unregisters.push(
      keyboardManager.register({
        key: 'Backspace',
        ctrl: true,
        handler: handlers.onDelete,
        description: 'Delete',
        category: 'General'
      })
    )
  }

  // Toggle starred
  if (handlers.onToggleStarred) {
    unregisters.push(
      keyboardManager.register({
        key: 's',
        ctrl: true,
        shift: true,
        handler: handlers.onToggleStarred,
        description: 'Toggle starred',
        category: 'Notes'
      })
    )
  }

  // Navigation
  if (handlers.onNavigateNotes) {
    unregisters.push(
      keyboardManager.register({
        key: '1',
        ctrl: true,
        handler: handlers.onNavigateNotes,
        description: 'Go to Notes',
        category: 'Navigation'
      })
    )
  }

  if (handlers.onNavigateTasks) {
    unregisters.push(
      keyboardManager.register({
        key: '2',
        ctrl: true,
        handler: handlers.onNavigateTasks,
        description: 'Go to Tasks',
        category: 'Navigation'
      })
    )
  }

  if (handlers.onNavigateBookmarks) {
    unregisters.push(
      keyboardManager.register({
        key: '3',
        ctrl: true,
        handler: handlers.onNavigateBookmarks,
        description: 'Go to Bookmarks',
        category: 'Navigation'
      })
    )
  }

  // Theme toggle
  if (handlers.onToggleTheme) {
    unregisters.push(
      keyboardManager.register({
        key: 't',
        ctrl: true,
        shift: true,
        handler: handlers.onToggleTheme,
        description: 'Toggle theme',
        category: 'General'
      })
    )
  }

  // Undo/Redo
  if (handlers.onUndo) {
    unregisters.push(
      keyboardManager.register({
        key: 'z',
        ctrl: true,
        handler: handlers.onUndo,
        description: 'Undo',
        category: 'General'
      })
    )
    unregisters.push(
      keyboardManager.register({
        key: 'z',
        ctrl: true,
        shift: true,
        handler: handlers.onRedo || (() => {}),
        description: 'Redo',
        category: 'General'
      })
    )
  }

  // Return cleanup function
  return () => {
    unregisters.forEach(fn => fn())
  }
}
