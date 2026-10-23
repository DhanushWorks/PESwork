import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../app/AppContext'
import { useToast } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/Modal'
import { peopleService } from '../services'
import { formatDate } from '../lib/formatters'
import {
  User,
  RotateCcw,
  Calendar,
  Sparkles,
  Bell,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase'

export const Settings: React.FC = () => {
  const {
    currentUser,
    activeCycle,
    dataMode,
    resetCleanWorkflow,
    revertToFullDemoData,
    refreshData,
  } = useApp()
  const { success, error } = useToast()

  // Profile Edit State
  const [name, setName] = useState(currentUser.name)
  const [designation, setDesignation] = useState(currentUser.designation)
  const [department, setDepartment] = useState(currentUser.department)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Notification Preferences State (Mock Settings)
  const [emailDigest, setEmailDigest] = useState(true)
  const [inAppAlerts, setInAppAlerts] = useState(true)
  const [milestoneReminders, setMilestoneReminders] = useState(true)

  // Reset Confirmation State
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [dialogType, setDialogType] = useState<'clean' | 'full'>('clean')

  // Supabase Connection State
  const [supabaseStatus, setSupabaseStatus] = useState<{
    tested: boolean
    ok: boolean
    message: string
  }>({
    tested: false,
    ok: isSupabaseConfigured,
    message: isSupabaseConfigured
      ? 'Supabase credentials detected'
      : 'Using local storage & mock data fallback',
  })
  const [isTestingSupabase, setIsTestingSupabase] = useState(false)
  const [showConfigInputs, setShowConfigInputs] = useState(false)
  const [customUrl, setCustomUrl] = useState(() => localStorage.getItem('performiq_vite_supabase_url') || '')
  const [customKey, setCustomKey] = useState(() => localStorage.getItem('performiq_vite_supabase_anon_key') || '')

  const handleTestConnection = async () => {
    setIsTestingSupabase(true)
    try {
      const result = await testSupabaseConnection()
      setSupabaseStatus({ tested: true, ok: result.ok, message: result.message })
      if (result.ok) {
        success('Supabase Connected', result.message)
      } else {
        error('Connection Check', result.message)
      }
    } catch (err: any) {
      setSupabaseStatus({ tested: true, ok: false, message: err?.message || 'Connection failed' })
      error('Connection Error', err?.message || 'Failed to ping Supabase')
    } finally {
      setIsTestingSupabase(false)
    }
  }

  const handleSaveBrowserCredentials = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customUrl.trim() || !customKey.trim()) {
      error('Credentials Required', 'Please provide both the Project URL and anon public key.')
      return
    }
    localStorage.setItem('performiq_vite_supabase_url', customUrl.trim())
    localStorage.setItem('performiq_vite_supabase_anon_key', customKey.trim())
    success('Credentials Saved', 'Reloading workspace to connect to Supabase...')
    setTimeout(() => {
      window.location.reload()
    }, 700)
  }

  const handleClearBrowserCredentials = () => {
    localStorage.removeItem('performiq_vite_supabase_url')
    localStorage.removeItem('performiq_vite_supabase_anon_key')
    setCustomUrl('')
    setCustomKey('')
    success('Credentials Cleared', 'Reloading in mock fallback mode...')
    setTimeout(() => {
      window.location.reload()
    }, 700)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      error('Name required', 'Please provide a valid full name.')
      return
    }

    setIsSavingProfile(true)
    try {
      await peopleService.update(currentUser.id, {
        name: name.trim(),
        designation: designation.trim(),
        department: department.trim(),
      })
      await refreshData()
      success('Profile updated', 'Your display details were saved across the system.')
    } catch (err: any) {
      error('Update failed', err.message || 'Could not update profile.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleResetCleanWorkflow = async () => {
    setIsResetting(true)
    try {
      await resetCleanWorkflow()
      success('Workflow Reset', 'Workspace reset to 1 Admin, 1 Manager, 1 Employee with 0 records.')
      setShowResetDialog(false)
    } catch (err: any) {
      error('Reset failed', err.message || 'Could not reset workflow.')
    } finally {
      setIsResetting(false)
    }
  }

  const handleRevertToFullData = async () => {
    setIsResetting(true)
    try {
      await revertToFullDemoData()
      success('Full Dataset Restored', 'All 13 users, review cycles, and historical records restored.')
      setShowResetDialog(false)
    } catch (err: any) {
      error('Revert failed', err.message || 'Could not restore full dataset.')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* Clean Dashboard Standard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Workspace Settings
          </h1>
        </div>
      </div>

      {/* 1. PERSONAL IDENTITY & PROFILE */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
          <User className="w-4 h-4 text-[#8B7CFF]" />
          <h2 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-sans">
            Personal Identity & Active Account
          </h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08]">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-200 dark:ring-white/10 shadow-sm"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-900 dark:text-[#F0F3FA]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 font-sans border border-slate-300 dark:border-white/10">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-300 font-sans">{currentUser.email}</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-300/70 font-sans">
                Member of {currentUser.department} department · Managed by {currentUser.managerId || 'Director'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-[#C5CEE0] block mb-1.5 font-sans">
                Full Display Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#8B7CFF] bg-white dark:bg-[#18181b] text-slate-900 dark:text-[#F0F3FA]"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-[#C5CEE0] block mb-1.5 font-sans">
                Designation / Job Title *
              </label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#8B7CFF] bg-white dark:bg-[#18181b] text-slate-900 dark:text-[#F0F3FA]"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-[#C5CEE0] block mb-1.5 font-sans">
                Department *
              </label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#8B7CFF] bg-white dark:bg-[#18181b] text-slate-900 dark:text-[#F0F3FA]"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-[#C5CEE0] block mb-1.5 font-sans">
                Email Address (Read-only)
              </label>
              <input
                type="text"
                disabled
                value={currentUser.email}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.02] text-slate-500 dark:text-zinc-300 cursor-not-allowed font-sans"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="premium-glow-btn h-10 px-5 text-xs font-semibold cursor-pointer inline-flex items-center gap-2"
            >
              {isSavingProfile ? 'Saving Changes...' : 'Save Profile Details'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. PERFORMANCE GOVERNANCE & ACTIVE CYCLE */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#8B7CFF]" />
            <h2 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-sans">
              Appraisal Governance & Active Cycle
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#8B7CFF]/10 text-[#8B7CFF] border border-[#8B7CFF]/30 font-sans">
            {activeCycle.stage.toUpperCase()}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="font-bold text-sm text-slate-900 dark:text-[#F0F3FA]">
              {activeCycle.name}
            </span>
            <span className="text-xs font-sans text-slate-500 dark:text-zinc-300">
              {formatDate(activeCycle.startDate)} — {formatDate(activeCycle.endDate)}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            All employee goals, manager evaluations, and calibration metrics in this session belong to this review cycle.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Link
            to="/admin/cycles"
            className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-white/[0.02] hover:bg-white/[0.04] flex items-center justify-between transition-colors text-xs font-semibold text-slate-800 dark:text-[#F0F3FA]"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#8B7CFF]" />
              <span>Manage Review Cycles</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 dark:text-zinc-300" />
          </Link>

          <Link
            to="/admin/audit"
            className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-white/[0.02] hover:bg-white/[0.04] flex items-center justify-between transition-colors text-xs font-semibold text-slate-800 dark:text-[#F0F3FA]"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-[#4FE3C1]" />
              <span>View System Audit Trail</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 dark:text-zinc-300" />
          </Link>
        </div>
      </div>

      {/* 3. SUPABASE CLOUD DATABASE CONNECTION */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 shadow-sm space-y-5 border border-slate-200 dark:border-white/[0.08]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#8B7CFF]" />
            <h2 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-sans">
              Supabase Cloud Database & API
            </h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              isSupabaseConfigured
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}
          >
            {isSupabaseConfigured ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Live Supabase Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Demo Fallback Mode</span>
              </>
            )}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-[#F0F3FA]">
                {isSupabaseConfigured
                  ? 'Connected to Supabase PostgreSQL'
                  : 'Supabase credentials not configured'}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-300 font-sans mt-0.5">
                {supabaseStatus.message}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingSupabase}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-800 dark:text-zinc-200 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors font-sans"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                <span>{isTestingSupabase ? 'Pinging Database...' : 'Test Connection'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowConfigInputs(!showConfigInputs)}
                className="px-3.5 py-2 rounded-xl bg-[#8B7CFF]/10 text-[#8B7CFF] border border-[#8B7CFF]/30 hover:bg-[#8B7CFF]/20 text-xs font-semibold cursor-pointer transition-colors font-sans"
              >
                {showConfigInputs ? 'Close Key Editor' : 'Quick Connect Keys'}
              </button>
            </div>
          </div>

          {showConfigInputs && (
            <form onSubmit={handleSaveBrowserCredentials} className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 font-sans">
                  Supabase Project URL (e.g. https://your-id.supabase.co)
                </label>
                <input
                  type="url"
                  placeholder="https://xyzcompany.supabase.co"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-zinc-100 font-sans"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 font-sans">
                  Supabase Anon Public Key (starts with ey...)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-zinc-100 font-mono"
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-sans">
                  Saved in your local browser session. For production, add <code className="text-[#8B7CFF]">VITE_SUPABASE_URL</code> in Vercel/Netlify.
                </span>
                <div className="flex items-center gap-2">
                  {localStorage.getItem('performiq_vite_supabase_url') && (
                    <button
                      type="button"
                      onClick={handleClearBrowserCredentials}
                      className="px-3 py-1.5 text-xs text-red-500 hover:text-red-400 font-semibold cursor-pointer"
                    >
                      Clear Saved Keys
                    </button>
                  )}
                  <button
                    type="submit"
                    className="premium-glow-btn px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Save & Reconnect
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 4. NOTIFICATIONS & PREFERENCES */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
          <Bell className="w-4 h-4 text-[#8B7CFF]" />
          <h2 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-sans">
            In-App Alerts & Digest Preferences
          </h2>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-white/[0.08] text-xs">
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 dark:text-[#F0F3FA]">Weekly Performance Digest</div>
              <div className="text-slate-500 dark:text-zinc-300 mt-0.5 font-sans text-[11px]">
                Summary of team progress, kudos received, and active cycle milestone alerts.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEmailDigest(!emailDigest)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                emailDigest ? 'bg-[#8B7CFF]' : 'bg-slate-200 dark:bg-white/10'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white dark:bg-[#18181b] transition-transform absolute top-0.5 ${
                  emailDigest ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="py-3.5 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 dark:text-[#F0F3FA]">Live Stage Advancement Alerts</div>
              <div className="text-slate-500 dark:text-zinc-300 mt-0.5 font-sans text-[11px]">
                Prompts when review cycles shift from goal setting to evaluation or calibration release.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInAppAlerts(!inAppAlerts)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                inAppAlerts ? 'bg-[#8B7CFF]' : 'bg-slate-200 dark:bg-white/10'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white dark:bg-[#18181b] transition-transform absolute top-0.5 ${
                  inAppAlerts ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="py-3.5 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 dark:text-[#F0F3FA]">Peer Recognition & Kudos Prompts</div>
              <div className="text-slate-500 dark:text-zinc-300 mt-0.5 font-sans text-[11px]">
                Notify instantly when teammates tag you in a skill or leadership commendation.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMilestoneReminders(!milestoneReminders)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                milestoneReminders ? 'bg-[#8B7CFF]' : 'bg-slate-200 dark:bg-white/10'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white dark:bg-[#18181b] transition-transform absolute top-0.5 ${
                  milestoneReminders ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 5. WORKSPACE DATASET & WORKFLOW REVERT CONTROLS */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 space-y-5 border border-indigo-500/20 bg-indigo-500/[0.02]">
        <div className="flex items-center justify-between pb-3 border-b border-indigo-500/15">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-sans">
              Workspace Dataset & Workflow Controls
            </h2>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            ● Clean Production Mode (0 Records)
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
          Your workspace is running in clean production mode with all demo records removed. All user profiles and review cycle definitions are preserved, with zero fake goals, reviews, or mock data.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            Clear any cached workflow records back to zero while preserving all user accounts.
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setShowResetDialog(true)
              }}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer font-sans"
            >
              Reset Workflow (0 Records)
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleResetCleanWorkflow}
        title="Reset Workflow Records to Zero?"
        message="This will preserve all user accounts and employee profiles while clearing any temporary goals, reviews, and notifications back to zero so you can run the cycle completely fresh."
        confirmText="Reset to Zero Records"
        variant="warning"
        isLoading={isResetting}
      />
    </div>
  )
}

