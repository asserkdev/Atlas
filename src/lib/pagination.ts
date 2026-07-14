/**
 * Pagination utilities for large data sets
 */

export interface PaginationOptions {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/**
 * Create pagination metadata
 */
export function createPagination(
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<any> {
  const totalPages = Math.ceil(total / pageSize)
  
  return {
    data: [], // Data filled by caller
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  }
}

/**
 * Get pagination range for display
 */
export function getPaginationRange(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): (number | '...')[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = []
  const halfVisible = Math.floor(maxVisible / 2)
  
  let startPage = Math.max(1, currentPage - halfVisible)
  let endPage = Math.min(totalPages, currentPage + halfVisible)
  
  // Adjust if at edges
  if (currentPage <= halfVisible) {
    endPage = maxVisible
  } else if (currentPage >= totalPages - halfVisible) {
    startPage = totalPages - maxVisible + 1
  }

  // Always show first page
  if (startPage > 1) {
    pages.push(1)
    if (startPage > 2) {
      pages.push('...')
    }
  }

  // Middle pages
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }

  // Always show last page
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pages.push('...')
    }
    pages.push(totalPages)
  }

  return pages
}

/**
 * Calculate offset for SQL/Supabase
 */
export function getOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize
}

// ==========================================
// Virtual Scrolling
// ==========================================

export interface VirtualItem {
  index: number
  start: number
  end: number
  size: number
}

export interface VirtualizerOptions {
  count: number
  getScrollElement: () => HTMLElement | null
  estimateSize: number
  overscan?: number
}

export class Virtualizer {
  private items: VirtualItem[] = []
  private scrollTop = 0
  private containerHeight = 0
  private options: Required<VirtualizerOptions>

  constructor(options: VirtualizerOptions) {
    this.options = {
      overscan: 3,
      ...options
    }
    this.calculate()
  }

  /**
   * Update options and recalculate
   */
  update(options: Partial<VirtualizerOptions>): void {
    this.options = { ...this.options, ...options }
    this.calculate()
  }

  /**
   * Handle scroll event
   */
  onScroll(scrollTop: number, containerHeight: number): void {
    this.scrollTop = scrollTop
    this.containerHeight = containerHeight
    this.calculate()
  }

  /**
   * Get visible items
   */
  getVirtualItems(): VirtualItem[] {
    return this.items
  }

  /**
   * Get total height (for scroll container)
   */
  getTotalSize(): number {
    return this.options.count * this.options.estimateSize
  }

  /**
   * Calculate visible items
   */
  private calculate(): void {
    const { count, estimateSize, overscan } = this.options
    
    this.items = []
    
    if (count === 0) return

    const startIndex = Math.floor(this.scrollTop / estimateSize)
    const visibleCount = Math.ceil(this.containerHeight / estimateSize)
    
    const start = Math.max(0, startIndex - overscan)
    const end = Math.min(count, startIndex + visibleCount + overscan)

    let offset = start * estimateSize

    for (let i = start; i < end; i++) {
      this.items.push({
        index: i,
        start: offset,
        end: offset + estimateSize,
        size: estimateSize
      })
      offset += estimateSize
    }
  }

  /**
   * Scroll to index
   */
  scrollToIndex(index: number, scrollElement: HTMLElement): void {
    const offset = index * this.options.estimateSize
    scrollElement.scrollTop = offset
  }
}

/**
 * Create a virtualizer instance
 */
export function createVirtualizer(options: VirtualizerOptions): Virtualizer {
  return new Virtualizer(options)
}

// ==========================================
// Infinite Scroll Hook Helper
// ==========================================

export interface InfiniteScrollState<T> {
  items: T[]
  isLoading: boolean
  hasMore: boolean
  error: Error | null
  loadMore: () => Promise<void>
  reset: () => void
}

export async function createInfiniteScrollHelper<T>(
  initialItems: T[] = [],
  pageSize: number = 20,
  fetchFn: (offset: number, limit: number) => Promise<{ items: T[]; hasMore: boolean }>
): Promise<InfiniteScrollState<T>> {
  let items = [...initialItems]
  let isLoading = false
  let hasMore = true
  let error: Error | null = null
  let offset = initialItems.length

  const loadMore = async () => {
    if (isLoading || !hasMore) return

    isLoading = true
    error = null

    try {
      const result = await fetchFn(offset, pageSize)
      items = [...items, ...result.items]
      hasMore = result.hasMore
      offset += result.items.length
    } catch (e) {
      error = e as Error
    } finally {
      isLoading = false
    }
  }

  const reset = () => {
    items = [...initialItems]
    offset = initialItems.length
    hasMore = true
    error = null
  }

  return {
    get items() { return items },
    get isLoading() { return isLoading },
    get hasMore() { return hasMore },
    get error() { return error },
    loadMore,
    reset
  }
}
