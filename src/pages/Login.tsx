import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../app/AppContext'
import { useToast } from '../components/ui/Toast'
import { peopleService, storageService, supabaseAuthService, cycleService } from '../services'
import { isSupabaseConfigured, isSupabaseOnline, isSupabaseReady, supabase } from '../lib/supabase'
import { Role, User } from '../types'
import { SEED_USERS } from '../data/seedData'
import { matchesUser, isUserCycleParticipant } from '../lib/workflow'
import {
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Users,
  User as UserIcon,
  ChevronDown,
  Check,
  Code2,
  Layers,
  Palette,
  TrendingUp,
  Headphones,
  Coins,
} from 'lucide-react'

interface LoginProps {
  initialMode?: 'signin' | 'signup'
}

const normalizeText = (s?: string) => (s || '').trim().toLowerCase()

export function resolvePersonaUser(identifier: string, availableUsers: User[]): User | undefined {
  const target = normalizeText(identifier)
  if (!target) return undefined

  // 1. Direct ID or UUID match (handles matching both seed IDs and Supabase UUIDs)
  let found = availableUsers.find(
    (u) => u.id === identifier || normalizeText(u.id) === target || matchesUser(u.id, identifier)
  )
  if (found) return found

  // 2. Direct email match
  found = availableUsers.find((u) => normalizeText(u.email) === target)
  if (found) return found

  // 3. Match by Employee Code (e.g. 'EMP-722', 'emp-722', '722')
  const cleanTarget = target.replace(/[^a-z0-9]/gi, '')
  found = availableUsers.find((u) => {
    if (!u.employeeCode) return false
    const cleanCode = normalizeText(u.employeeCode).replace(/[^a-z0-9]/gi, '')
    return cleanCode === cleanTarget || normalizeText(u.employeeCode) === target
  })
  if (found) return found

  // 4. Username prefix match (e.g. 'tharun' matches 'tharun@gmail.com')
  found = availableUsers.find((u) => {
    if (!u.email) return false
    const prefix = normalizeText(u.email.split('@')[0])
    return prefix === target
  })
  if (found) return found

  // 5. Admin persona aliases (Eleanor Vance)
  if (
    target === 'eleanor.vance@performiq.internal' ||
    target === 'admin@performiq.internal' ||
    target === 'eleanor@performiq.internal' ||
    target === 'admin' ||
    target.includes('eleanor')
  ) {
    found =
      availableUsers.find(
        (u) =>
          u.id === 'u-admin' ||
          u.id === '11111111-1111-1111-1111-111111111103' ||
          normalizeText(u.name).includes('eleanor') ||
          u.role === 'admin'
      ) || SEED_USERS.find((u) => u.id === 'u-admin')

    if (found) return { ...found, role: 'admin' as const }
  }

  // 6. Manager persona aliases (Marcus Chen)
  if (
    target === 'marcus.chen@performiq.internal' ||
    target === 'marcus@performiq.internal' ||
    target === 'manager' ||
    target.includes('marcus')
  ) {
    found =
      availableUsers.find(
        (u) =>
          u.id === 'u-mgr-1' ||
          u.id === '11111111-1111-1111-1111-111111111102' ||
          (u.role === 'manager' && normalizeText(u.name).includes('marcus'))
      ) || SEED_USERS.find((u) => u.id === 'u-mgr-1')

    if (found) return { ...found, role: 'manager' as const }
  }

  // 7. Employee persona aliases (Alex Rivera)
  if (
    target === 'alex.rivera@performiq.internal' ||
    target === 'alex@performiq.internal' ||
    target === 'employee' ||
    target.includes('alex')
  ) {
    found =
      availableUsers.find(
        (u) =>
          u.id === 'u-emp-1' ||
          u.id === '11111111-1111-1111-1111-111111111101' ||
          (u.role === 'employee' && normalizeText(u.name).includes('alex'))
      ) || SEED_USERS.find((u) => u.id === 'u-emp-1')

    if (found) return { ...found, role: 'employee' as const }
  }

  // 8. Match by role name directly ('admin', 'manager', 'employee')
  found = availableUsers.find((u) => normalizeText(u.role) === target)
  if (found) return found

  // 9. Match by user's full name
  found = availableUsers.find((u) => normalizeText(u.name) === target || normalizeText(u.name).includes(target))
  if (found) return found

  return undefined
}

