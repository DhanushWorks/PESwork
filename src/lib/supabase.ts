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
  }
)

/**
 * Ping Supabase to test connectivity and credentials
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Supabase credentials not configured in .env.local or environment' }
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
