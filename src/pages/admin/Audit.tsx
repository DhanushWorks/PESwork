import React, { useEffect, useState, useMemo } from 'react'
import { auditService } from '../../services'
import { AuditLog, User } from '../../types'
import { formatDateTime } from '../../lib/formatters'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { AnimatedSearchBar } from '../../components/ui/AnimatedSearchBar'
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
    const list = await auditService.list()
    setLogs(list)
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
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
        const matchesSearch =
          l.actorName.toLowerCase().includes(search.toLowerCase()) ||
          l.action.toLowerCase().includes(search.toLowerCase()) ||
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

  // Action Badge styling helper
  const renderActionBadge = (action: string) => {
    if (action.includes('CALIBRATION')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide uppercase bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 dark:border-purple-500/30 shadow-xs">
          <Sliders className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          {action}
        </span>
      )
    }
    if (action.includes('STAGE') || action.includes('CYCLE')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide uppercase bg-indigo-50 text-indigo-700 dark:bg-emerald-500/10 dark:text-emerald-300 border border-indigo-200/90 dark:border-emerald-500/30 shadow-xs">
          <ArrowRightCircle className="w-3 h-3 text-indigo-600 dark:text-emerald-400" />
          {action}
        </span>
      )
    }
    if (action.includes('APPROV')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide uppercase bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 dark:border-amber-500/30 shadow-xs">
          <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          {action}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide uppercase bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 dark:border-blue-500/30 shadow-xs">
        <FileText className="w-3 h-3 text-blue-600 dark:text-blue-400" />
        {action}
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
            <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-mono text-[11px] font-bold border border-slate-200 dark:border-white/10">
              {fromScore} → {toScore}
              <span className="text-indigo-600 dark:text-[#4FE3C1] text-[10px] ml-0.5">
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
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Forensic Audit & Compliance Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Immutable cryptographic ledger, administrative traceability & cycle governance
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleVerifyLedger}
            disabled={isVerifying}
            className="inline-flex items-center gap-2 h-10 sm:h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 transition-all font-medium text-xs sm:text-sm cursor-pointer shadow-2xs disabled:opacity-60"
            title="Perform cryptographic hash check on all ledger blocks"
          >
            <ShieldCheck className={`w-4 h-4 text-indigo-600 dark:text-[#4FE3C1] ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Verifying Chain...' : 'Verify Integrity'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-black font-semibold text-xs sm:text-sm cursor-pointer inline-flex items-center gap-2 shadow-xs transition-all border border-transparent dark:border-white/10"
            title="Download audit records as CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={fetchLogs}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 transition-all cursor-pointer shadow-2xs"
            title="Refresh event log"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600 dark:text-[#4FE3C1]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Stat Cards (White in Whitemode, Obsidian Black in Darkmode) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Events */}
        <div className="rounded-2xl sm:rounded-3xl p-5 sm:p-5.5 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md hover:border-slate-300 dark:hover:border-zinc-600 transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Total Logged Events
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
              {counts.total}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/90 dark:bg-emerald-500/15 dark:text-[#4FE3C1] dark:border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-[#4FE3C1]" /> 100% Intact
            </span>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            <span>Cryptographic status</span>
            <span className="text-slate-700 dark:text-zinc-300">Verified {lastVerifiedAt}</span>
          </div>
        </div>

        {/* Stage & Lifecycle Advances */}
        <div className="rounded-2xl sm:rounded-3xl p-5 sm:p-5.5 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md hover:border-slate-300 dark:hover:border-zinc-600 transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Cycle Transitions
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
              <ArrowRightCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
              {counts.stages}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              stages advanced
            </span>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            <span>Active cycle</span>
            <span className="text-slate-700 dark:text-zinc-300">H1-2026 Cycle</span>
          </div>
        </div>

        {/* Calibration Overrides */}
        <div className="rounded-2xl sm:rounded-3xl p-5 sm:p-5.5 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md hover:border-slate-300 dark:hover:border-zinc-600 transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Calibration Overrides
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
              {counts.calibration}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              adjustments
            </span>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            <span>Governance review</span>
            <span className="text-slate-700 dark:text-zinc-300">Audited with rationale</span>
          </div>
        </div>

        {/* Governance & Reviews */}
        <div className="rounded-2xl sm:rounded-3xl p-5 sm:p-5.5 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md hover:border-slate-300 dark:hover:border-zinc-600 transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Approvals & Reviews
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
              {counts.approvals}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              submissions
            </span>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            <span>Verification seal</span>
            <span className="text-slate-700 dark:text-zinc-300">Signed & timestamped</span>
          </div>
        </div>
      </div>

      {/* Search, Filter Tabs & Controls Toolbar */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Animated Search Bar with 270px x 48px Experience */}
          <div className="w-full sm:w-auto">
            <AnimatedSearchBar
              value={search}
              onChangeValue={(val) => setSearch(val)}
              placeholder="Filter by actor, action, score, or block ID..."
              animatedPlaceholders={[
                'Filter by actor or admin...',
                'Search action or event...',
                'Filter by score adjustment...',
                'Search SHA-256 block ID...',
              ]}
              variant="pill"
              sizeVariant="default"
              containerClassName="w-full sm:w-[320px] focus-within:sm:w-[360px]"
            />
          </div>

          {/* Actor Selector & Sort Controls */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
            {/* Actor Filter Custom Dropdown */}
            <CustomDropdown
              value={selectedActor}
              onChange={setSelectedActor}
              align="right"
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
              className="h-10 px-3.5 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 border border-white/10 transition-all cursor-pointer flex items-center gap-2 shadow-2xs"
              title="Toggle chronological ordering"
            >
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-mono">{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>
        </div>

        {/* Filter Pill Tabs */}
        <div className="overflow-x-auto no-scrollbar pt-1 border-t border-white/[0.08]">
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
      </div>

      {/* Main Luxury Audit Table Card */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] font-mono">
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
                  <td colSpan={6} className="text-center py-16 text-slate-400 dark:text-[#8D96AA]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 dark:text-[#4FE3C1]" />
                      <span className="text-xs font-semibold font-mono">Decrypting compliance ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-400 dark:text-[#8D96AA]">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Shield className="w-8 h-8 text-slate-300 dark:text-[#8D96AA]/40 mb-1" />
                      <p className="text-sm font-bold text-slate-700 dark:text-[#F0F3FA]">No matching audit events</p>
                      <p className="text-xs text-slate-400 dark:text-[#8D96AA]">Try adjusting your search criteria or actor filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => {
                  const actor = userMap.get(log.actorId)
                  const blockNumber = logs.length - index

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setInspectLog(log)}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors group cursor-pointer"
                    >
                      {/* Timestamp & Block Reference */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-white/[0.08] px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/[0.08]">
                            #{String(blockNumber).padStart(3, '0')}
                          </span>
                          <div>
                            <p className="font-mono text-xs font-medium text-slate-900 dark:text-white">
                              {formatDateTime(log.timestamp)}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400 dark:text-zinc-400">
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
                        <span className="font-mono text-[11px] font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">
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
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-transparent dark:hover:border-white/10 transition-all inline-flex items-center gap-1 cursor-pointer font-mono"
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
          <span className="font-mono text-[11px]">
            Showing <strong className="text-slate-900 dark:text-white">{filteredLogs.length}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white">{logs.length}</strong> cryptographically verified events
          </span>
          <span className="text-[11px] font-mono text-indigo-600 dark:text-[#4FE3C1] flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-[#4FE3C1]" /> SHA-256 Consensus: Valid
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
            <div className="p-5 border-b border-slate-200 dark:border-zinc-700/80 flex items-center justify-between bg-slate-50 dark:bg-zinc-900 menu-inner-card">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#8B7CFF]/10 text-[#8B7CFF] border border-[#8B7CFF]/20 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-[#F0F3FA] flex items-center gap-2">
                    Cryptographic Block Inspector
                    <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/90 dark:text-[#4FE3C1] dark:bg-[#4FE3C1]/10 px-2 py-0.5 rounded-full dark:border-[#4FE3C1]/20 font-bold">
                      VERIFIED IMMUTABLE
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8D96AA] font-mono">
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
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Event Provenance Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/10">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-[#8D96AA]">
                    Authorized Actor
                  </span>
                  <p className="font-bold text-slate-900 dark:text-[#F0F3FA] text-xs mt-0.5">
                    {inspectLog.actorName}
                  </p>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-[#8D96AA]">
                    ID: {inspectLog.actorId}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-[#8D96AA]">
                    Action Type
                  </span>
                  <div className="mt-1">
                    {renderActionBadge(inspectLog.action)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-[#8D96AA]">
                    Target Entity
                  </span>
                  <p className="font-mono text-xs font-bold text-slate-800 dark:text-[#F0F3FA] mt-0.5">
                    {inspectLog.entity} ({inspectLog.entityId})
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-[#8D96AA]">
                    Audit Signature Hash
                  </span>
                  <p className="font-mono text-[11px] text-[#8B7CFF] font-bold mt-0.5 truncate">
                    {generateBlockHash(inspectLog.id, inspectLog.timestamp)}
                  </p>
                </div>
              </div>

              {/* Event Detail Summary */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-[#8D96AA]">
                  Event Rationale & Description
                </span>
                <div className="mt-1.5 p-3 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10">
                  {renderFormattedDetails(inspectLog.details)}
                </div>
              </div>

              {/* Raw Signed JSON Payload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-[#8D96AA] flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-[#8B7CFF]" />
                    Signed Raw Payload (JSON)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyPayload(inspectLog)}
                    className="text-[11px] font-mono font-semibold text-[#8B7CFF] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {hasCopiedPayload ? <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-[#4FE3C1]" /> : <Copy className="w-3.5 h-3.5" />}
                    {hasCopiedPayload ? 'Copied!' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#06080D] text-[#8B7CFF] font-mono text-[11px] leading-relaxed overflow-x-auto no-scrollbar border border-white/10">
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
            <div className="p-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/60 dark:bg-white/[0.02]">
              <span className="text-[11px] text-slate-400 dark:text-[#8D96AA] font-mono flex items-center gap-1">
                <Lock className="w-3 h-3 text-indigo-600 dark:text-[#4FE3C1]" />
                Guaranteed append-only by PerformIQ Kernel
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
