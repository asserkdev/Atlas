/**
 * Theme system with dark/light mode and system preference detection
 */

export type Theme = 'light' | 'dark' | 'system'

interface ThemeColors {
  // Backgrounds
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  
  // Text
  textPrimary: string
  textSecondary: string
  textMuted: string
  textTertiary: string
  
  // Borders
  border: string
  borderSubtle: string
  
  // Accent
  accent: string
  accentHover: string
  
  // Status
  success: string
  warning: string
  error: string
  
  // Shadows
  shadow: string
  shadowLg: string
}

const lightColors: ThemeColors = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f8fafc',
  bgTertiary: '#f1f5f9',
  
  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  textTertiary: '#94a3b8',
  
  border: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  
  accent: '#6366f1',
  accentHover: '#4f46e5',
  
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  
  shadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
}

const darkColors: ThemeColors = {
  bgPrimary: '#0f172a',
  bgSecondary: '#1e293b',
  bgTertiary: '#334155',
  
  textPrimary: '#f8fafc',
  textSecondary: '#e2e8f0',
  textMuted: '#94a3b8',
  textTertiary: '#64748b',
  
  border: '#334155',
  borderSubtle: '#1e293b',
  
  accent: '#818cf8',
  accentHover: '#a5b4fc',
  
  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
  
  shadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
  shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
}

class ThemeManager {
  private currentTheme: Theme = 'system'
  private listeners: Set<(theme: 'light' | 'dark') => void> = new Set()
  private mediaQuery: MediaQueryList

  constructor() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    // Listen for system theme changes
    this.mediaQuery.addEventListener('change', () => {
      if (this.currentTheme === 'system') {
        this.applyTheme(this.getSystemTheme())
        this.notifyListeners()
      }
    })

    // Load saved preference
    this.loadPreference()
  }

  getTheme(): Theme {
    return this.currentTheme
  }

  getEffectiveTheme(): 'light' | 'dark' {
    if (this.currentTheme === 'system') {
      return this.getSystemTheme()
    }
    return this.currentTheme
  }

  getColors(): ThemeColors {
    const theme = this.getEffectiveTheme()
    return theme === 'dark' ? darkColors : lightColors
  }

  private getSystemTheme(): 'light' | 'dark' {
    return this.mediaQuery.matches ? 'dark' : 'light'
  }

  setTheme(theme: Theme): void {
    this.currentTheme = theme
    localStorage.setItem('theme', theme)
    
    const effectiveTheme = theme === 'system' ? this.getSystemTheme() : theme
    this.applyTheme(effectiveTheme)
    this.notifyListeners()
  }

  toggleTheme(): void {
    const current = this.getEffectiveTheme()
    const next = current === 'light' ? 'dark' : 'light'
    this.setTheme(next)
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    const root = document.documentElement
    const colors = theme === 'dark' ? darkColors : lightColors

    // Apply CSS variables
    root.style.setProperty('--color-bg-primary', colors.bgPrimary)
    root.style.setProperty('--color-bg-secondary', colors.bgSecondary)
    root.style.setProperty('--color-bg-tertiary', colors.bgTertiary)
    
    root.style.setProperty('--color-text-primary', colors.textPrimary)
    root.style.setProperty('--color-text-secondary', colors.textSecondary)
    root.style.setProperty('--color-text-muted', colors.textMuted)
    root.style.setProperty('--color-text-tertiary', colors.textTertiary)
    
    root.style.setProperty('--color-border', colors.border)
    root.style.setProperty('--color-border-subtle', colors.borderSubtle)
    
    root.style.setProperty('--color-accent', colors.accent)
    root.style.setProperty('--color-accent-hover', colors.accentHover)
    
    root.style.setProperty('--color-success', colors.success)
    root.style.setProperty('--color-warning', colors.warning)
    root.style.setProperty('--color-error', colors.error)
    
    root.style.setProperty('--shadow-sm', colors.shadow)
    root.style.setProperty('--shadow-lg', colors.shadowLg)

    // Apply data attribute for Tailwind-like selectors
    root.setAttribute('data-theme', theme)
    
    // Also set class for any class-based selectors
    root.classList.remove('light', 'dark')
    root.classList.add(theme)

    // Set meta theme-color for mobile browsers
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute('content', colors.bgPrimary)
    }
  }

  private loadPreference(): void {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      this.currentTheme = saved
    }
    
    const effectiveTheme = this.currentTheme === 'system' 
      ? this.getSystemTheme() 
      : this.currentTheme
    this.applyTheme(effectiveTheme)
  }

  subscribe(callback: (theme: 'light' | 'dark') => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notifyListeners(): void {
    const theme = this.getEffectiveTheme()
    this.listeners.forEach(cb => cb(theme))
  }
}

export const themeManager = new ThemeManager()

// Hook for React components
export function useTheme() {
  return {
    theme: themeManager.getTheme(),
    effectiveTheme: themeManager.getEffectiveTheme(),
    colors: themeManager.getColors(),
    setTheme: (theme: Theme) => themeManager.setTheme(theme),
    toggleTheme: () => themeManager.toggleTheme(),
    subscribe: (cb: (theme: 'light' | 'dark') => void) => themeManager.subscribe(cb)
  }
}
