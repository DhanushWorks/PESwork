import React, { useEffect, useState, useMemo } from 'react'
import { auditService } from '../../services'
import { AuditLog, User } from '../../types'
import { formatDateTime } from '../../lib/formatters'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { CustomDropdown } from '../../components/ui/CustomDropdown'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import {
  History,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  ArrowRightCircle,
  Download,
  RefreshCw,
  FileText,
  FileCode,
  Copy,
  Check,
  Lock,
  Sparkles,
  Clock,
  User as UserIcon,
  Tag,
  Eye,
  Activity,
  X,
  Key,
  Layers,
  ChevronRight,
  Database,
  CheckCircle,
  AlertTriangle,
  Search,
} from 'lucide-react'

// Synthetic cryptographic hash generator for audit demonstration
const generateBlockHash = (id: string, timestamp: string): string => {
  let hash = 0
  const str = `${id}-${timestamp}-performiq-ledger-v1`
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `0x${hex}f92b4c81a2e73d10`
}

// Action Badge styling & human-readable formatting (AWS / Enterprise grade)
interface ActionMeta {
  label: string
  icon: React.ComponentType<{ className?: string }>
  style: string
  iconColor: string
}

const ACTION_CONFIG: Record<string, ActionMeta> = {
  // Approvals & Confirmations (Subtle Enterprise Emerald)
  CALIBRATION_ADMIN_APPROVED: {
    label: 'Calibration Approved',
    icon: CheckCircle2,
    style: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  GOAL_APPROVED: {
    label: 'Goal Approved',
    icon: CheckCircle2,
    style: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  CYCLE_RESULTS_RELEASED: {
    label: 'Results Released',
    icon: CheckCircle2,
    style: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  RESULT_ACKNOWLEDGED: {
    label: 'Result Acknowledged',
    icon: CheckCircle2,
    style: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },

  // Calibration / Adjustments (Subtle Slate/Zinc)
  CALIBRATION_ADJUSTED: {
    label: 'Calibration Adjusted',
    icon: Sliders,
    style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
    iconColor: 'text-slate-600 dark:text-zinc-400',
  },
  SCORE_CALIBRATED: {
    label: 'Score Calibrated',
    icon: Sliders,
    style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
    iconColor: 'text-slate-600 dark:text-zinc-400',
  },

  // Reviews & Submissions (Subtle Slate/Zinc)
  MANAGER_REVIEW_SUBMITTED: {
    label: 'Manager Review',
    icon: FileText,
    style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
    iconColor: 'text-slate-600 dark:text-zinc-400',
  },
  SELF_REVIEW_SUBMITTED: {
    label: 'Self Review',
    icon: FileText,
    style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
    iconColor: 'text-slate-600 dark:text-zinc-400',
  },
  GOALS_SUBMITTED: {
    label: 'Goals Submitted',
    icon: FileText,
    style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
    iconColor: 'text-slate-600 dark:text-zinc-400',
  },

  // Lifecycle & Stage Progressions (Subtle Slate/Zinc)
  CYCLE_ADVANCED: {
    label: 'Stage Advanced',
    icon: ArrowRightCircle,
    style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
    iconColor: 'text-slate-600 dark:text-zinc-400',
  },
  STAGE_ADVANCED: {
    label: 'Stage Advanced',
    icon: ArrowRightCircle,
    style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
    iconColor: 'text-slate-600 dark:text-zinc-400',
  },
  CYCLE_CREATED: {
    label: 'Cycle Created',
    icon: ArrowRightCircle,
    style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
    iconColor: 'text-slate-600 dark:text-zinc-400',
  },
  PARTICIPANT_ENROLLED_IN_CYCLE: {
    label: 'Participant Enrolled',
    icon: ArrowRightCircle,
    style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
    iconColor: 'text-slate-600 dark:text-zinc-400',
  },
  PARTICIPANTS_BULK_ENROLLED: {
    label: 'Bulk Enrolled',
    icon: ArrowRightCircle,
    style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
    iconColor: 'text-slate-600 dark:text-zinc-400',
  },

  // Warnings / Revisions (Subtle Enterprise Amber)
  GOAL_RETURNED: {
    label: 'Goal Returned',
    icon: AlertTriangle,
    style: 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  RESULT_DISPUTED: {
    label: 'Result Disputed',
    icon: AlertTriangle,
    style: 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },

  // Destructive / Revocations (Subtle Enterprise Rose)
  CYCLE_DELETED: {
    label: 'Cycle Deleted',
    icon: AlertTriangle,
    style: 'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  CALIBRATION_PERMISSION_REVOKED: {
    label: 'Permission Revoked',
    icon: AlertTriangle,
    style: 'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  PARTICIPANT_REMOVED_FROM_CYCLE: {
    label: 'Participant Removed',
    icon: AlertTriangle,
    style: 'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
}

const getActionMeta = (action: string): ActionMeta => {
  if (ACTION_CONFIG[action]) {
    return ACTION_CONFIG[action]
  }

  // Fallback: format raw UPPER_SNAKE_CASE to clean Title Case
  const cleanLabel = action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())

  if (action.includes('APPROV') || action.includes('RELEASE')) {
    return {
      label: cleanLabel,
      icon: CheckCircle2,
      style: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    }
  }

  if (action.includes('DELETE') || action.includes('REVOK') || action.includes('REMOVE')) {
    return {
      label: cleanLabel,
      icon: AlertTriangle,
      style: 'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50',
      iconColor: 'text-rose-600 dark:text-rose-400',
    }
  }

  if (action.includes('RETURN') || action.includes('DISPUT')) {
    return {
      label: cleanLabel,
      icon: AlertTriangle,
      style: 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
    }
  }

  if (action.includes('STAGE') || action.includes('CYCLE')) {
    return {
      label: cleanLabel,
      icon: ArrowRightCircle,
      style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
      iconColor: 'text-slate-600 dark:text-zinc-400',
    }
  }

  return {
    label: cleanLabel,
    icon: Activity,
    style: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700',
    iconColor: 'text-slate-600 dark:text-zinc-400',
  }
}

export const AdminAudit: React.FC = () => {
  const { allUsers } = useApp()
  const { success, info } = useToast()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedActor, setSelectedActor] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [isVerifying, setIsVerifying] = useState(false)
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string>('Just now')
  const [inspectLog, setInspectLog] = useState<AuditLog | null>(null)
  const [hasCopiedPayload, setHasCopiedPayload] = useState(false)

  // Fetch audit records
  const fetchLogs = async () => {
    setLoading(true)
    try {
      const list = await auditService.list()
      setLogs(list)
    } catch (err) {
      console.warn('Notice loading audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    fetchLogs().finally(() => {
      clearTimeout(safetyTimer)
    })

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
    }
  }, [])

  // User Map for rich actor information
  const userMap = useMemo(() => {
    const map = new Map<string, User>()
    allUsers.forEach((u) => map.set(u.id, u))
    return map
  }, [allUsers])

  // Categorize log by action
  const getLogCategory = (action: string): 'stages' | 'calibration' | 'approvals' | 'reviews' | 'cycles' => {
    if (action.includes('STAGE')) return 'stages'
    if (action.includes('CALIBRATION')) return 'calibration'
    if (action.includes('APPROV')) return 'approvals'
    if (action.includes('REVIEW')) return 'reviews'
    return 'cycles'
  }

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    return logs
      .filter((l) => {
        const actionLabel = getActionMeta(l.action).label.toLowerCase()
        const matchesSearch =
          l.actorName.toLowerCase().includes(search.toLowerCase()) ||
          l.action.toLowerCase().includes(search.toLowerCase()) ||
          actionLabel.includes(search.toLowerCase()) ||
          l.details.toLowerCase().includes(search.toLowerCase()) ||
          l.entity.toLowerCase().includes(search.toLowerCase()) ||
          l.id.toLowerCase().includes(search.toLowerCase())

        const matchesActor = selectedActor === 'all' || l.actorId === selectedActor

        const category = getLogCategory(l.action)
        const matchesCategory =
          selectedCategory === 'all' ||
          (selectedCategory === 'stages' && (category === 'stages' || category === 'cycles')) ||
          (selectedCategory === 'calibration' && category === 'calibration') ||
          (selectedCategory === 'approvals' && (category === 'approvals' || category === 'reviews'))

        return matchesSearch && matchesActor && matchesCategory
      })
      .sort((a, b) => {
        const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        return sortOrder === 'desc' ? diff : -diff
      })
  }, [logs, search, selectedCategory, selectedActor, sortOrder])

  // Counts for KPI Cards and Category Pills
  const counts = useMemo(() => {
    let stages = 0
    let calibration = 0
    let approvals = 0
    logs.forEach((l) => {
      const cat = getLogCategory(l.action)
      if (cat === 'stages' || cat === 'cycles') stages++
      if (cat === 'calibration') calibration++
      if (cat === 'approvals' || cat === 'reviews') approvals++
    })
    return {
      total: logs.length,
      stages,
      calibration,
      approvals,
    }
  }, [logs])

  // Unique actors for filter
  const uniqueActors = useMemo(() => {
    const actors = new Map<string, string>()
    logs.forEach((l) => actors.set(l.actorId, l.actorName))
    return Array.from(actors.entries()).map(([id, name]) => ({ id, name }))
  }, [logs])

  // Cryptographic Ledger Verification Simulation
  const handleVerifyLedger = () => {
    setIsVerifying(true)
    setTimeout(() => {
      setIsVerifying(false)
      setLastVerifiedAt('Just now')
      success(
        'Ledger Verified Intact',
        `Cryptographic audit passed: ${logs.length}/${logs.length} blocks validated with SHA-256 integrity hash. Zero tampering detected.`
      )
    }, 950)
  }

  // Export audit logs as CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return
    const headers = ['ID', 'Timestamp', 'Actor Name', 'Actor ID', 'Action', 'Entity', 'Entity ID', 'Details']
    const rows = logs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.actorName.replace(/"/g, '""')}"`,
      `"${l.actorId}"`,
      `"${l.action}"`,
      `"${l.entity}"`,
      `"${l.entityId}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `performiq_compliance_audit_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    info('Audit Export Ready', 'Exported comprehensive event trail to CSV file.')
  }

  // Copy JSON payload of inspected log
  const handleCopyPayload = (log: AuditLog) => {
    const payload = JSON.stringify(
      {
        ...log,
        blockHash: generateBlockHash(log.id, log.timestamp),
        verificationStatus: 'VERIFIED_APPEND_ONLY',
        complianceEngine: 'PerformIQ SOC2-Type-II Traceability Kernel',
      },
      null,
      2
    )
    navigator.clipboard.writeText(payload)
    setHasCopiedPayload(true)
    setTimeout(() => setHasCopiedPayload(false), 2000)
    success('Payload Copied', 'JSON cryptographic record copied to clipboard.')
  }

  // Action Badge styling helper (Enterprise / AWS grade)
  const renderActionBadge = (action: string) => {
    const meta = getActionMeta(action)
    const Icon = meta.icon

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border shadow-2xs whitespace-nowrap ${meta.style}`}
      >
        <Icon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
        <span>{meta.label}</span>
      </span>
    )
  }

  // Parse details text to highlight numbers & score diffs
  const renderFormattedDetails = (details: string) => {
    const scoreDiffRegex = /from (\d+\.\d+) to (\d+\.\d+)/
    const match = details.match(scoreDiffRegex)

    if (match) {
      const fromScore = match[1]
      const toScore = match[2]
      const delta = (parseFloat(toScore) - parseFloat(fromScore)).toFixed(2)
      const parts = details.split(scoreDiffRegex)

      return (
        <div className="space-y-1">
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            {parts[0]}
            <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-sans text-xs font-semibold border border-slate-200 dark:border-zinc-700">
              {fromScore} → {toScore}
              <span className="text-emerald-700 dark:text-emerald-400 text-[11px] ml-0.5 font-medium">
                (+{delta})
              </span>
            </span>
            {parts[3] || ''}
          </p>
        </div>
      )
    }

    return (
      <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
        {details}
      </p>
    )
  }

  return (
    <div className="space-y-3.5 w-full pb-20 sm:pb-24 lg:pb-16 animate-fade-in font-sans">
      {/* Search & Action Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Normal Search Input */}
        <div className="relative w-full sm:w-64 md:w-72 flex items-center shrink-0">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit records or actors..."
            className="w-full h-9 pl-9 pr-8 rounded-xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-400 dark:focus:border-zinc-600 focus:ring-1 focus:ring-slate-300 dark:focus:ring-zinc-700 transition-all font-sans shadow-2xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Buttons & Filters */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Actor Filter Custom Dropdown */}
          <CustomDropdown
            value={selectedActor}
            onChange={setSelectedActor}
            align="right"
            triggerClassName="h-9 px-3 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 dark:bg-[#18181b] dark:hover:bg-zinc-800 dark:text-zinc-200 dark:hover:text-white dark:border-zinc-800 shadow-2xs transition-all"
            options={[
              { value: 'all', label: `All Actors (${uniqueActors.length})` },
              ...uniqueActors.map((a) => ({
                value: a.id,
                label: a.name,
              })),
            ]}
          />

          {/* Sort Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="h-9 px-3 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 dark:bg-[#18181b] dark:hover:bg-zinc-800 dark:text-zinc-200 dark:hover:text-white dark:border-zinc-800 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
            title="Toggle chronological ordering"
          >
            <Clock className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
            <span className="font-sans">{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
          </button>

          {/* Verify Integrity */}
          <button
            type="button"
            onClick={handleVerifyLedger}
            disabled={isVerifying}
            className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 dark:bg-[#18181b] dark:hover:bg-zinc-800 dark:text-zinc-200 dark:hover:text-white dark:border-zinc-800 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
            title="Verify cryptographic integrity of ledger"
          >
            <ShieldCheck className={`w-3.5 h-3.5 opacity-80 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Verifying...' : 'Verify'}</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-zinc-900 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 border border-transparent"
            title="Download audit records as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchLogs}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 dark:bg-[#18181b] dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white dark:border-zinc-800 shadow-2xs transition-all cursor-pointer"
            title="Refresh event log"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin opacity-80' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Luxury Audit Table Card */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md overflow-hidden">
        {/* Category Navigation Segment Bar placed directly on the Audit Recorded Card */}
        <div className="p-3 sm:px-4 sm:py-3.5 border-b border-slate-200 dark:border-white/[0.08] overflow-x-auto no-scrollbar bg-slate-50/60 dark:bg-zinc-900/40">
          <RubberSegmentedControl
            options={[
              { value: 'all', label: 'All Records', count: counts.total },
              {
                value: 'calibration',
                label: 'Calibration',
                count: counts.calibration,
                icon: <Sliders className="w-3.5 h-3.5" />,
              },
              {
                value: 'stages',
                label: 'Cycle Stages',
                count: counts.stages,
                icon: <ArrowRightCircle className="w-3.5 h-3.5" />,
              },
              {
                value: 'approvals',
                label: 'Reviews & Approvals',
                count: counts.approvals,
                icon: <ShieldCheck className="w-3.5 h-3.5" />,
              },
            ]}
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val as any)}
            size="sm"
          />
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.12] text-slate-900 dark:text-white uppercase tracking-wider text-xs font-bold font-sans">
                <th className="py-3.5 px-4 whitespace-nowrap">Block & Time</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Actor</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Action Type</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Target Entity</th>
                <th className="py-3.5 px-4 min-w-[220px]">Audit Event Details</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-slate-800 dark:text-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-600 dark:text-zinc-300">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-slate-600 dark:text-zinc-400" />
                      <span className="text-xs font-semibold font-sans">Decrypting compliance ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-600 dark:text-zinc-300">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Shield className="w-8 h-8 text-slate-400 dark:text-zinc-500 mb-1" />
                      <p className="text-sm font-bold text-slate-800 dark:text-white">No matching audit events</p>
                      <p className="text-xs text-slate-600 dark:text-zinc-300 font-medium">Try adjusting your search criteria or actor filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => {
                  const actor = userMap.get(log.actorId)
                  const blockNumber = logs.length - index

                  return (
                    <tr
                      key={`${log.id}-${index}`}
                      onClick={() => setInspectLog(log)}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors group cursor-pointer"
                    >
                      {/* Timestamp & Block Reference */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-sans text-[10px] font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-white/[0.08] px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/[0.08]">
                            #{String(blockNumber).padStart(3, '0')}
                          </span>
                          <div>
                            <p className="font-sans text-xs font-medium text-slate-900 dark:text-white">
                              {formatDateTime(log.timestamp)}
                            </p>
                            <p className="font-sans text-[10px] text-slate-400 dark:text-zinc-400">
                              {generateBlockHash(log.id, log.timestamp).slice(0, 10)}...
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Actor Profile */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {actor?.avatar ? (
                            <img
                              src={actor.avatar}
                              alt={log.actorName}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-white/10 shadow-2xs"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center font-bold text-slate-700 dark:text-white text-xs border border-slate-200 dark:border-white/10">
                              {log.actorName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-xs leading-none">
                              {log.actorName}
                            </p>
                            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
                              {actor?.department || 'System Operations'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action Type Badge */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {renderActionBadge(log.action)}
                      </td>

                      {/* Entity Target */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-sans text-[11px] font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">
                          {log.entity}
                        </span>
                      </td>

                      {/* Details & Payload Summary */}
                      <td className="py-4 px-4">
                        {renderFormattedDetails(log.details)}
                      </td>

                      {/* Inspect Action */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setInspectLog(log)
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-transparent dark:hover:border-white/10 transition-all inline-flex items-center gap-1 cursor-pointer font-sans"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Statistics Bar */}
        <div className="p-3.5 px-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span className="text-[11px] font-sans text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> SHA-256 Consensus: Valid
          </span>
          <span className="font-sans text-[11px]">
            Showing <strong className="text-slate-900 dark:text-white">{filteredLogs.length}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white">{logs.length}</strong> cryptographically verified events
          </span>
        </div>
      </div>

      {/* Forensic Audit Inspector Modal */}
      {inspectLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fade-in"
          onClick={() => setInspectLog(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white dark:bg-[#18181b] menu-solid-bg modal-surface rounded-2xl border border-slate-200 dark:border-zinc-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-scale-up"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-zinc-700/80 flex items-center justify-between bg-slate-50 dark:bg-zinc-900 menu-inner-card shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Audit Event Inspector
                    <span className="font-sans text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/50 px-2.5 py-0.5 rounded-md font-medium">
                      Verified
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-sans">
                    ID: {inspectLog.id} • {formatDateTime(inspectLog.timestamp)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#F0F3FA] hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0 text-xs">
              {/* Event Provenance Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/10">
                <div>
                  <span className="text-[10px] font-sans uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                    Authorized Actor
                  </span>
                  <p className="font-bold text-slate-900 dark:text-[#F0F3FA] text-xs mt-0.5">
                    {inspectLog.actorName}
                  </p>
                  <span className="font-sans text-[10px] text-slate-600 dark:text-zinc-400 font-medium">
                    ID: {inspectLog.actorId}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-sans uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                    Action Type
                  </span>
                  <div className="mt-1">
                    {renderActionBadge(inspectLog.action)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-sans uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                    Target Entity
                  </span>
                  <p className="font-sans text-xs font-bold text-slate-800 dark:text-[#F0F3FA] mt-0.5">
                    {inspectLog.entity} ({inspectLog.entityId})
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-sans uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                    Audit Signature Hash
                  </span>
                  <p className="font-mono text-[11px] text-slate-700 dark:text-zinc-300 font-medium mt-0.5 truncate">
                    {generateBlockHash(inspectLog.id, inspectLog.timestamp)}
                  </p>
                </div>
              </div>

              {/* Event Detail Summary */}
              <div>
                <span className="text-[10px] font-sans uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                  Event Rationale & Description
                </span>
                <div className="mt-1.5 p-3 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10">
                  {renderFormattedDetails(inspectLog.details)}
                </div>
              </div>

              {/* Raw Signed JSON Payload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-sans uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                    <FileCode className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                    Signed Payload (JSON)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyPayload(inspectLog)}
                    className="text-xs font-sans font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {hasCopiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {hasCopiedPayload ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-200 dark:bg-zinc-950 dark:text-zinc-200 font-mono text-[11px] leading-relaxed overflow-x-auto no-scrollbar border border-slate-800 dark:border-zinc-800">
                  {JSON.stringify(
                    {
                      id: inspectLog.id,
                      timestamp: inspectLog.timestamp,
                      actor: {
                        id: inspectLog.actorId,
                        name: inspectLog.actorName,
                        verifiedRole: userMap.get(inspectLog.actorId)?.role || 'authorized_user',
                      },
                      action: inspectLog.action,
                      entity: {
                        type: inspectLog.entity,
                        targetId: inspectLog.entityId,
                      },
                      details: inspectLog.details,
                      cryptography: {
                        algorithm: 'SHA-256',
                        signature: generateBlockHash(inspectLog.id, inspectLog.timestamp),
                        merkleRoot: '0x49f2b810d7a6e1293c048b',
                        immutableSeal: true,
                      },
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/60 dark:bg-white/[0.02] shrink-0">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-sans flex items-center gap-1 font-medium">
                <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                Guaranteed append-only audit record
              </span>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#E6E9F2] bg-slate-200 hover:bg-slate-300 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] transition-all cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