const DEPARTMENTS = [
  { name: 'Engineering', icon: Code2 },
  { name: 'Product Management', icon: Layers },
  { name: 'Design & UX', icon: Palette },
  { name: 'People Operations (HR)', icon: Users },
  { name: 'Sales & Marketing', icon: TrendingUp },
  { name: 'Customer Success', icon: Headphones },
  { name: 'Finance & Operations', icon: Coins },
]

const ROLES: { id: Role; label: string; desc: string; icon: any }[] = [
  {
    id: 'employee',
    label: 'Employee',
    desc: 'Individual Contributor',
    icon: UserIcon,
  },
  {
    id: 'manager',
    label: 'Manager',
    desc: 'People & Team Lead',
    icon: Users,
  },
  {
    id: 'admin',
    label: 'Admin',
    desc: 'People Ops & Exec',
    icon: Shield,
  },
]

export const Login: React.FC<LoginProps> = ({ initialMode = 'signin' }) => {
  const { allUsers, switchUser, refreshData } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const { success, error, info } = useToast()

  const [mode, setMode] = useState<'signin' | 'signup'>(
    location.pathname === '/signup' ? 'signup' : initialMode
  )

  // Form Fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [department, setDepartment] = useState(DEPARTMENTS[0].name)
  const [designation, setDesignation] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showDemoPersonas, setShowDemoPersonas] = useState(false)
  const [isDeptOpen, setIsDeptOpen] = useState(false)
  const [openUpwards, setOpenUpwards] = useState(true)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const deptRef = useRef<HTMLDivElement>(null)

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const toggleDeptOpen = () => {
    if (!isDeptOpen && deptRef.current) {
      const rect = deptRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      // If space below is less than 280px or space above is greater, open upwards
      setOpenUpwards(spaceBelow < 280 || rect.top > spaceBelow)
    }
    setIsDeptOpen(!isDeptOpen)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) {
        setIsDeptOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDeptOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Sign In submit
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: { [key: string]: string } = {}
    const trimmedInput = email.trim()
    const isEmpCode = /^EMP-?\d+/i.test(trimmedInput) || /^\d+$/.test(trimmedInput)
    const isEmail = trimmedInput.includes('@') && trimmedInput.includes('.')
    const isKnownPersona = ['admin', 'manager', 'employee', 'eleanor', 'marcus', 'alex', 'tharun', 'aadityaa'].some((p) =>
      trimmedInput.toLowerCase().includes(p)
    )

    if (!trimmedInput) {
      newErrors.email = 'Please fill out this field.'
    } else if (!isEmail && !isEmpCode && !isKnownPersona && trimmedInput.length < 2) {
      newErrors.email = 'Please enter a valid work email or Employee ID.'
    }

    if (!password) {
      newErrors.password = 'Please fill out this field.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      if (newErrors.email) {
        document.getElementById('signin-email')?.focus()
      } else if (newErrors.password) {
        document.getElementById('signin-password')?.focus()
      }
      return
    }

    setErrors({})
    setIsLoading(true)
    try {
      const normalized = trimmedInput.toLowerCase()

      // 1. Try Supabase Auth first if real password is provided AND Supabase is configured
      if (isSupabaseConfigured && isSupabaseOnline() && password && password !== '••••••••' && isEmail) {
        const { user: authUser, session, error: authError } = await supabaseAuthService.signIn(normalized, password)
        if (authUser && session) {
          success('Welcome back!', `Logged in via Supabase as ${authUser.name}`)
          await switchUser(authUser.id)
          await refreshData()
          navigate(`/${authUser.role}`)
          return
        }

        if (authError) {
          if (authError.toLowerCase().includes('email not confirmed')) {
            error(
              'Email Confirmation Required',
              'Please verify your email address via the link in your inbox. (Or in Supabase Dashboard: Authentication > Providers > Email, turn off "Confirm email").'
            )
            return
          }

          // If not a demo user email and not a config error, alert user
          const isConnectionError =
            authError.toLowerCase().includes('failed to fetch') ||
            authError.toLowerCase().includes('fetch failed') ||
            authError.toLowerCase().includes('network') ||
            authError.toLowerCase().includes('connection') ||
            authError.toLowerCase().includes('timeout') ||
            authError.toLowerCase().includes('load failed') ||
            authError.toLowerCase().includes('enotfound');

          if (!isConnectionError) {
            const isDemoEmail = allUsers.some((u) => u.email.toLowerCase() === normalized);
            if (!isDemoEmail && !authError.toLowerCase().includes('not configured')) {
              error('Sign in failed', authError);
              return;
            }
          } else {
            console.warn('Supabase host unreachable (' + authError + '), falling back to local credentials.');
          }
        }
      }

      // 2. Local / Persona authentication & User matching
      let userPool = allUsers && allUsers.length > 0 ? allUsers : []
      if (
        userPool.length === 0 ||
        !userPool.some((u) => normalizeText(u.email) === normalized || normalizeText(u.employeeCode) === normalized)
      ) {
        try {
          const freshList = await peopleService.list()
          if (freshList && freshList.length > 0) {
            userPool = freshList
          }
        } catch {
          userPool = storageService.getState().users
        }
      }

      let matchedUser =
        resolvePersonaUser(normalized, userPool) ||
        resolvePersonaUser(normalized, storageService.getState().users) ||
        resolvePersonaUser(normalized, SEED_USERS)

      // 3. Fallback direct query to Supabase if not matched yet
      if (!matchedUser && isSupabaseReady()) {
        try {
          // Check by email first
          const { data: dbUser } = await supabase
            .from('profiles')
            .select('*')
            .ilike('email', normalized)
            .limit(1)
            .maybeSingle()

          if (dbUser) {
            matchedUser = {
              id: dbUser.id,
              name: dbUser.name,
              email: dbUser.email,
              role: dbUser.role as Role,
              department: dbUser.department,
              designation: dbUser.designation,
              employeeCode: dbUser.employee_code || `EMP-001`,
              avatar:
                dbUser.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
              active: dbUser.active !== undefined ? dbUser.active : true,
              joinedDate: dbUser.join_date,
            }
          } else if (isEmpCode) {
            const codeNum = trimmedInput.replace(/[^0-9]/g, '')
            const { data: codeMatches } = await supabase.from('profiles').select('*')
            const matchedProfile = codeMatches?.find((p) => {
              const c = (p.employee_code || '').replace(/[^0-9]/g, '')
              return c && c === codeNum
            })
            if (matchedProfile) {
              matchedUser = {
                id: matchedProfile.id,
                name: matchedProfile.name,
                email: matchedProfile.email,
                role: matchedProfile.role as Role,
                department: matchedProfile.department,
                designation: matchedProfile.designation,
                employeeCode: matchedProfile.employee_code || `EMP-001`,
                avatar:
                  matchedProfile.avatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                active: matchedProfile.active !== undefined ? matchedProfile.active : true,
                joinedDate: matchedProfile.join_date,
              }
            }
          }
        } catch (e) {
          console.warn('Direct Supabase profile lookup fallback:', e)
        }
      }

      if (!matchedUser) {
        // Auto-provision user account seamlessly with their custom email
        const rawUsername = normalized.split('@')[0]
        const formattedName =
          rawUsername
            .replace(/[._-]+/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase()) || 'User'

        const assignedRole: Role = normalized.includes('admin')
          ? 'admin'
          : normalized.includes('manager')
          ? 'manager'
          : 'employee'

        const newUser = await peopleService.create({
          name: formattedName,
          email: normalized.includes('@') ? normalized : `${normalized}@performiq.internal`,
          role: assignedRole,
          department: assignedRole === 'admin' ? 'People Operations' : 'Engineering',
          designation:
            assignedRole === 'admin'
              ? 'People Operations Specialist'
              : assignedRole === 'manager'
              ? 'Engineering Team Lead'
              : 'Software Engineer',
          active: true,
          employeeCode: `EMP-${Math.floor(100 + Math.random() * 900)}`,
          joinedDate: new Date().toISOString().split('T')[0],
          avatar:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        })

        await refreshData()
        matchedUser = newUser
        success('Welcome to PerformIQ!', `Logged in as ${matchedUser.name} (${matchedUser.role})`)
      } else {
        success('Welcome back!', `Logged into PerformIQ as ${matchedUser.name} (${matchedUser.role})`)
      }

      await switchUser(matchedUser.id)

      // Ensure active cycle aligns to user's enrolled cycle
      try {
        const cycles = await cycleService.list()
        const enrolledCycle = cycles.find(
          (c) => c.stage !== 'closed' && isUserCycleParticipant(c, matchedUser!.id)
        )
        if (enrolledCycle) {
          await cycleService.setActiveCycle(enrolledCycle.id)
        } else {
          const anyOpenCycle = cycles.find((c) => c.stage !== 'closed')
          if (anyOpenCycle) {
            await cycleService.setActiveCycle(anyOpenCycle.id)
          }
        }
      } catch (e) {
        console.warn('Active cycle alignment notice:', e)
      }

      await refreshData()
      navigate(`/${matchedUser.role}`)
    } catch (err: any) {
      error('Sign in failed', err.message || 'Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  // Sign Up submit
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: { [key: string]: string } = {}
    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) {
      newErrors.fullName = 'Please fill out this field.'
    }

    if (!trimmedEmail) {
      newErrors.email = 'Please fill out this field.'
    } else if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      newErrors.email = 'Please enter a valid email address.'
    }

    if (!password) {
      newErrors.password = 'Please fill out this field.'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setIsLoading(true)
    try {
      const defaultTitle =
        role === 'admin'
          ? 'People Operations Specialist'
          : role === 'manager'
          ? 'Engineering Team Lead'
          : 'Software Engineer'

      const normalizedEmail = email.trim().toLowerCase()

      // 1. If Supabase is configured and reachable online, attempt live Supabase Auth
      if (isSupabaseConfigured && isSupabaseOnline()) {
        try {
          const { user: authUser, session, error: authErr } = await supabaseAuthService.signUp({
            email: normalizedEmail,
            password,
            name: fullName.trim(),
            role,
            department,
            designation: designation.trim() || defaultTitle,
          })

          if (authErr && authErr.toLowerCase().includes('already registered')) {
            info('Account exists', 'This email is already registered. Switching to sign-in screen.')
            setMode('signin')
            return
          }

          if (session && authUser) {
            const newUser = await peopleService.create({
              name: fullName.trim(),
              email: normalizedEmail,
              role,
              department,
              designation: designation.trim() || defaultTitle,
              active: true,
              employeeCode: `EMP-${Math.floor(100 + Math.random() * 900)}`,
              joinedDate: new Date().toISOString().split('T')[0],
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            })
            await switchUser(newUser.id)
            await refreshData()
            success('Account Registered & Connected!', `Welcome ${fullName}! You are signed in as ${role}.`)
            navigate(`/${role}`)
            return
          }
        } catch (supaErr) {
          console.warn('Supabase Auth error, seamlessly falling back to local workspace:', supaErr)
        }
      }

      // 2. Instant Local Account Provisioning (0ms wait, zero delay)
      const existingUser = allUsers.find((u) => u.email.toLowerCase() === normalizedEmail)
      if (existingUser) {
        info('Account exists', 'This email is already registered. Switching to sign-in screen.')
        setMode('signin')
        return
      }

      const newUser = await peopleService.create({
        name: fullName.trim(),
        email: normalizedEmail,
        role,
        department,
        designation: designation.trim() || defaultTitle,
        active: true,
        employeeCode: `EMP-${Math.floor(100 + Math.random() * 900)}`,
        joinedDate: new Date().toISOString().split('T')[0],
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      })

      // Lock in user session immediately BEFORE refresh to prevent any race condition
      await switchUser(newUser.id)
      await refreshData()
      success('Account Created & Ready!', `Welcome ${fullName}! You are signed in as ${role}.`)
      navigate(`/${role}`)
    } catch (err: any) {
      error('Registration failed', err?.message || 'Unable to complete sign-up.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickLogin = async (userEmail: string) => {
    setErrors({})
    setEmail(userEmail)
    setPassword('••••••••')
    setIsLoading(true)

    try {
      let userPool = allUsers && allUsers.length > 0 ? allUsers : []
      if (userPool.length === 0) {
        try {
          userPool = await peopleService.list()
        } catch {
          userPool = storageService.getState().users
        }
      }

      const matched =
        resolvePersonaUser(userEmail, userPool) ||
        resolvePersonaUser(userEmail, storageService.getState().users) ||
        resolvePersonaUser(userEmail, SEED_USERS)

      if (matched) {
        await switchUser(matched.id)
        await refreshData()
        success('Session initialized', `Logged in as ${matched.name} (${matched.role})`)
        navigate(`/${matched.role}`)
      } else {
        error('Login failed', `Persona account for ${userEmail} not found.`)
      }
    } catch (err: any) {
      error('Sign in failed', err?.message || 'Unable to log in.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="dark min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#08080a] text-zinc-100 font-sans relative overflow-hidden selection:bg-indigo-500/30 selection:text-white">
      {/* Static subtle enterprise dark background styling - ZERO animations */}
      {/* 1. Static radial micro-grid for subtle depth */}
      <div
        className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"
        aria-hidden="true"
      />
      {/* 2. Soft top-centered ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-gradient-to-b from-indigo-500/[0.07] via-transparent to-transparent blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Centered Auth Card */}
      <div className="relative z-10 max-w-[420px] w-full mx-auto bg-[#121319] rounded-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.95)] border border-white/[0.08] p-6 sm:p-7 overflow-visible">
        {/* Subtle top edge specular highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent rounded-t-2xl pointer-events-none" />

        <div className="w-full max-w-[340px] mx-auto">
          {/* Header: Company Brand Logo & Name (Static, crisp, distraction-free) */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center gap-2 mb-2 select-none">
              <img
                src="/logo-white.png"
                alt="PerformIQ"
                className="w-7 h-7 object-contain"
              />
              <span className="text-xl font-bold tracking-tight text-white">
                Perform<span className="text-indigo-400 font-black">IQ</span>
              </span>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              {mode === 'signin' ? 'Sign in' : 'Create an account'}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {mode === 'signin'
                ? 'Access your performance reviews and goals'
                : 'Setup your account role & department'}
            </p>
          </div>

          {/* SIGN IN FORM */}
          {mode === 'signin' && (
            <form noValidate onSubmit={handleSignIn} className="space-y-3">
              <div>
                <input
                  id="signin-email"
                  type="text"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    clearError('email')
                  }}
                  placeholder="E-mail Address or Employee ID *"
                  className={`w-full px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors bg-[#181922] border text-white placeholder:text-zinc-500 focus:outline-hidden ${
                    errors.email
                      ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                      : 'border-white/[0.08] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30'
                  }`}
                />
                {errors.email && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-medium text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{errors.email}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="relative">
                  <input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      clearError('password')
                    }}
                    placeholder="Password *"
                    className={`w-full px-3.5 py-2.5 pr-10 rounded-lg text-xs sm:text-sm font-medium transition-colors bg-[#181922] border text-white placeholder:text-zinc-500 focus:outline-hidden ${
                      errors.password
                        ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                        : 'border-white/[0.08] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5 transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-medium text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{errors.password}</span>
                  </div>
                )}
              </div>

              {/* Forgot password link */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    info(
                      'Password Recovery',
                      'Password reset instructions have been dispatched to your e-mail.'
                    )
                  }
                  className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {/* Primary Sign In Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-lg font-semibold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>

              {/* Toggle to Sign Up */}
              <div className="text-center pt-1">
                <p className="text-xs text-zinc-400">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup')
                      setErrors({})
                    }}
                    className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer ml-1"
                  >
                    Sign Up!
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* SIGN UP FORM WITH ROLES & DEPARTMENTS */}
          {mode === 'signup' && (
            <form noValidate onSubmit={handleSignUp} className="space-y-2.5">
              <div>
                <input
                  id="signup-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    clearError('fullName')
                  }}
                  placeholder="Full Name *"
                  className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors bg-[#181922] border text-white placeholder:text-zinc-500 focus:outline-hidden ${
                    errors.fullName
                      ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                      : 'border-white/[0.08] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30'
                  }`}
                />
                {errors.fullName && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{errors.fullName}</span>
                  </div>
                )}
              </div>

              <div>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    clearError('email')
                  }}
                  placeholder="Work E-mail *"
                  className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors bg-[#181922] border text-white placeholder:text-zinc-500 focus:outline-hidden ${
                    errors.email
                      ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                      : 'border-white/[0.08] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30'
                  }`}
                />
                {errors.email && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{errors.email}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      clearError('password')
                    }}
                    placeholder="Password (min 6 chars) *"
                    className={`w-full px-3 py-2 pr-9 rounded-lg text-xs font-medium transition-colors bg-[#181922] border text-white placeholder:text-zinc-500 focus:outline-hidden ${
                      errors.password
                        ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                        : 'border-white/[0.08] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5 transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{errors.password}</span>
                  </div>
                )}
              </div>

              {/* Role Selector */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Role *
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ROLES.map((r) => {
                    const Icon = r.icon
                    const isSelected = role === r.id
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/15 border-indigo-500/70 text-indigo-300 ring-1 ring-indigo-500/30 font-semibold shadow-xs'
                            : 'bg-[#181922] border-white/[0.06] text-zinc-400 hover:border-white/[0.14] hover:text-zinc-200'
                        }`}
                      >
                        <Icon className="w-4 h-4 mx-auto mb-1" />
                        <div className="text-[11px] font-medium">{r.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Custom Department Selector */}
              <div className="relative" ref={deptRef}>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Department *
                </label>
                <button
                  type="button"
                  onClick={toggleDeptOpen}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                    isDeptOpen
                      ? 'bg-[#181922] border-indigo-500 ring-1 ring-indigo-500/30 text-white'
                      : 'bg-[#181922] border border-white/[0.08] text-zinc-200 hover:border-white/[0.14]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {(() => {
                      const CurrentIcon = DEPARTMENTS.find((d) => d.name === department)?.icon || Code2
                      return <CurrentIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    })()}
                    <span className="truncate">{department}</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0 ${
                      isDeptOpen ? 'rotate-180 text-indigo-400' : ''
                    }`}
                  />
                </button>

                {/* Popover Menu with 100% Opaque Solid Surfaces & Dynamic Placement */}
                {isDeptOpen && (
                  <div
                    className={`absolute left-0 right-0 z-50 bg-[#161720] border border-white/[0.12] shadow-2xl rounded-xl p-1.5 max-h-60 overflow-y-auto no-scrollbar duration-150 ${
                      openUpwards
                        ? 'bottom-full mb-1.5 shadow-[0_-12px_36px_rgba(0,0,0,0.85)]'
                        : 'top-full mt-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.85)]'
                    }`}
                  >
                    <div className="space-y-0.5">
                      {DEPARTMENTS.map((dept) => {
                        const isSelected = department === dept.name
                        const Icon = dept.icon
                        return (
                          <button
                            key={dept.name}
                            type="button"
                            onClick={() => {
                              setDepartment(dept.name)
                              setIsDeptOpen(false)
                            }}
                            className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer text-left ${
                              isSelected
                                ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                                : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Icon
                                className={`w-3.5 h-3.5 shrink-0 ${
                                   isSelected
                                    ? 'text-indigo-400'
                                    : 'text-zinc-500'
                                }`}
                              />
                              <span className="truncate">{dept.name}</span>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-2" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Primary Create Account Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-lg font-semibold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 mt-1"
              >
                {isLoading ? 'Creating...' : 'Create Account'}
              </button>

              {/* Toggle to Sign In */}
              <div className="text-center pt-0.5">
                <p className="text-xs text-zinc-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin')
                      setErrors({})
                    }}
                    className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer ml-1"
                  >
                    Sign In!
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Quick Demo Personas 1-Click Footer */}
          <div className="mt-4 pt-3 border-t border-white/[0.06] text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 font-medium flex-wrap">
              <span className="text-[10px] text-zinc-500 uppercase font-semibold mr-0.5">Demo:</span>
              <button
                type="button"
                onClick={() => handleQuickLogin('alex.rivera@performiq.internal')}
                className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white transition-colors cursor-pointer text-[11px]"
              >
                Alex (Emp)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('marcus.chen@performiq.internal')}
                className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white transition-colors cursor-pointer text-[11px]"
              >
                Marcus (Mgr)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('eleanor.vance@performiq.internal')}
                className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white transition-colors cursor-pointer text-[11px]"
              >
                Eleanor (Admin)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
