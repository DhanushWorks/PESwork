import React, { useState } from 'react'
import { useApp } from '../app/AppContext'
import { useToast } from '../components/ui/Toast'
import { peopleService } from '../services'
import { RoleBadge } from '../components/ui/Badge'
import { formatDate } from '../lib/formatters'
import { CheckCheck, Copy } from 'lucide-react'

export const Profile: React.FC = () => {
  const { currentUser, allUsers, refreshData } = useApp()
  const { success, error } = useToast()

  const [name, setName] = useState(currentUser.name)
  const [designation, setDesignation] = useState(currentUser.designation)
  const [department, setDepartment] = useState(currentUser.department)
  const [isSaving, setIsSaving] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const manager = allUsers.find((u) => u.id === currentUser.managerId)

  const handleCopy = (text: string, field: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      error('Name required', 'Please provide a valid full name.')
      return
    }

    setIsSaving(true)
    try {
      await peopleService.update(currentUser.id, {
        name: name.trim(),
        designation: designation.trim(),
        department: department.trim(),
      })
      await refreshData()
      success('Profile updated', 'Your display details were saved successfully.')
    } catch (err: any) {
      error('Update failed', err.message || 'Could not update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 w-full pb-20 sm:pb-24 lg:pb-16 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Personal Profile
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-sans">
            Manage your personal identity, professional designation, and workspace credentials.
          </p>
        </div>
      </div>

      {/* 1. PERSONAL IDENTITY & ACTIVE ACCOUNT */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="pb-3 border-b border-slate-200 dark:border-white/[0.08]">
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
                <RoleBadge role={currentUser.role} />
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-300 font-sans">{currentUser.email}</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-300/70 font-sans">
                Member of {currentUser.department} department · Managed by{' '}
                {manager ? `${manager.name} (${manager.designation})` : 'Executive Board'}
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
                Work Email Address
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={currentUser.email}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.02] text-slate-500 dark:text-zinc-300 cursor-not-allowed font-sans pr-16"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(currentUser.email, 'email')}
                  className="absolute right-2 top-2 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white rounded-md cursor-pointer transition-colors"
                >
                  {copiedField === 'email' ? (
                    <span className="text-emerald-500 inline-flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" /> Copied
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Copy className="w-3 h-3" /> Copy
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-[#C5CEE0] block mb-1.5 font-sans">
                Employee Code / System ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={currentUser.employeeCode || currentUser.id}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.02] text-slate-500 dark:text-zinc-300 cursor-not-allowed font-mono pr-16"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(currentUser.employeeCode || currentUser.id, 'empId')}
                  className="absolute right-2 top-2 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white rounded-md cursor-pointer transition-colors"
                >
                  {copiedField === 'empId' ? (
                    <span className="text-emerald-500 inline-flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" /> Copied
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Copy className="w-3 h-3" /> Copy
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-[#C5CEE0] block mb-1.5 font-sans">
                Organization Joined Date
              </label>
              <input
                type="text"
                disabled
                value={currentUser.joinedDate ? formatDate(currentUser.joinedDate) : 'Jan 01, 2024'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.02] text-slate-500 dark:text-zinc-300 cursor-not-allowed font-sans"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 font-sans shadow-xs"
            >
              {isSaving ? 'Saving Changes...' : 'Save Profile Details'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. ROLE & GOVERNANCE ACCESS */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="pb-3 border-b border-slate-200 dark:border-white/[0.08]">
          <h2 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-sans">
            Assigned Workspace Role & Security Clearance
          </h2>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-[#F0F3FA]">
              {currentUser.role === 'admin'
                ? 'Enterprise Administrator'
                : currentUser.role === 'manager'
                ? 'People & Appraisal Manager'
                : 'Individual Contributor / Employee'}
            </span>
            <RoleBadge role={currentUser.role} />
          </div>
          <p className="text-slate-600 dark:text-zinc-300 leading-relaxed font-sans">
            {currentUser.role === 'admin'
              ? 'Full administrative control over performance cycles, company-wide calibration, user management, and system-wide audit trails.'
              : currentUser.role === 'manager'
              ? 'Authorized to review direct reports, calibrate team goals, submit manager appraisals, and conduct performance discussions.'
              : 'Authorized to set performance goals, log progress milestones and evidence, complete self-reflections, and view released appraisal outcomes.'}
          </p>
        </div>
      </div>
    </div>
  )
}

