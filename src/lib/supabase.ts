import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-supabase')
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
    return { ok: false, message: 'Supabase credentials not configured in .env.local' }
  }

  try {
    const { data, error } = await supabase.from('profiles').select('id').limit(1)
    if (error) {
      // If table doesn't exist yet, connection is still valid!
      if (error.code === '42P01') {
        return { ok: true, message: 'Connected to Supabase! (Database tables need to be created)' }
      }
      return { ok: false, message: error.message }
    }
    return { ok: true, message: 'Connected to Supabase successfully!' }
  } catch (err: any) {
    return { ok: false, message: err.message || 'Failed to connect to Supabase' }
  }
}

