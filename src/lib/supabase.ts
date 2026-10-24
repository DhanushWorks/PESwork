import { createClient } from '@supabase/supabase-js'

function getEnv(key: string): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key]
    }
    if (typeof window !== 'undefined') {
      const win = window as any
      if (win.__ENV__ && win.__ENV__[key]) return win.__ENV__[key]
      const localVal =
        localStorage.getItem(key) ||
        localStorage.getItem(key.toLowerCase()) ||
        localStorage.getItem(`performiq_${key.toLowerCase()}`)
      if (localVal) return localVal
    }
  } catch {}
  return ''
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY')

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-supabase') &&
  !supabaseUrl.includes('placeholder')
)

// Circuit-breaker & health status tracking to prevent UI freezes
let supabaseReachable = (() => {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('performiq_supabase_offline')
      if (stored === 'true') return false
    }
  } catch {}
  return true
})()

export function isSupabaseOnline(): boolean {
  if (!isSupabaseConfigured) return false
  return supabaseReachable
}

export function markSupabaseOffline(err?: any) {
  if (supabaseReachable) {
    console.warn(
      '[PerformIQ] Supabase network endpoint is unreachable; fast-falling back to local mock storage.',
      err?.message || err
    )
  }
  supabaseReachable = false
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('performiq_supabase_offline', 'true')
    }
  } catch {}
}

export function markSupabaseOnline() {
  supabaseReachable = true
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('performiq_supabase_offline')
    }
  } catch {}
}

export function isSupabaseReady(): boolean {
  return isSupabaseConfigured && isSupabaseOnline()
}

// Resilient fetch wrapper with 1.2s timeout to eliminate infinite hangs
const resilientFetch: typeof fetch = async (input, init) => {
  if (!isSupabaseOnline()) {
    throw new Error('Supabase is currently offline or unreachable')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 1200)

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })
    markSupabaseOnline()
    return response
  } catch (err: any) {
    markSupabaseOffline(err)
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

// Fast preflight probe on startup (600ms) to detect if Supabase host is alive without waiting for user action
if (isSupabaseConfigured && typeof window !== 'undefined' && supabaseReachable) {
  const probeController = new AbortController()
  const probeTimeout = setTimeout(() => probeController.abort(), 600)
  fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'HEAD',
    signal: probeController.signal,
    headers: { apikey: supabaseAnonKey || '' },
  })
    .then((res) => {
      clearTimeout(probeTimeout)
      if (res.ok || res.status < 500) {
        markSupabaseOnline()
      } else {
        markSupabaseOffline(new Error(`HTTP ${res.status}`))
      }
    })
    .catch((err) => {
      clearTimeout(probeTimeout)
      markSupabaseOffline(err)
    })
}

if (!isSupabaseConfigured) {
  console.warn(
    '[PerformIQ] Supabase environment variables are missing or default. Running with local mock fallback.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: resilientFetch,
    },
  }
)

/**
 * Ping Supabase to test connectivity and credentials
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Supabase credentials not configured in .env.local or environment' }
  }

  // Force reset offline flag for explicit ping attempt
  markSupabaseOnline()

  try {
    const { error } = await supabase.from('profiles').select('id').limit(1)
    if (error) {
      if (error.code === '42P01') {
        markSupabaseOnline()
        return { ok: true, message: 'Connected to Supabase! (Database tables need to be created with schema_combined.sql)' }
      }
      return { ok: false, message: error.message }
    }
    markSupabaseOnline()
    return { ok: true, message: 'Connected to Supabase successfully!' }
  } catch (err: any) {
    markSupabaseOffline(err)
    return { ok: false, message: err.message || 'Failed to connect to Supabase' }
  }
}
