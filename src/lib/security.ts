/**
 * Security utilities for Atlas
 * Handles input sanitization, CSRF protection, and rate limiting
 */

// Rate limiting configuration
interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Every minute

/**
 * Rate limiter for auth attempts
 * Returns true if the attempt is allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 900000 // 15 minutes
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs
    })
    return { allowed: true, remaining: maxAttempts - 1, resetIn: windowMs }
  }
  
  if (entry.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetAt - now
    }
  }
  
  entry.count++
  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetIn: entry.resetAt - now
  }
}

/**
 * Clear rate limit for a key (e.g., after successful auth)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key)
}

/**
 * Input sanitization - prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''
  
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Encode HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Remove script-like patterns
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/<script/gi, '&lt;script')
    .replace(/<iframe/gi, '&lt;iframe')
}

/**
 * Sanitize HTML content (for rich text editor)
 * Allows safe HTML tags while stripping dangerous ones
 */
export function sanitizeHTML(html: string): string {
  if (typeof html !== 'string') return ''
  
  // Remove dangerous patterns first
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, 'data-removed=')
    .replace(/<iframe/gi, '&lt;iframe')
    .replace(/<object/gi, '&lt;object')
    .replace(/<embed/gi, '&lt;embed')
    .replace(/<link/gi, '&lt;link')
    .replace(/<meta/gi, '&lt;meta')
  
  // Allow only safe tags
  const allowedTags = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div'
  ]
  
  // Remove any remaining tags not in allowlist
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
  clean = clean.replace(tagPattern, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match
    }
    return ''
  })
  
  // Sanitize URLs in href and src
  clean = clean.replace(
    /(href|src)\s*=\s*["']([^"']+)["']/gi,
    (match, attr, url) => {
      if (url.startsWith('javascript:') || url.startsWith('data:')) {
        return `${attr}=""`
      }
      return match
    }
  )
  
  return clean
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * Validate URL format
 */
export function isValidURL(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Store for CSRF tokens (in production, use httpOnly cookies)
const csrfTokens = new Map<string, { token: string; expires: number }>()

/**
 * Create a CSRF token for a session
 */
export function createCSRFToken(sessionId: string): string {
  const token = generateCSRFToken()
  csrfTokens.set(sessionId, {
    token,
    expires: Date.now() + 3600000 // 1 hour
  })
  return token
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(sessionId: string, token: string): boolean {
  const entry = csrfTokens.get(sessionId)
  if (!entry) return false
  if (entry.expires < Date.now()) {
    csrfTokens.delete(sessionId)
    return false
  }
  if (entry.token !== token) return false
  return true
}

/**
 * Generate a secure random string
 */
export function generateSecureId(length: number = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash a value using SHA-256 (for logging sensitive data references)
 */
export async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Content Security Policy headers
 */
export const CSP_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://dafgzzkerytjuvxzymnq.supabase.co",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'"
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}
