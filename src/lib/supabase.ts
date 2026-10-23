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

/**
 * EXPLICIT BACKEND INTEGRATION TOGGLE:
 * By default, backend integration is paused and the application runs 100% in local frontend-only mode.
 * Set VITE_ENABLE_BACKEND=true in .env.local ONLY when you explicitly request to reconnect to Supabase.
 */
export const isBackendEnabled = Boolean(
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.VITE_ENABLE_BACKEND === 'true'
)

export const isSupabaseConfigured = Boolean(
  isBackendEnabled &&
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-supabase') &&
  !supabaseUrl.includes('placeholder')
)

if (!isSupabaseConfigured) {
  console.info(
    '[PerformIQ] Running in local frontend-only presentation mode. Backend integration is paused with zero Supabase requests.'
  )
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    },
  }
)

/**
 * Ping Supabase to test connectivity and credentials
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      message: 'Backend integration is currently paused (running in local frontend-only mode). Set VITE_ENABLE_BACKEND=true to activate.',
    }
  }

  try {
    const { error } = await supabase.from('profiles').select('id').limit(1)
    if (error) {
      if (error.code === '42P01') {
        return { ok: true, message: 'Connected to Supabase! (Database tables need to be created with schema_combined.sql)' }
      }
      return { ok: false, message: error.message }
    }
    return { ok: true, message: 'Connected to Supabase successfully!' }
  } catch (err: any) {
    return { ok: false, message: err.message || 'Failed to connect to Supabase' }
  }
}
