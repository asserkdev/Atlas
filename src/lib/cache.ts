/**
 * Caching layer for frequently accessed data
 * In-memory cache with TTL and size limits
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
  lastAccessed: number
}

interface CacheStats {
  hits: number
  misses: number
  size: number
}

class CacheStore<T> {
  private store = new Map<string, CacheEntry<T>>()
  private maxSize: number
  private defaultTTL: number
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 }

  constructor(maxSize: number = 100, defaultTTL: number = 5 * 60 * 1000) {
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
    
    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000)
  }

  get(key: string): T | null {
    const entry = this.store.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key)
      this.stats.misses++
      return null
    }

    // Update last accessed
    entry.lastAccessed = Date.now()
    this.stats.hits++
    return entry.value
  }

  set(key: string, value: T, ttl?: number): void {
    // Evict if at max size
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this.evictLRU()
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttl || this.defaultTTL),
      lastAccessed: Date.now()
    })
    this.stats.size = this.store.size
  }

  has(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return false
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return false
    }
    return true
  }

  delete(key: string): void {
    this.store.delete(key)
    this.stats.size = this.store.size
  }

  clear(): void {
    this.store.clear()
    this.stats = { hits: 0, misses: 0, size: 0 }
  }

  private evictLRU(): void {
    let oldest: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldest = key
      }
    }

    if (oldest) {
      this.store.delete(oldest)
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < now) {
        this.store.delete(key)
      }
    }
    this.stats.size = this.store.size
  }

  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0
    }
  }
}

// Singleton instances for different data types
export const noteCache = new CacheStore<any>(50, 5 * 60 * 1000) // 5 min TTL
export const userCache = new CacheStore<any>(20, 15 * 60 * 1000) // 15 min TTL
export const searchCache = new CacheStore<any[]>(100, 2 * 60 * 1000) // 2 min TTL

// Export CacheStore for external use
export { CacheStore }

/**
 * Memoize a function with caching
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  cache: CacheStore<ReturnType<T>>,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)
    const cached = cache.get(key)
    if (cached !== null) return cached
    
    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T
}

/**
 * Cache-first fetch with background refresh
 */
export async function cacheFirst<T>(
  key: string,
  cache: CacheStore<T>,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = cache.get(key)
  
  if (cached !== null) {
    // Return cached, but refresh in background if stale
    const entry = (cache as any).store.get(key)
    if (entry && entry.expiresAt - Date.now() < (ttl || 60000)) {
      // Refresh in background
      fetcher()
        .then(data => cache.set(key, data, ttl))
        .catch(() => {}) // Ignore background errors
    }
    return cached
  }

  // Fetch and cache
  const data = await fetcher()
  cache.set(key, data, ttl)
  return data
}

// ==========================================
// Debouncing
// ==========================================

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = window.setTimeout(() => {
      fn(...args)
      timeoutId = undefined
    }, delay)
  }
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0
  let timeoutId: number | undefined

  return (...args: Parameters<T>) => {
    const now = Date.now()
    
    if (now - lastCall >= delay) {
      lastCall = now
      fn(...args)
    } else {
      // Schedule for later if not already scheduled
      if (!timeoutId) {
        timeoutId = window.setTimeout(() => {
          lastCall = Date.now()
          fn(...args)
          timeoutId = undefined
        }, delay - (now - lastCall))
      }
    }
  }
}

/**
 * Debounced autosave hook helper
 */
export function createAutosave(
  save: () => Promise<void>,
  delay: number = 1000
): {
  trigger: () => void
  flush: () => Promise<void>
  cancel: () => void
} {
  let timeoutId: number | undefined

  return {
    trigger: () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(async () => {
        try {
          await save()
        } catch (error) {
          console.error('Autosave failed:', error)
        }
        timeoutId = undefined
      }, delay)
    },
    flush: async () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = undefined
        await save()
      }
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
    }
  }
}

// ==========================================
// Lazy Loading
// ==========================================

/**
 * Dynamic import with loading state
 */
export function lazyImport<T>(
  importFn: () => Promise<{ default: T }>
): {
  get: () => Promise<T>
  preload: () => void
} {
  let cached: T | null = null
  let loading: Promise<T> | null = null

  return {
    get: async () => {
      if (cached) return cached
      if (loading) return loading
      
      loading = importFn().then(module => {
        cached = module.default
        return cached
      })
      
      return loading
    },
    preload: () => {
      if (!cached && !loading) {
        loading = importFn().then(module => {
          cached = module.default
          return cached
        })
      }
    }
  }
}
