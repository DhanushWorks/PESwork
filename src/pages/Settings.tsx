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
} from 'lucide-react'

export const Settings: React.FC = () => {
  const {
    currentUser,
    activeCycle,
    resetDemoData,
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

  const handleResetData = async () => {
    setIsResetting(true)
    try {
      await resetDemoData()
      success('State reset', 'All prototype goals, reviews, and cycles reverted to clean seeds.')
      setShowResetDialog(false)
    } catch (err: any) {
      error('Reset failed', err.message || 'Could not reset demo state.')
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
          <h2 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-mono">
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
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/[0.06] text-slate-700 dark:text-[#8D96AA] font-mono border border-slate-300 dark:border-white/10">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#8D96AA] font-mono">{currentUser.email}</p>
              <p className="text-[11px] text-slate-400 dark:text-[#8D96AA]/70 font-mono">
                Member of {currentUser.department} department · Managed by {currentUser.managerId || 'Director'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-[#C5CEE0] block mb-1.5 font-mono">
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
              <label className="font-semibold text-slate-700 dark:text-[#C5CEE0] block mb-1.5 font-mono">
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
              <label className="font-semibold text-slate-700 dark:text-[#C5CEE0] block mb-1.5 font-mono">
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
              <label className="font-semibold text-slate-700 dark:text-[#C5CEE0] block mb-1.5 font-mono">
                Email Address (Read-only)
              </label>
              <input
                type="text"
                disabled
                value={currentUser.email}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.02] text-slate-500 dark:text-[#8D96AA] cursor-not-allowed font-mono"
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
            <h2 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-mono">
              Appraisal Governance & Active Cycle
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#8B7CFF]/10 text-[#8B7CFF] border border-[#8B7CFF]/30 font-mono">
            {activeCycle.stage.toUpperCase()}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="font-bold text-sm text-slate-900 dark:text-[#F0F3FA]">
              {activeCycle.name}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-[#8D96AA]">
              {formatDate(activeCycle.startDate)} — {formatDate(activeCycle.endDate)}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-[#8D96AA] leading-relaxed">
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
            <ArrowRight className="w-4 h-4 text-slate-400 dark:text-[#8D96AA]" />
          </Link>

          <Link
            to="/admin/audit"
            className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-white/[0.02] hover:bg-white/[0.04] flex items-center justify-between transition-colors text-xs font-semibold text-slate-800 dark:text-[#F0F3FA]"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-[#4FE3C1]" />
              <span>View System Audit Trail</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 dark:text-[#8D96AA]" />
          </Link>
        </div>
      </div>

      {/* 3. NOTIFICATIONS & PREFERENCES */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
          <Bell className="w-4 h-4 text-[#8B7CFF]" />
          <h2 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-mono">
            In-App Alerts & Digest Preferences
          </h2>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-white/[0.08] text-xs">
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 dark:text-[#F0F3FA]">Weekly Performance Digest</div>
              <div className="text-slate-500 dark:text-[#8D96AA] mt-0.5 font-mono text-[11px]">
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
              <div className="text-slate-500 dark:text-[#8D96AA] mt-0.5 font-mono text-[11px]">
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
              <div className="text-slate-500 dark:text-[#8D96AA] mt-0.5 font-mono text-[11px]">
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

      {/* 4. PROTOTYPE STATE & DATA RECOVERY */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 space-y-4 border border-rose-500/30">
        <div className="flex items-center gap-2 pb-3 border-b border-rose-500/20">
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <h2 className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider font-mono">
            Prototype Demo Data & Reset Controls
          </h2>
        </div>

        <p className="text-xs text-slate-600 dark:text-[#8D96AA] leading-relaxed">
          PerformIQ persists simulated employee data, reviews, and committee calibration changes inside your browser’s localStorage under key <code className="font-mono bg-rose-500/10 border border-rose-500/20 px-1 py-0.5 rounded text-rose-400">performiq_demo_state_v1</code>. Reverting restores the pristine enterprise dataset.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-rose-500 dark:text-rose-400 font-mono">
            Current Dataset: 8 users · 2 appraisal cycles · Full calibration distribution
          </div>
          <button
            type="button"
            onClick={() => setShowResetDialog(true)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition-colors self-start sm:self-auto cursor-pointer font-mono"
          >
            Reset Demo Data to Seeds
          </button>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleResetData}
        title="Reset Demo Prototype State?"
        message="This will restore all employee goals, reviews, cycles, and calibration data back to clean seed data."
        confirmText="Reset State"
        variant="warning"
        isLoading={isResetting}
      />
    </div>
  )
}

