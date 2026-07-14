/**
 * Audit logging for Atlas
 * Tracks all data changes for security and compliance
 */

import { supabase } from './supabase'

export type AuditAction = 
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SIGNUP'
  | 'PASSWORD_RESET'
  | 'FAILED_AUTH'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'EXPORT'
  | 'IMPORT'

export type AuditEntity =
  | 'NOTE'
  | 'PROJECT'
  | 'FOLDER'
  | 'TAG'
  | 'TASK'
  | 'BOOKMARK'
  | 'USER'
  | 'SESSION'

export interface AuditLogEntry {
  id?: string
  user_id: string | null
  action: AuditAction
  entity_type: AuditEntity
  entity_id: string | null
  old_values: Record<string, any> | null
  new_values: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, any> | null
  created_at?: string
}

class AuditLogger {
  private queue: AuditLogEntry[] = []
  private isProcessing = false
  private flushInterval: number | null = null

  constructor() {
    // Flush queue every 5 seconds
    this.flushInterval = window.setInterval(() => this.flush(), 5000)
    
    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flushSync())
  }

  /**
   * Log an audit event
   */
  log(entry: Omit<AuditLogEntry, 'created_at' | 'ip_address' | 'user_agent'>): void {
    this.queue.push({
      ...entry,
      ip_address: null, // Client-side can't get real IP
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString()
    })

    // If queue is too large, flush immediately
    if (this.queue.length >= 50) {
      this.flush()
    }
  }

  /**
   * Log with async flush (for non-critical events)
   */
  private async flush(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return
    
    this.isProcessing = true
    const entries = [...this.queue]
    this.queue = []

    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert(entries)
      
      if (error) {
        // Re-queue on failure
        this.queue.unshift(...entries)
        console.error('Audit log flush failed:', error)
      }
    } catch (err) {
      // Re-queue on failure
      this.queue.unshift(...entries)
      console.error('Audit log flush error:', err)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Synchronous flush for page unload
   */
  private flushSync(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    
    // Store in localStorage as fallback if too many queued
    if (this.queue.length > 0) {
      try {
        const stored = localStorage.getItem('audit_queue')
        const existing = stored ? JSON.parse(stored) : []
        localStorage.setItem('audit_queue', JSON.stringify([...existing, ...this.queue]))
      } catch {
        // Storage full or unavailable
      }
    }
  }

  /**
   * Flush and cleanup
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flush()
  }
}

// Singleton instance
export const auditLogger = new AuditLogger()

/**
 * Helper to log CRUD operations
 */
export function logAudit(
  userId: string | null,
  action: AuditAction,
  entityType: AuditEntity,
  entityId: string | null = null,
  oldValues: Record<string, any> | null = null,
  newValues: Record<string, any> | null = null,
  metadata: Record<string, any> | null = null
): void {
  auditLogger.log({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues,
    new_values: newValues,
    metadata
  })
}

/**
 * Quick auth event logging
 */
export function logAuthEvent(
  userId: string | null,
  action: 'LOGIN' | 'LOGOUT' | 'SIGNUP' | 'FAILED_AUTH' | 'RATE_LIMITED',
  metadata: Record<string, any> | null = null
): void {
  logAudit(userId, action, 'SESSION', null, null, null, metadata)
}
