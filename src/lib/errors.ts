/**
 * Error handling and resilience utilities
 * Retry logic, offline detection, structured error logging
 */

// Custom error class for typed errors
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 500,
    public retryable: boolean = true,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Predefined error codes
export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  CONFLICT: 'CONFLICT',
  TIMEOUT: 'TIMEOUT',
  OFFLINE: 'OFFLINE',
  UNKNOWN: 'UNKNOWN'
} as const

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableStatuses: number[]
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt)
  const clampedDelay = Math.min(exponentialDelay, config.maxDelay)
  // Add jitter (±25%)
  const jitter = clampedDelay * 0.25 * (Math.random() * 2 - 1)
  return clampedDelay + jitter
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: Error, delay: number) => void
): Promise<T> {
  const finalConfig = { ...defaultRetryConfig, ...config }
  let lastError: Error

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      // Check if we should retry
      const isRetryable = 
        error instanceof AppError
          ? error.retryable
          : finalConfig.retryableStatuses.includes((error as any).status) ||
            (error as any).message?.includes('fetch')

      if (!isRetryable || attempt === finalConfig.maxRetries) {
        throw error
      }

      const delay = calculateDelay(attempt, finalConfig)
      onRetry?.(attempt + 1, lastError, delay)

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Supabase error handler
 */
export function handleSupabaseError(error: any): AppError {
  if (error instanceof AppError) {
    return error
  }

  const status = error.status || 500
  const message = error.message || 'An unexpected error occurred'

  switch (status) {
    case 400:
      return new AppError(message, ErrorCodes.VALIDATION_ERROR, status, false, error)
    case 401:
      return new AppError('Please sign in again', ErrorCodes.UNAUTHORIZED, status, false, error)
    case 403:
      return new AppError('You do not have permission', ErrorCodes.FORBIDDEN, status, false, error)
    case 404:
      return new AppError('Resource not found', ErrorCodes.NOT_FOUND, status, false, error)
    case 429:
      return new AppError('Too many requests. Please wait.', ErrorCodes.RATE_LIMITED, status, true, error)
    case 500:
    case 502:
    case 503:
    case 504:
      return new AppError('Server error. Please try again.', ErrorCodes.SERVER_ERROR, status, true, error)
    default:
      if (message.includes('fetch') || message.includes('network')) {
        return new AppError('Network error. Check your connection.', ErrorCodes.NETWORK_ERROR, status, true, error)
      }
      return new AppError(message, ErrorCodes.UNKNOWN, status, true, error)
  }
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = AppError> = 
  | { success: true; data: T }
  | { success: false; error: E }

/**
 * Execute a safe operation that returns a Result
 */
export async function safeExecute<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: handleSupabaseError(error) }
  }
}

// ==========================================
// Offline Detection & Sync Queue
// ==========================================

class OfflineManager {
  private listeners: Set<(online: boolean) => void> = new Set()
  private syncQueue: Array<{
    id: string
    fn: () => Promise<any>
    timestamp: number
    retries: number
  }> = []
  private isProcessing = false
  private _isOnline = navigator.onLine

  constructor() {
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
    
    // Load queue from localStorage
    this.loadQueue()
  }

  get isOnline(): boolean {
    return this._isOnline
  }

  subscribe(callback: (online: boolean) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private handleOnline(): void {
    this._isOnline = true
    this.listeners.forEach(cb => cb(true))
    this.processQueue()
  }

  private handleOffline(): void {
    this._isOnline = false
    this.listeners.forEach(cb => cb(false))
  }

  /**
   * Queue an operation for sync when back online
   */
  async queueOperation<T>(
    id: string,
    fn: () => Promise<T>
  ): Promise<T | null> {
    if (this._isOnline) {
      return fn()
    }

    // Queue for later
    const queueItem = {
      id,
      fn,
      timestamp: Date.now(),
      retries: 0
    }
    this.syncQueue.push(queueItem)
    this.saveQueue()

    // Return null to indicate queued
    return null
  }

  /**
   * Process the sync queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.syncQueue.length === 0) return

    this.isProcessing = true
    const queue = [...this.syncQueue]
    const failed: typeof this.syncQueue = []

    for (const item of queue) {
      try {
        await item.fn()
      } catch {
        item.retries++
        if (item.retries < 3) {
          failed.push(item)
        }
      }
    }

    this.syncQueue = failed
    this.saveQueue()
    this.isProcessing = false

    // If there are still failed items, retry after delay
    if (this.syncQueue.length > 0) {
      setTimeout(() => this.processQueue(), 30000)
    }
  }

  private saveQueue(): void {
    // Note: Can't save functions to localStorage, so we just track IDs
    // In production, use IndexedDB for full objects
    const ids = this.syncQueue.map(item => ({ id: item.id, timestamp: item.timestamp, retries: item.retries }))
    localStorage.setItem('sync_queue_meta', JSON.stringify(ids))
  }

  private loadQueue(): void {
    // Queue loaded from localStorage would need re-registration
    // This is handled by the app on init
  }

  getQueueLength(): number {
    return this.syncQueue.length
  }
}

export const offlineManager = new OfflineManager()

// ==========================================
// Structured Error Logging
// ==========================================

interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, any>
  error?: {
    name: string
    message: string
    stack?: string
  }
  userId?: string
  sessionId?: string
}

class ErrorLogger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private flushThreshold = 50
  private userId?: string
  private sessionId?: string

  setUser(userId: string | undefined): void {
    this.userId = userId
  }

  setSession(sessionId: string | undefined): void {
    this.sessionId = sessionId
  }

  private add(entry: Omit<LogEntry, 'timestamp' | 'userId' | 'sessionId'>): void {
    const log: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      sessionId: this.sessionId
    }
    
    this.logs.push(log)
    
    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Console output for development
    if (import.meta.env.DEV) {
      const prefix = `[${log.level.toUpperCase()}]`
      switch (log.level) {
        case 'debug':
          console.debug(prefix, log.message, log.context)
          break
        case 'info':
          console.info(prefix, log.message, log.context)
          break
        case 'warn':
          console.warn(prefix, log.message, log.context)
          break
        case 'error':
          console.error(prefix, log.message, log.context, log.error)
          break
      }
    }

    // Flush to server if threshold reached
    if (this.logs.length >= this.flushThreshold) {
      this.flush()
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.add({ level: 'debug', message, context })
  }

  info(message: string, context?: Record<string, any>): void {
    this.add({ level: 'info', message, context })
  }

  warn(message: string, context?: Record<string, any>): void {
    this.add({ level: 'warn', message, context })
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.add({
      level: 'error',
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    })
  }

  async flush(): Promise<void> {
    if (this.logs.length === 0) return

    const logsToSend = [...this.logs]
    this.logs = []

    try {
      // In production, send to error tracking service
      // For now, just store in localStorage
      const stored = localStorage.getItem('error_logs')
      const existing = stored ? JSON.parse(stored) : []
      localStorage.setItem(
        'error_logs',
        JSON.stringify([...existing, ...logsToSend].slice(-500))
      )
    } catch {
      // Storage full or unavailable
      this.logs.unshift(...logsToSend)
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }
}

export const errorLogger = new ErrorLogger()

// Global error handlers
window.addEventListener('error', (event) => {
  errorLogger.error('Unhandled error', event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  })
})

window.addEventListener('unhandledrejection', (event) => {
  errorLogger.error('Unhandled promise rejection', event.reason, {
    promise: event.promise
  })
})
