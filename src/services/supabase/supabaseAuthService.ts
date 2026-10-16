import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { User, Role } from '../../types'

export interface SignUpParams {
  email: string
  password: string
  name: string
  role: Role
  department: string
  designation: string
}

export const supabaseAuthService = {
  /**
   * Register a new user with Supabase Auth
   */
  async signUp(params: SignUpParams): Promise<{ user: User | null; session: any; error?: string }> {
    if (!isSupabaseConfigured) {
      return { user: null, session: null, error: 'Supabase is not configured' }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            name: params.name,
            full_name: params.name,
            role: params.role,
            department: params.department,
            designation: params.designation,
          },
        },
      })

      if (error) {
        return { user: null, session: null, error: error.message }
      }

      if (!data.user) {
        return { user: null, session: null, error: 'User registration failed.' }
      }

      const userProfile: User = {
        id: data.user.id,
        name: params.name,
        email: params.email,
        role: params.role,
        department: params.department,
        designation: params.designation,
        active: true,
        employeeCode: `EMP-${Math.floor(100 + Math.random() * 900)}`,
        joinedDate: new Date().toISOString().split('T')[0],
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      }

      return { user: userProfile, session: data.session }
    } catch (err: any) {
      return { user: null, session: null, error: err.message || 'Registration failed' }
    }
  },

  /**
   * Sign in with Supabase Auth email/password
   */
  async signIn(email: string, password: string): Promise<{ user: User | null; session: any; error?: string }> {
    if (!isSupabaseConfigured) {
      return { user: null, session: null, error: 'Supabase is not configured' }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { user: null, session: null, error: error.message }
      }

      if (!data.user) {
        return { user: null, session: null, error: 'User not found' }
      }

      // Fetch user profile from public.profiles
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileErr || !profile) {
        const meta = data.user.user_metadata || {}
        const user: User = {
          id: data.user.id,
          name: meta.name || meta.full_name || email.split('@')[0],
          email: data.user.email || email,
          role: (meta.role as Role) || 'employee',
          department: meta.department || 'Engineering',
          designation: meta.designation || 'Specialist',
          employeeCode: meta.employeeCode || `EMP-${Math.floor(100 + Math.random() * 900)}`,
          active: true,
          joinedDate: new Date().toISOString().split('T')[0],
          avatar: meta.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        }
        return { user, session: data.session }
      }

      const user: User = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role as Role,
        department: profile.department,
        designation: profile.designation,
        managerId: profile.manager_id,
        employeeCode: profile.employee_code || `EMP-${Math.floor(100 + Math.random() * 900)}`,
        avatar: profile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        active: profile.active,
        joinedDate: profile.join_date,
      }

      return { user, session: data.session }
    } catch (err: any) {
      return { user: null, session: null, error: err.message || 'Authentication failed' }
    }
  },

  /**
   * Get current session and user profile
   */
  async getSession(): Promise<{ session: any; user: User | null }> {
    if (!isSupabaseConfigured) return { session: null, user: null }
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session?.user) return { session: null, user: null }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile) {
        return {
          session,
          user: {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role as Role,
            department: profile.department,
            designation: profile.designation,
            managerId: profile.manager_id,
            employeeCode: profile.employee_code || `EMP-${Math.floor(100 + Math.random() * 900)}`,
            avatar: profile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            active: profile.active,
            joinedDate: profile.join_date,
          },
        }
      }

      const meta = session.user.user_metadata || {}
      return {
        session,
        user: {
          id: session.user.id,
          name: meta.name || meta.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: (meta.role as Role) || 'employee',
          department: meta.department || 'Engineering',
          designation: meta.designation || 'Specialist',
          employeeCode: meta.employeeCode || `EMP-${Math.floor(100 + Math.random() * 900)}`,
          active: true,
          joinedDate: new Date().toISOString().split('T')[0],
          avatar: meta.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        },
      }
    } catch {
      return { session: null, user: null }
    }
  },

  /**
   * Sign out current session
   */
  async signOut(): Promise<void> {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    }
  },

  /**
   * Listen to auth state transitions
   */
  onAuthStateChange(callback: (session: any, user: User | null) => void) {
    if (!isSupabaseConfigured) {
      return { unsubscribe: () => {} }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        callback(null, null)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile) {
        const user: User = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as Role,
          department: profile.department,
          designation: profile.designation,
          managerId: profile.manager_id,
          employeeCode: profile.employee_code || `EMP-${Math.floor(100 + Math.random() * 900)}`,
          avatar: profile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          active: profile.active,
          joinedDate: profile.join_date,
        }
        callback(session, user)
      } else {
        const meta = session.user.user_metadata || {}
        const user: User = {
          id: session.user.id,
          name: meta.name || meta.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: (meta.role as Role) || 'employee',
          department: meta.department || 'Engineering',
          designation: meta.designation || 'Specialist',
          employeeCode: meta.employeeCode || `EMP-${Math.floor(100 + Math.random() * 900)}`,
          active: true,
          joinedDate: new Date().toISOString().split('T')[0],
          avatar: meta.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        }
        callback(session, user)
      }
    })

    return subscription
  },
}

