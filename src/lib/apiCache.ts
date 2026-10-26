/**
 * High-performance In-Memory API Request Cache & Deduplication Layer
 * Eliminates redundant Supabase network calls, duplicate in-flight requests,
 * and page navigation latency across all roles and workspaces.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

const memoryCache = new Map<string, CacheEntry<any>>()
const inFlightRequests = new Map<string, Promise<any>>()

export const apiCache = {
  /**
   * Retrieves data from cache or executes fetcher with automatic request deduplication
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 45000
  ): Promise<T> {
    const now = Date.now()
    const cached = memoryCache.get(key)

    // Return fresh cached data immediately (0ms latency)
    if (cached && now - cached.timestamp < cached.ttl) {
      return cached.data as T
    }

    // Merge duplicate in-flight network requests
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key) as Promise<T>
    }

    const promise = (async () => {
      try {
        const result = await fetcher()
        memoryCache.set(key, {
          data: result,
          timestamp: Date.now(),
          ttl: ttlMs,
        })
        return result
      } finally {
        inFlightRequests.delete(key)
      }
    })()

    inFlightRequests.set(key, promise)
    return promise
  },

  /**
   * Synchronously peek at existing cached data to avoid flashing loading spinners
   */
  peek<T>(key: string): T | null {
    const cached = memoryCache.get(key)
    if (!cached) return null
    return cached.data as T
  },

  /**
   * Set or update cached data directly
   */
  set<T>(key: string, data: T, ttlMs: number = 45000): void {
    memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    })
  },

  /**
   * Invalidate specific cache keys or all keys matching a prefix/regex
   */
  invalidate(pattern?: string | RegExp): void {
    if (!pattern) {
      memoryCache.clear()
      inFlightRequests.clear()
      return
    }

    const keys = Array.from(memoryCache.keys())
    for (const key of keys) {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          memoryCache.delete(key)
          inFlightRequests.delete(key)
        }
      } else if (pattern.test(key)) {
        memoryCache.delete(key)
        inFlightRequests.delete(key)
      }
    }
  },
}

