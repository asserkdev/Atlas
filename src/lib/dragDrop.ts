/**
 * Drag and drop utilities for organizing notes, projects, and folders
 */

export interface DragItem {
  id: string
  type: 'note' | 'project' | 'folder'
  index: number
}

export interface DropTarget {
  id: string | null // null means root level
  position: 'before' | 'after' | 'inside'
}

export interface DragState {
  isDragging: boolean
  draggedItem: DragItem | null
  dropTarget: DropTarget | null
}

type DragEventHandler = (item: DragItem, target: DropTarget) => void

class DragDropManager {
  private state: DragState = {
    isDragging: false,
    draggedItem: null,
    dropTarget: null
  }
  private onDrop?: DragEventHandler
  private listeners: Set<(state: DragState) => void> = new Set()

  /**
   * Start dragging an item
   */
  startDrag(item: DragItem): void {
    this.state = {
      isDragging: true,
      draggedItem: item,
      dropTarget: null
    }
    this.notifyListeners()
  }

  /**
   * Update the current drop target
   */
  updateDropTarget(target: DropTarget | null): void {
    this.state.dropTarget = target
    this.notifyListeners()
  }

  /**
   * End the drag operation
   */
  endDrag(): void {
    if (this.state.isDragging && this.state.draggedItem && this.state.dropTarget && this.onDrop) {
      this.onDrop(this.state.draggedItem, this.state.dropTarget)
    }
    
    this.state = {
      isDragging: false,
      draggedItem: null,
      dropTarget: null
    }
    this.notifyListeners()
  }

  /**
   * Cancel the drag operation
   */
  cancelDrag(): void {
    this.state = {
      isDragging: false,
      draggedItem: null,
      dropTarget: null
    }
    this.notifyListeners()
  }

  /**
   * Set the drop handler
   */
  onDropItem(handler: DragEventHandler): void {
    this.onDrop = handler
  }

  /**
   * Get current state
   */
  getState(): DragState {
    return { ...this.state }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: DragState) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notifyListeners(): void {
    const state = this.getState()
    this.listeners.forEach(cb => cb(state))
  }
}

export const dragDropManager = new DragDropManager()

// ==========================================
// HTML5 Drag and Drop Helpers
// ==========================================

/**
 * Create drag event handlers for an element
 */
export function createDraggable(
  item: DragItem,
  options?: {
    onDragStart?: () => void
    onDragEnd?: () => void
  }
): React.HTMLAttributes<HTMLDivElement> {
  return {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('application/json', JSON.stringify(item))
      
      // Add visual feedback
      const target = e.target as HTMLElement
      target.style.opacity = '0.5'
      
      dragDropManager.startDrag(item)
      options?.onDragStart?.()
    },
    onDragEnd: (e) => {
      const target = e.target as HTMLElement
      target.style.opacity = '1'
      
      dragDropManager.endDrag()
      options?.onDragEnd?.()
    }
  }
}

/**
 * Create drop zone handlers
 */
export function createDropZone(
  _targetId: string,
  options?: {
    onDragEnter?: () => void
    onDragLeave?: () => void
    onDrop?: () => void
  }
): React.HTMLAttributes<HTMLDivElement> {
  return {
    onDragOver: (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    onDragEnter: (e) => {
      e.preventDefault()
      options?.onDragEnter?.()
    },
    onDragLeave: (e) => {
      // Only trigger if leaving this element (not entering a child)
      const relatedTarget = e.relatedTarget as HTMLElement
      if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
        options?.onDragLeave?.()
      }
    },
    onDrop: (e) => {
      e.preventDefault()
      options?.onDrop?.()
    }
  }
}

/**
 * Calculate drop position based on mouse position relative to element
 */
export function calculateDropPosition(
  mouseY: number,
  elementRect: DOMRect
): 'before' | 'after' | 'inside' {
  const relativeY = mouseY - elementRect.top
  const height = elementRect.height
  
  if (relativeY < height * 0.25) {
    return 'before'
  }
  if (relativeY > height * 0.75) {
    return 'after'
  }
  return 'inside'
}

/**
 * Determine if items can be dropped
 */
export function canDrop(
  draggedItem: DragItem,
  targetId: string | null
): boolean {
  // Can't drop on self
  if (draggedItem.id === targetId) {
    return false
  }
  
  // Can't drop a folder into itself
  if (draggedItem.type === 'folder' && draggedItem.id === targetId) {
    return false
  }
  
  return true
}

/**
 * Reorder array based on drag and drop
 */
export function reorderArray<T extends { id: string }>(
  items: T[],
  draggedId: string,
  targetId: string,
  position: 'before' | 'after' | 'inside'
): T[] {
  const result = [...items]
  const draggedIndex = result.findIndex(item => item.id === draggedId)
  const targetIndex = result.findIndex(item => item.id === targetId)
  
  if (draggedIndex === -1 || targetIndex === -1) {
    return result
  }
  
  const [draggedItem] = result.splice(draggedIndex, 1)
  
  if (position === 'inside') {
    // For folders, this would add to the folder's children
    // For now, just add after the target
    result.splice(targetIndex + 1, 0, draggedItem)
  } else if (position === 'before') {
    result.splice(targetIndex, 0, draggedItem)
  } else {
    result.splice(targetIndex + 1, 0, draggedItem)
  }
  
  return result
}
