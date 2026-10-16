import React, { useState } from 'react'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { peopleService } from '../../services'
import { RoleBadge } from '../../components/ui/Badge'
import { formatDate } from '../../lib/formatters'
import {
  Building2,
  Calendar,
  Mail,
  Shield,
  UserCheck,
  Pencil,
  Check,
  X,
  Copy,
  CheckCheck,
  IdCard,
  Sparkles,
} from 'lucide-react'

export const EmployeeProfile: React.FC = () => {
  const { currentUser, allUsers, refreshData } = useApp()
  const { success, error } = useToast()

  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(currentUser.name)
  const [isSaving, setIsSaving] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const manager = allUsers.find((u) => u.id === currentUser.managerId)

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nameInput.trim()
    if (!trimmed) {
      error('Name cannot be empty')
      return
    }
    if (trimmed === currentUser.name) {
      setIsEditingName(false)
      return
    }

    try {
      setIsSaving(true)
      await peopleService.update(currentUser.id, { name: trimmed })
      await refreshData()
      success('Name updated successfully')
      setIsEditingName(false)
    } catch (err: any) {
      error(err.message || 'Failed to update name')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setNameInput(currentUser.name)
    setIsEditingName(false)
  }

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* Page Header (Matching Dashboard UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Employee Profile
          </h1>
        </div>
      </div>

      {/* Animated Profile Card */}
      <div className="relative dark-glass-card conic-border-glow rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
        <div className="p-6 sm:p-8 space-y-6">
          {/* Header Section: Avatar + Name (Editable) + Role & ID */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-200 dark:border-white/[0.08]">
            {/* Avatar with Status Pulse */}
            <div className="relative group/avatar flex-shrink-0">
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={currentUser.name}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-slate-100 dark:ring-white/10 shadow-md group-hover/avatar:scale-105 transition-transform duration-300"
              />
              <span
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-600 dark:bg-[#4FE3C1] border-2 border-white dark:border-[#18181b] rounded-full shadow-xs"
                title="Active Employee"
              >
                <span className="absolute inset-0 rounded-full bg-indigo-600 dark:bg-[#4FE3C1] animate-ping opacity-60" />
              </span>
            </div>

            {/* Profile Info & Editable Name */}
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                {isEditingName ? (
                  <form onSubmit={handleSaveName} className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      autoFocus
                      disabled={isSaving}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#F0F3FA] bg-white dark:bg-[#18181b] border-2 border-slate-300 dark:border-zinc-700/80 focus:border-[#8B7CFF] rounded-xl px-3 py-1 focus:outline-hidden transition-all shadow-xs"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="submit"
                        disabled={isSaving || !nameInput.trim()}
                        className="premium-glow-btn h-8 px-3 text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                        title="Save name"
                      >
                        <Check className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-700 dark:text-[#8D96AA] border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5 text-slate-500" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-2.5 flex-wrap group/name">
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-[#F0F3FA] tracking-tight">
                      {currentUser.name}
                    </h2>
                    <RoleBadge role={currentUser.role} />
                    <button
                      type="button"
                      onClick={() => {
                        setNameInput(currentUser.name)
                        setIsEditingName(true)
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 dark:text-[#8D96AA] hover:text-slate-900 dark:hover:text-[#F0F3FA] bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200/80 dark:hover:bg-white/[0.08] rounded-lg transition-all cursor-pointer font-mono"
                      title="Click to edit name"
                    >
                      <Pencil className="w-3 h-3 text-[#8B7CFF]" />
                      <span>Edit</span>
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 dark:text-[#8D96AA] font-mono">
                {currentUser.designation} · {currentUser.department}
              </p>

              {/* Animated Interactive Employee ID Badge */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleCopy(currentUser.employeeCode, 'empId')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100/80 dark:bg-white/[0.04] hover:bg-slate-200/70 dark:hover:bg-white/[0.08] text-slate-600 dark:text-[#8D96AA] hover:text-slate-900 dark:hover:text-[#F0F3FA] font-mono text-[11px] font-medium transition-all cursor-pointer border border-slate-200 dark:border-white/[0.08] group/id"
                  title="Click to copy employee ID"
                >
                  <IdCard className="w-3.5 h-3.5 text-[#8B7CFF]" />
                  <span>ID: {currentUser.employeeCode}</span>
                  {copiedField === 'empId' ? (
                    <span className="flex items-center gap-0.5 text-indigo-600 dark:text-[#4FE3C1] font-sans font-semibold text-[10px]">
                      <CheckCheck className="w-3 h-3 text-indigo-600 dark:text-[#4FE3C1]" />
                      Copied!
                    </span>
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400 dark:text-[#8D96AA] opacity-60 group-hover/id:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Info Grid with Hover Micro-Animations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Work Email Tile */}
            <div
              onClick={() => handleCopy(currentUser.email, 'email')}
              className="group flex items-center justify-between p-3.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 hover:shadow-xs transition-all duration-200 cursor-pointer"
              title="Click to copy email"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-slate-200/60 dark:bg-white/[0.06] text-[#8B7CFF] group-hover:bg-[#8B7CFF]/20 transition-colors flex-shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-400 dark:text-[#8D96AA] block font-mono">Work Email</span>
                  <span className="font-semibold text-slate-800 dark:text-[#F0F3FA] truncate block font-mono">
                    {currentUser.email}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 ml-2">
                {copiedField === 'email' ? (
                  <span className="flex items-center gap-0.5 text-indigo-600 dark:text-[#4FE3C1] font-semibold text-[10px] font-mono">
                    <CheckCheck className="w-3.5 h-3.5" />
                    Copied
                  </span>
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400 dark:text-[#8D96AA] opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>

            {/* Department Tile */}
            <div className="group flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 hover:shadow-xs transition-all duration-200">
              <div className="p-2 rounded-lg bg-slate-200/60 dark:bg-white/[0.06] text-[#8B7CFF] group-hover:bg-[#8B7CFF]/20 transition-colors flex-shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 dark:text-[#8D96AA] block font-mono">Department</span>
                <span className="font-semibold text-slate-800 dark:text-[#F0F3FA] truncate block font-mono">
                  {currentUser.department}
                </span>
              </div>
            </div>

            {/* Direct Manager Tile */}
            <div className="group flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 hover:shadow-xs transition-all duration-200">
              <div className="p-2 rounded-lg bg-slate-200/60 dark:bg-white/[0.06] text-[#8B7CFF] group-hover:bg-[#8B7CFF]/20 transition-colors flex-shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 dark:text-[#8D96AA] block font-mono">Direct Manager</span>
                <span className="font-semibold text-slate-800 dark:text-[#F0F3FA] truncate block font-mono">
                  {manager ? `${manager.name} (${manager.designation})` : 'Leadership Board'}
                </span>
              </div>
            </div>

            {/* Joined Organization Tile */}
            <div className="group flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 hover:shadow-xs transition-all duration-200">
              <div className="p-2 rounded-lg bg-slate-200/60 dark:bg-white/[0.06] text-[#8B7CFF] group-hover:bg-[#8B7CFF]/20 transition-colors flex-shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 dark:text-[#8D96AA] block font-mono">Joined Organization</span>
                <span className="font-semibold text-slate-800 dark:text-[#F0F3FA] truncate block font-mono">
                  {formatDate(currentUser.joinedDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Security & Preview Note */}
          <div className="p-4 rounded-xl bg-[#8B7CFF]/10 dark:bg-[#8B7CFF]/10 border border-[#8B7CFF]/20 text-xs text-slate-700 dark:text-[#E6E9F2] space-y-1">
            <div className="font-bold flex items-center gap-2 text-[#8B7CFF] font-mono">
              <Shield className="w-4 h-4 text-[#8B7CFF]" />
              <span>Frontend Preview Role Simulation</span>
            </div>
            <p className="text-slate-600 dark:text-[#8D96AA] leading-relaxed text-[11px] font-mono">
              In this prototype phase, role switching is provided for UI exploration and user acceptance testing. In the upcoming production phase, authorization will be strictly verified via Supabase Auth and Row Level Security (RLS) policies.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
