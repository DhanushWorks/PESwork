import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { calibrationService, CalibrationItem, EvidencePdfMeta, GoalEvidenceItem } from '../../services'
import { RatingBadge } from '../../components/ui/Badge'
import { RatingInput } from '../../components/ui/RatingInput'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { RATING_BANDS, getRatingBand } from '../../lib/scoring'
import { formatDate, formatDateTime } from '../../lib/formatters'
import { PdfViewerModal } from '../../components/ui/PdfViewerModal'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Filter,
  Layers,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react'

export const AdminCalibration: React.FC = () => {
  const { activeCycle, currentUser, refreshData } = useApp()
  const { success, error } = useToast()
  const navigate = useNavigate()

  const [items, setItems] = useState<CalibrationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Review & Calibrate Modal
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CalibrationItem | null>(null)
  const [activeTab, setActiveTab] = useState<'dossier' | 'calibrate'>('dossier')
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragScrollLeftRef = useRef(0)

  // Wireless mouse wheel listener: translate vertical wheel ticks into horizontal table scroll
  const handleTableWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = tableContainerRef.current
    if (!el) return
    if (el.scrollWidth > el.clientWidth) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const maxScroll = el.scrollWidth - el.clientWidth
        const atLeft = el.scrollLeft <= 0
        const atRight = el.scrollLeft >= maxScroll - 1
        if ((e.deltaY > 0 && !atRight) || (e.deltaY < 0 && !atLeft)) {
          e.preventDefault()
          el.scrollLeft += e.deltaY * 1.2
        }
      }
    }
  }

  // Mouse click-and-drag panning for any mouse
  const handleTableMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, textarea, [role="button"]')) return
    const el = tableContainerRef.current
    if (!el) return
    isDraggingRef.current = true
    dragStartXRef.current = e.pageX - el.offsetLeft
    dragScrollLeftRef.current = el.scrollLeft
  }

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const el = tableContainerRef.current
      if (!el) return
      e.preventDefault()
      const x = e.pageX - el.offsetLeft
      const walk = (x - dragStartXRef.current) * 1.4
      el.scrollLeft = dragScrollLeftRef.current - walk
    }
    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false
    }
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [])

  const scrollTable = (direction: 'left' | 'right') => {
    const el = tableContainerRef.current
    if (!el) return
    const scrollAmount = 350
    el.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' })
  }
  const [adjustedScore, setAdjustedScore] = useState<number>(4.0)
  const [calibrationReason, setCalibrationReason] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)

  // PDF Viewer Modal
  const [pdfMeta, setPdfMeta] = useState<EvidencePdfMeta | null>(null)
  const [showPdfModal, setShowPdfModal] = useState(false)

  // Batch Release Modal
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false)
  const [isReleasing, setIsReleasing] = useState(false)

  // Revoke Confirm Modal
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)
  const [itemToRevoke, setItemToRevoke] = useState<CalibrationItem | null>(null)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const data = await calibrationService.listForCycle(activeCycle.id)
      setItems(data)
    } catch (err) {
      console.warn('Notice loading calibration items:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    fetchItems().finally(() => {
      clearTimeout(safetyTimer)
    })

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
    }
  }, [activeCycle.id])

  // Open the comprehensive Review & Calibrate Dossier modal
  const openReviewModal = (item: CalibrationItem, initialTab: 'dossier' | 'calibrate' = 'dossier') => {
    setSelectedItem(item)
    setActiveTab(initialTab)
    setAdjustedScore(item.currentScore)
    setCalibrationReason(
      item.calibrationRecord?.reason ||
        `Committee consensus: Evaluated deliverables and cross-functional impact; adjusting final outcome score to ${item.currentScore.toFixed(2)}.`
    )
    setShowReviewModal(true)
  }

  // Open Evidence modal (supports PDFs and images)
  const openEvidencePdf = (item: CalibrationItem, specificEvidence?: GoalEvidenceItem) => {
    if (specificEvidence) {
      setPdfMeta({
        fileName: specificEvidence.fileName,
        fileUrl: specificEvidence.fileUrl,
        title: `${specificEvidence.goalTitle} - Evidence`,
        authorName: item.employee.name,
        goalTitle: specificEvidence.goalTitle,
        verifiedDate: specificEvidence.uploadedAt ? specificEvidence.uploadedAt.split('T')[0] : undefined,
      })
    } else if (item.allEvidence && item.allEvidence.length > 0) {
      const first = item.allEvidence.find((e) => e.isPdf) || item.allEvidence[0]
      setPdfMeta({
        fileName: first.fileName,
        fileUrl: first.fileUrl,
        title: `${first.goalTitle} - Evidence`,
        authorName: item.employee.name,
        goalTitle: first.goalTitle,
        verifiedDate: first.uploadedAt ? first.uploadedAt.split('T')[0] : undefined,
      })
    } else if (item.evidencePdf) {
      setPdfMeta(item.evidencePdf)
    } else {
      setPdfMeta({
        fileName: 'evidence_document.pdf',
        title: `${item.employee.name} - Performance Evidence`,
        authorName: item.employee.name,
        goalTitle: item.goals[0]?.title || 'Key Strategic Deliverables & Performance Benchmarks',
      })
    }
    setShowPdfModal(true)
  }

  const handleDownloadFile = (fileName: string, fileUrl?: string) => {
    if (!fileUrl) return
    const cleanUrl = fileUrl.split('#name=')[0]
    const a = document.createElement('a')
    a.href = cleanUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Save draft calibration without releasing
  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return
    if (!calibrationReason.trim() || calibrationReason.trim().length < 10) {
      error(
        'Reason required',
        'Please provide an explicit rationale for the committee consensus (at least 10 characters).'
      )
      return
    }

    setIsProcessing(true)
    try {
      await calibrationService.calibrate(
        activeCycle.id,
        selectedItem.employee.id,
        adjustedScore,
        calibrationReason,
        currentUser.name
      )

      success(
        'Draft Calibration Saved',
        `Updated score for ${selectedItem.employee.name} to ${adjustedScore.toFixed(2)}. Status remains pending Admin permission.`
      )
      setShowReviewModal(false)
      await refreshData()
      fetchItems()
    } catch (err: any) {
      error('Calibration save failed', err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Explicit Admin Permission: Approve & Release this employee's evaluation to Stage 7
  const handleApproveAndPermit = async () => {
    if (!selectedItem) return
    if (!calibrationReason.trim() || calibrationReason.trim().length < 10) {
      error(
        'Reason required',
        'Please enter the committee justification before granting formal release permission.'
      )
      return
    }

    setIsProcessing(true)
    try {
      await calibrationService.approveAndRelease(
        activeCycle.id,
        selectedItem.employee.id,
        currentUser.name,
        adjustedScore,
        calibrationReason
      )

      success(
        'Admin Permission Granted & Results Released',
        `Formally approved ${selectedItem.employee.name}'s calibration (${adjustedScore.toFixed(2)}). Results are now published and synchronized across Admin, Manager, and Employee portals.`
      )
      setShowReviewModal(false)
      await refreshData()
      fetchItems()
    } catch (err: any) {
      error('Approval failed', err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Revoke Admin permission
  const handleRevokePermission = async () => {
    if (!itemToRevoke) return
    setIsProcessing(true)
    try {
      await calibrationService.revokePermission(activeCycle.id, itemToRevoke.employee.id, currentUser.name)
      success(
        'Permission Revoked',
        `Returned ${itemToRevoke.employee.name}'s appraisal back to Calibration stage. Results are now unsealed.`
      )
      setShowRevokeConfirm(false)
      setItemToRevoke(null)
      setShowReviewModal(false)
      await refreshData()
      fetchItems()
    } catch (err: any) {
      error('Revocation failed', err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Batch release all employees in the cycle
  const handleReleaseCycle = async () => {
    setIsReleasing(true)
    try {
      const res = await calibrationService.releaseCycle(activeCycle.id)
      success(
        'Results Released Successfully!',
        `Admin granted permission for all ${res.releasedCount} employee evaluations. Results are now officially published and synchronized across Admin, Manager, and Employee portals.`
      )
      setShowReleaseConfirm(false)
      await refreshData()
      fetchItems()
    } catch (err: any) {
      error('Release failed', err.message)
    } finally {
      setIsReleasing(false)
    }
  }

  const isCalibrationStage = activeCycle.stage === 'calibration'
  const isReleased = activeCycle.stage === 'released' || activeCycle.stage === 'closed'

  // Filter items
  const filteredItems = items.filter((item) => {
    if (deptFilter !== 'all' && item.employee.department !== deptFilter) return false
    if (statusFilter === 'pending' && item.adminApproved) return false
    if (statusFilter === 'approved' && !item.adminApproved) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const empMatch = item.employee?.name?.toLowerCase().includes(q)
      const titleMatch = item.employee?.designation?.toLowerCase().includes(q)
      const mgrMatch = item.manager?.name?.toLowerCase().includes(q)
      if (!empMatch && !titleMatch && !mgrMatch) return false
    }
    return true
  })

  // Counts
  const pendingCount = items.filter((i) => !i.adminApproved).length
  const approvedCount = items.filter((i) => i.adminApproved).length

  // Calculate rating distribution
  const bandCounts: Record<string, number> = {}
  RATING_BANDS.forEach((b) => {
    bandCounts[b.label] = 0
  })

  filteredItems.forEach((it) => {
    for (const b of RATING_BANDS) {
      if (it.currentScore >= b.min && it.currentScore <= b.max) {
        bandCounts[b.label] = (bandCounts[b.label] || 0) + 1
        break
      }
    }
  })

  const previewBand = getRatingBand(adjustedScore)

  return (
    <div className="space-y-4 w-full pb-20 sm:pb-24 lg:pb-16 animate-fade-in font-sans">
      {/* Stage Notice Banner if not in calibration */}
      {!isCalibrationStage && !isReleased && (
        <div className="p-4 sm:p-4.5 rounded-2xl bg-slate-100/90 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-xs text-slate-800 dark:text-zinc-200 flex items-start justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-slate-500 dark:text-zinc-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                Cycle is currently in the "{activeCycle.stage.replace('_', ' ')}" stage.
              </p>
              <p className="text-slate-600 dark:text-zinc-400 mt-0.5">
                Official score adjustments and Admin permission gates take effect during the "Calibration" stage.
              </p>
            </div>
          </div>
          <Link
            to={`/admin/cycles/${activeCycle.id}`}
            className="text-xs font-sans font-semibold text-slate-900 dark:text-white underline flex-shrink-0 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          >
            Advance to Calibration →
          </Link>
        </div>
      )}

      {/* Rating Distribution & Governance Stat Visualizer */}
      <div className="rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md space-y-6 relative overflow-hidden transition-colors">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Calibration Status
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-100 dark:bg-zinc-800/80 text-slate-800 dark:text-zinc-200 border border-slate-300/80 dark:border-zinc-700/80 text-xs font-sans font-semibold">
              <span>{pendingCount} Awaiting Permission</span>
            </span>

            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-100 dark:bg-zinc-800/80 text-slate-800 dark:text-zinc-200 border border-slate-300/80 dark:border-zinc-700/80 text-xs font-sans font-semibold">
              <span>{approvedCount} Approved</span>
            </span>

            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() => setShowReleaseConfirm(true)}
                className="h-8.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-zinc-900 font-semibold text-xs cursor-pointer inline-flex items-center gap-2 shadow-xs transition-all border border-transparent dark:border-white/10"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                <span>Batch Approve & Release ({pendingCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Proportional Segmented Spectrum Bar */}
        <div className="space-y-2">
          <div className="w-full h-2 rounded-full overflow-hidden p-0.5 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] flex items-center gap-1">
            {filteredItems.length === 0 ? (
              <div className="w-full h-full rounded-full bg-slate-200 dark:bg-white/10" />
            ) : (
              RATING_BANDS.map((b) => {
                const count = bandCounts[b.label] || 0
                const pct = Math.round((count / filteredItems.length) * 100)
                if (count === 0) return null
                return (
                  <div
                    key={b.band}
                    className="h-full rounded-full transition-all duration-500 opacity-90 hover:opacity-100"
                    style={{ width: `${pct}%`, backgroundColor: b.color }}
                    title={`${b.label}: ${count} (${pct}%)`}
                  />
                )
              })
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] font-sans font-semibold text-slate-700 dark:text-zinc-300 px-0.5">
            <span>Band 1 · 1.00 – 1.99</span>
            <span>Band 3 · 2.75 – 3.74 (Target Median)</span>
            <span>Band 5 · 4.50 – 5.00</span>
          </div>
        </div>

        {/* 5 Rating Band KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {RATING_BANDS.map((b) => {
            const count = bandCounts[b.label] || 0
            const pct = filteredItems.length > 0 ? Math.round((count / filteredItems.length) * 100) : 0
            const hasEvaluations = count > 0

            return (
              <div
                key={b.band}
                className={`rounded-2xl p-4 sm:p-4.5 border transition-all relative overflow-hidden flex flex-col justify-between space-y-3.5 group shadow-2xs hover:shadow-md ${
                  hasEvaluations
                    ? 'bg-white dark:bg-white/[0.04] border-slate-300/90 dark:border-white/15 hover:border-slate-400 dark:hover:border-white/30 text-slate-900 dark:text-white ring-1 ring-slate-900/5 dark:ring-white/5'
                    : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-900 dark:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <span className="text-[10px] font-sans font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
                    {b.band}
                  </span>
                  <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.08] text-slate-800 dark:text-zinc-200 border border-slate-300/80 dark:border-white/10">
                    {b.min.toFixed(1)} – {b.max.toFixed(2)}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate leading-snug">
                    {b.label}
                  </h3>
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                      {count}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">evals</span>
                  </div>

                  {hasEvaluations ? (
                    <span className="text-[11px] font-sans font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs">
                      {pct}%
                    </span>
                  ) : (
                    <span className="text-[11px] font-sans font-semibold text-slate-700 dark:text-zinc-300 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                      0%
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="w-full bg-slate-200 dark:bg-zinc-800 border border-slate-300/80 dark:border-zinc-700 rounded-full h-2 overflow-hidden p-[1px]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: b.color }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-sans text-slate-700 dark:text-zinc-300">
                    <span className="font-medium">Cohort share</span>
                    <span className="font-bold text-slate-900 dark:text-white">{count} of {filteredItems.length}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Search & Filters Single-Line Bar (No Card Wrapper: Equal Heights & Balanced Widths) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
        {/* Left: Department & Status Segmented Controls */}
        <div className="flex flex-wrap items-center gap-2.5 overflow-x-auto scrollbar-none py-0.5">
          <RubberSegmentedControl
            options={[
              { value: 'all', label: 'All Departments', count: items.length },
              {
                value: 'Engineering',
                label: 'Engineering',
                count: items.filter((i) => i.employee?.department === 'Engineering').length,
              },
              {
                value: 'Product & Design',
                label: 'Product & Design',
                count: items.filter((i) => i.employee?.department === 'Product & Design').length,
              },
            ]}
            value={deptFilter}
            onChange={setDeptFilter}
            size="sm"
          />

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.05] p-1 rounded-full border border-slate-200/80 dark:border-white/10 text-xs font-sans h-8.5 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`h-6.5 px-3 rounded-full transition-all cursor-pointer font-medium text-xs flex items-center justify-center ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Status ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`h-6.5 px-3 rounded-full transition-all cursor-pointer font-medium text-xs flex items-center justify-center ${
                statusFilter === 'pending'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Awaiting Permission ({pendingCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('approved')}
              className={`h-6.5 px-3 rounded-full transition-all cursor-pointer font-medium text-xs flex items-center justify-center ${
                statusFilter === 'approved'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Approved ({approvedCount})</span>
            </button>
          </div>
        </div>

        {/* Right: Compact Search Input (Matching h-8.5 height & rounded-full capsule geometry) */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto sm:justify-end min-w-0">
          <div className="relative flex-1 sm:flex-initial sm:w-52 md:w-60 min-w-0 flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 absolute left-3 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff, evidence..."
              className="w-full h-8.5 pl-9 pr-8 rounded-full bg-white dark:bg-[#18181b] border border-slate-200/90 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-400 dark:focus:border-white/30 transition-all font-sans shadow-2xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2.5 pointer-events-none px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 text-[10px] font-mono text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-white/[0.06] hidden sm:inline-block">
                /
              </kbd>
            )}
          </div>
        </div>
      </div>

      {/* Calibration Table Container with Wireless Mouse Wheel & Drag Panning Architecture */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md overflow-hidden transition-all">
        {/* Table Controls Bar with Left/Right Quick Scroll Navigation */}
        <div className="px-4 py-2 bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-sans">
          <span className="flex items-center gap-1.5 font-medium">
            <span>Scroll using wireless mouse wheel or click-and-drag table</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollTable('left')}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer shadow-2xs"
              title="Scroll table left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollTable('right')}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer shadow-2xs"
              title="Scroll table right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          ref={tableContainerRef}
          onWheel={handleTableWheel}
          onMouseDown={handleTableMouseDown}
          className="overflow-x-auto table-scrollbar w-full cursor-grab active:cursor-grabbing pb-1 select-none"
        >
          <table className="w-full min-w-[1020px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.12] text-slate-900 dark:text-white uppercase tracking-wider text-xs font-bold font-sans whitespace-nowrap select-none">
                <th className="py-3.5 px-4 min-w-[200px]">Employee</th>
                <th className="py-3.5 px-3 min-w-[170px]">Manager Appraisal</th>
                <th className="py-3.5 px-3 min-w-[170px]">Evaluation Evidence</th>
                <th className="py-3.5 px-3 min-w-[180px]">Calibrated Outcome</th>
                <th className="py-3.5 px-3 min-w-[170px]">Admin Permission Gate</th>
                <th className="py-3.5 px-4 min-w-[180px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-slate-800 dark:text-zinc-200">
              {loading ? (
                <LoadingState message="Loading calibration committee roster..." variant="table" colSpan={6} />
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-zinc-400 font-sans">
                    No evaluations match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const hasCalibration = !!item.calibrationRecord
                  const isModified =
                    hasCalibration &&
                    Math.abs(item.calibrationRecord!.originalScore - item.calibrationRecord!.adjustedScore) > 0.01

                  return (
                    <tr
                      key={item.employee.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors group"
                    >
                      {/* Employee Cell */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.employee.avatar}
                            alt={item.employee.name}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200/80 dark:ring-white/10 shrink-0 shadow-2xs"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm leading-tight">
                              <span>{item.employee.name}</span>
                              {item.employee.employeeCode && (
                                <span className="text-[10px] font-sans text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded border border-slate-200/70 dark:border-white/10">
                                  #{item.employee.employeeCode}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1">
                              <span>{item.employee.designation}</span>
                              <span className="opacity-40">•</span>
                              <span>{item.employee.department}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Manager Appraisal Cell */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-zinc-100 text-xs">
                              {item.manager.name}
                            </span>
                            <span className="font-sans font-bold text-slate-800 dark:text-zinc-200 text-xs bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded border border-slate-200/60 dark:border-white/10">
                              {item.managerReview.compositeScore.toFixed(2)} / 5.0
                            </span>
                          </div>
                          <div className="text-[10.5px] font-sans text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                            <span>Goals {item.managerReview.goalsScore.toFixed(1)}</span>
                            <span>•</span>
                            <span>Comp {item.managerReview.competenciesScore.toFixed(1)}</span>
                            <span>•</span>
                            <span>Values {item.managerReview.valuesScore.toFixed(1)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Evidence & PDF Cell */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {item.allEvidence && item.allEvidence.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => openReviewModal(item, 'dossier')}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 text-xs font-sans font-medium transition-colors cursor-pointer group/pdf"
                            title="Inspect all uploaded evidence files across all goals"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-400 group-hover/pdf:text-slate-600 dark:text-zinc-400 dark:group-hover/pdf:text-zinc-200 shrink-0" />
                            <span className="font-mono text-[11px] truncate max-w-[130px]">
                              {item.allEvidence.length === 1
                                ? item.allEvidence[0].fileName
                                : `${item.allEvidence.length} Evidence Files`}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-300/60 dark:border-zinc-700/60">
                              {item.allEvidence.some((e) => e.isPdf) && item.allEvidence.some((e) => e.isImage)
                                ? 'PDF+IMG'
                                : item.allEvidence.some((e) => e.isPdf)
                                ? 'PDF'
                                : item.allEvidence.some((e) => e.isImage)
                                ? 'IMG'
                                : 'DOC'}
                            </span>
                            <Eye className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 ml-0.5 group-hover/pdf:text-slate-700 dark:group-hover/pdf:text-zinc-300 transition-colors" />
                          </button>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500 text-xs italic pl-1">
                            No evidence
                          </span>
                        )}
                      </td>

                      {/* Calibrated Outcome Cell */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="font-sans font-bold text-slate-900 dark:text-white text-sm">
                              {item.currentScore.toFixed(2)}
                            </span>
                            {isModified && (
                              <span className="text-[10px] font-mono font-medium text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-1.5 py-0.5 rounded">
                                Adjusted
                              </span>
                            )}
                            <RatingBadge score={item.currentScore} />
                          </div>
                          {hasCalibration && item.calibrationRecord?.reason && (
                            <div
                              className="text-[11px] text-slate-500 dark:text-zinc-400 italic truncate max-w-[240px]"
                              title={item.calibrationRecord.reason}
                            >
                              "{item.calibrationRecord.reason}"
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Admin Permission Gate Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {item.adminApproved ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 border border-transparent font-sans">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approved & Released</span>
                            </span>
                            <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-sans pl-1">
                              {item.adminApprovedAt ? formatDate(item.adminApprovedAt) : 'Stage 7 Released'}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-zinc-850 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 font-sans">
                              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                              <span>Awaiting Permission</span>
                            </span>
                            <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-sans pl-1">
                              Held at Stage 6
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openReviewModal(item, 'dossier')}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white hover:bg-slate-50 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer whitespace-nowrap group/btn"
                            title="Inspect employee self-evaluation, manager review, and evidence PDF"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 group-hover/btn:text-slate-900 dark:group-hover/btn:text-white transition-colors" />
                            <span>Review Dossier</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openReviewModal(item, 'calibrate')}
                            className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg font-medium text-xs transition-colors cursor-pointer whitespace-nowrap ${
                              item.adminApproved
                                ? 'border border-slate-200 dark:border-zinc-800 bg-slate-100 hover:bg-slate-200/70 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200'
                                : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 opacity-80" />
                            <span>{item.adminApproved ? 'Re-calibrate' : 'Calibrate & Permit'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination / Results count under cards/table */}
      <div className="flex items-center justify-end pt-1 pb-1 text-xs text-slate-500 dark:text-zinc-400 font-sans">
        <span>Showing {filteredItems.length} of {items.length} staff</span>
      </div>

      {/* Comprehensive Evaluation Dossier & Calibration Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title={activeTab === 'dossier' ? 'Employee Evaluation & Review Dossier' : 'Calibrate & Grant Permission'}
        subtitle={
          selectedItem
            ? `${selectedItem.employee.name} (${selectedItem.employee.designation}) • Manager: ${selectedItem.manager.name} • Review Cycle: ${selectedItem.cycleName || activeCycle.name}`
            : ''
        }
        maxWidth="2xl"
        footer={
          selectedItem ? (
            activeTab === 'calibrate' ? (
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-xs font-medium"
                >
                  Close
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="submit"
                    form="calibration-form"
                    disabled={isProcessing}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-medium cursor-pointer transition-colors"
                  >
                    {isProcessing ? 'Saving...' : 'Save Draft Only'}
                  </button>

                  <button
                    type="button"
                    onClick={handleApproveAndPermit}
                    disabled={isProcessing}
                    className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 font-semibold text-xs cursor-pointer inline-flex items-center gap-2 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 opacity-80" />
                    <span>{isProcessing ? 'Granting...' : 'Approve & Grant Permission to Next Step'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => openEvidencePdf(selectedItem)}
                  className="inline-flex items-center gap-1.5 text-xs font-sans font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Primary Evidence in Full Viewer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('calibrate')}
                  className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 font-semibold text-xs cursor-pointer inline-flex items-center gap-2 transition-colors"
                >
                  <span>Proceed to Calibration & Permission Gate</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )
          ) : null
        }
      >
        {selectedItem && (
          <div className="space-y-5">
            {/* Sticky Header Tabs & Governance Bar */}
            <div className="sticky -top-4 sm:-top-6 z-20 bg-white dark:bg-[#18181b] pt-0 pb-3 -mt-1 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-slate-100 dark:border-zinc-800 space-y-3">
              {/* Review Cycle & Governance Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 sm:p-3.5 rounded-xl bg-slate-100/90 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-sans">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-400">
                    Review Cycle
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedItem.cycleName || activeCycle.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-400">
                  <span className="font-medium text-slate-800 dark:text-zinc-200">{selectedItem.employee.department}</span>
                  <span>•</span>
                  <span>Code #{selectedItem.employee.employeeCode || 'EMP-001'}</span>
                </div>
              </div>

              {/* Top Navigation Tabs */}
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('dossier')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold font-sans transition-all cursor-pointer inline-flex items-center gap-2 ${
                    activeTab === 'dossier'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Evaluation Dossier & PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('calibrate')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold font-sans transition-all cursor-pointer inline-flex items-center gap-2 ${
                    activeTab === 'calibrate'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 opacity-80" />
                  <span>Calibration & Permission Gate</span>
                </button>
              </div>

              {selectedItem.adminApproved ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 border border-transparent font-sans">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Permission Granted</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-zinc-850 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 font-sans">
                  <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                  <span>Pending Admin Release</span>
                </span>
              )}
              </div>
            </div>

            {/* TAB 1: Evaluation Dossier & Evidence PDF */}
            {activeTab === 'dossier' && (
              <div className="space-y-5">
                {/* 1. All Performance Goals & Attached Evidence */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-sans flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span>Performance Goals & Evidence ({selectedItem.goals.length} Goals)</span>
                    </h4>
                    <span className="text-[11px] font-sans text-slate-500 dark:text-zinc-400">
                      {selectedItem.allEvidence.length} total evidence file{selectedItem.allEvidence.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {selectedItem.goals.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 text-center text-xs text-slate-500 dark:text-zinc-400">
                      No performance goals registered for this cycle.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {selectedItem.goals.map((goal, gIdx) => {
                        const goalEvidenceList = (selectedItem.allEvidence || []).filter(
                          (e) => e.goalId === goal.id
                        )

                        return (
                          <div
                            key={goal.id}
                            className="p-4 rounded-2xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-3"
                          >
                            {/* Goal Header */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-100 dark:border-white/[0.06] pb-2.5">
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                                    Goal #{gIdx + 1}
                                  </span>
                                  <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-400">
                                    Weight: {goal.weight}%
                                  </span>
                                  <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-400">
                                    Progress: {goal.progress}%
                                  </span>
                                  <span
                                    className={`text-[10px] font-sans font-semibold uppercase px-2 py-0.5 rounded-full ${
                                      goal.status === 'approved' || goal.status === 'completed'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : goal.status === 'returned'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                        : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                                    }`}
                                  >
                                    {goal.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <h5 className="font-bold text-slate-900 dark:text-white text-sm">
                                  {goal.title}
                                </h5>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                  Metric: <span className="font-semibold text-slate-700 dark:text-zinc-300">{goal.metric}</span> • Target: <span className="font-semibold text-slate-700 dark:text-zinc-300">{goal.target} {goal.unit}</span>
                                </p>
                              </div>
                            </div>

                            {/* Goal-Specific Manager Revision Feedback if applicable */}
                            {goal.returnReason && (
                              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200">
                                <span className="font-bold block mb-0.5">Manager Feedback & Revision Request:</span>
                                <span>"{goal.returnReason}"</span>
                              </div>
                            )}

                            {/* Uploaded Evidence for this Goal */}
                            <div className="space-y-2 pt-0.5">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                                Attached Evidence ({goalEvidenceList.length})
                              </span>

                              {goalEvidenceList.length === 0 ? (
                                <p className="text-xs text-slate-400 dark:text-zinc-500 italic pl-1">
                                  No evidence files attached to this goal.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 gap-2">
                                  {goalEvidenceList.map((ev) => {
                                    const cleanUrl = ev.fileUrl ? ev.fileUrl.split('#name=')[0] : ''
                                    return (
                                      <div
                                        key={ev.id}
                                        className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                      >
                                        <div className="flex items-start gap-3 min-w-0">
                                          {/* Image thumbnail or document badge */}
                                          {ev.isImage && cleanUrl ? (
                                            <img
                                              src={cleanUrl}
                                              alt={ev.fileName}
                                              onClick={() => openEvidencePdf(selectedItem, ev)}
                                              className="w-12 h-12 rounded-lg object-cover border border-slate-300 dark:border-zinc-700 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                                              title="Click to preview image"
                                            />
                                          ) : (
                                            <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-zinc-300 font-bold text-xs">
                                              {ev.isPdf ? 'PDF' : <FileText className="w-5 h-5" />}
                                            </div>
                                          )}

                                          <div className="min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate max-w-[240px] sm:max-w-[320px]">
                                                {ev.fileName}
                                              </span>
                                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold uppercase">
                                                {ev.isImage ? 'IMAGE' : ev.isPdf ? 'PDF' : 'DOC'}
                                              </span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                                              <span>{ev.fileSize || 'Attached deliverable'}</span>
                                              {ev.uploadedAt && (
                                                <>
                                                  <span>•</span>
                                                  <span>{ev.uploadedAt.split('T')[0]}</span>
                                                </>
                                              )}
                                            </div>
                                            {ev.note && (
                                              <p className="text-[11px] text-slate-600 dark:text-zinc-400 italic">
                                                "{ev.note}"
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                          <button
                                            type="button"
                                            onClick={() => openEvidencePdf(selectedItem, ev)}
                                            className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>View {ev.isImage ? 'Image' : 'Document'}</span>
                                          </button>

                                          {cleanUrl && (
                                            <button
                                              type="button"
                                              onClick={() => handleDownloadFile(ev.fileName, ev.fileUrl)}
                                              className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer inline-flex items-center gap-1 transition-colors"
                                              title="Download evidence file"
                                            >
                                              <Download className="w-3.5 h-3.5" />
                                              <span className="hidden sm:inline">Download</span>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Employee Self-Review Reflection */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-sans">
                        Employee Self-Evaluation Submission
                      </h4>
                    </div>
                    {selectedItem.selfReview?.overallRating && (
                      <span className="text-xs font-sans font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
                        Self-Rating: {selectedItem.selfReview.overallRating.toFixed(1)} / 5.0
                      </span>
                    )}
                  </div>

                  {selectedItem.selfReview ? (
                    <div className="space-y-3 text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
                      <div>
                        <span className="text-[11px] font-sans font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                          Overall Reflection
                        </span>
                        <p className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/10 italic">
                          "{selectedItem.selfReview.overallReflection || 'Self-evaluation submitted.'}"
                        </p>
                      </div>

                      {selectedItem.selfReview.achievements && (
                        <div>
                          <span className="text-[11px] font-sans font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                            Key Achievements & Deliverables
                          </span>
                          <p className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/10">
                            {selectedItem.selfReview.achievements}
                          </p>
                        </div>
                      )}

                      {selectedItem.selfReview.challenges && (
                        <div>
                          <span className="text-[11px] font-sans font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                            Challenges & Architectural Solutions
                          </span>
                          <p className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/10">
                            {selectedItem.selfReview.challenges}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 italic">
                      Standard performance metrics registered for active cycle objectives.
                    </p>
                  )}
                </div>

                {/* 3. Manager Evaluation & Narrative Remarks */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-sans">
                        Manager Appraisal by {selectedItem.manager.name}
                      </h4>
                    </div>
                    <span className="text-xs font-sans font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-white border border-slate-300 dark:border-zinc-700">
                      Composite: {selectedItem.managerReview.compositeScore.toFixed(2)} / 5.0
                    </span>
                  </div>

                  {/* Score breakdown pillars */}
                  <div className="grid grid-cols-3 gap-2.5 text-center font-sans text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 block uppercase">Goals (50%)</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {selectedItem.managerReview.goalsScore.toFixed(2)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 block uppercase">Competencies (30%)</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {selectedItem.managerReview.competenciesScore.toFixed(2)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 block uppercase">Values (20%)</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {selectedItem.managerReview.valuesScore.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Manager narrative */}
                  <div className="space-y-3 text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
                    <div>
                      <span className="text-[11px] font-sans font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                        Executive Manager Assessment
                      </span>
                      {selectedItem.managerReview.overallComments?.trim() ? (
                        <p className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/10 italic text-slate-900 dark:text-white">
                          "{selectedItem.managerReview.overallComments}"
                        </p>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/10 text-slate-400 dark:text-zinc-500 italic">
                          Not provided
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[11px] font-sans font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                        Core Strengths
                      </span>
                      {selectedItem.managerReview.strengths?.trim() ? (
                        <p className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white">
                          {selectedItem.managerReview.strengths}
                        </p>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/10 text-slate-400 dark:text-zinc-500 italic">
                          Not provided
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[11px] font-sans font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                        Growth & Development Opportunities
                      </span>
                      {selectedItem.managerReview.growthAreas?.trim() ? (
                        <p className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white">
                          {selectedItem.managerReview.growthAreas}
                        </p>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/10 text-slate-400 dark:text-zinc-500 italic">
                          Not provided
                        </div>
                      )}
                    </div>

                    {/* Recommendations */}
                    <div className="pt-1">
                      <span className="text-[11px] font-sans font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1.5">
                        Manager Recommendations
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedItem.managerReview.recommendations?.promotion && (
                          <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold">
                            Promotion Recommended
                          </span>
                        )}
                        {selectedItem.managerReview.recommendations?.increment && (
                          <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                            Merit Salary Increment
                          </span>
                        )}
                        {selectedItem.managerReview.recommendations?.bonus && (
                          <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold">
                            Performance Bonus
                          </span>
                        )}
                        {selectedItem.managerReview.recommendations?.training && (
                          <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
                            Advanced Training Track
                          </span>
                        )}
                        {!selectedItem.managerReview.recommendations?.promotion &&
                          !selectedItem.managerReview.recommendations?.increment &&
                          !selectedItem.managerReview.recommendations?.bonus &&
                          !selectedItem.managerReview.recommendations?.training && (
                            <span className="text-slate-400 dark:text-zinc-500 italic">
                              No specific promotions or increments marked
                            </span>
                          )}
                      </div>
                      {selectedItem.managerReview.recommendations?.notes && (
                        <p className="mt-2 p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300">
                          Notes: {selectedItem.managerReview.recommendations.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: Calibration & Permission Gate */}
            {activeTab === 'calibrate' && (
              <form id="calibration-form" onSubmit={handleSaveDraft} className="space-y-5 text-xs font-sans">
                {/* Contextual Appraisal and Evidence Briefing */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400">Review Cycle</span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedItem.cycleName || activeCycle.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('dossier')}
                      className="text-xs font-semibold text-slate-900 dark:text-white underline hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>Inspect Full Dossier ({selectedItem.goals.length} Goals • {selectedItem.allEvidence.length} Files) →</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-lg bg-white dark:bg-zinc-850 border border-slate-200/80 dark:border-zinc-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block mb-1">
                        Manager Narrative ({selectedItem.manager.name})
                      </span>
                      <p className="text-slate-800 dark:text-zinc-200 italic line-clamp-2">
                        {selectedItem.managerReview.overallComments || 'Not provided'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-zinc-850 border border-slate-200/80 dark:border-zinc-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block mb-1">
                        Core Strengths Highlighted
                      </span>
                      <p className="text-slate-800 dark:text-zinc-200 line-clamp-2">
                        {selectedItem.managerReview.strengths || 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Score Comparison Header */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <span className="text-slate-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">
                      Original Manager Score
                    </span>
                    <span className="text-base font-sans font-bold text-slate-800 dark:text-white">
                      {selectedItem.managerReview.compositeScore.toFixed(2)} / 5.00
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">
                        Calibrated Outcome
                      </span>
                      <span className="text-base font-sans font-bold text-slate-900 dark:text-white">
                        {adjustedScore.toFixed(2)} / 5.00
                      </span>
                    </div>
                  </div>

                  <RatingBadge score={adjustedScore} />
                </div>

                {/* Score Slider & Input */}
                <div>
                  <RatingInput
                    label="Calibrated Final Score (1.0 to 5.0)"
                    value={adjustedScore}
                    onChange={setAdjustedScore}
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                    <span>Selected Band: <strong className="text-slate-900 dark:text-white">{previewBand.label}</strong></span>
                    <span>Range: {previewBand.min.toFixed(1)} – {previewBand.max.toFixed(2)}</span>
                  </div>
                </div>

                {/* Committee Consensus Textarea */}
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-200 block mb-1">
                    Committee Justification & Rationale *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={calibrationReason}
                    onChange={(e) => setCalibrationReason(e.target.value)}
                    placeholder="e.g. Committee consensus: Verified against attached latency telemetry PDF. Outstanding achievement exceeding the 20% latency reduction benchmark..."
                    className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-400/30 dark:focus:ring-zinc-600/30 focus:border-slate-400 dark:focus:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-sans text-xs"
                  />
                </div>

                {/* Status Callout */}
                {selectedItem.adminApproved ? (
                  <div className="p-3.5 rounded-xl bg-slate-100/90 dark:bg-zinc-850/80 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-slate-700 dark:text-zinc-300 shrink-0" />
                      <span>
                        This evaluation is currently <strong>Approved & Published</strong>. The employee has immediate access to their outcome.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setItemToRevoke(selectedItem)
                        setShowRevokeConfirm(true)
                      }}
                      className="px-3 py-1 rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-medium cursor-pointer shrink-0"
                    >
                      Revoke Permission
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center gap-2 text-xs">
                    <Clock className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
                    <span>
                      <strong>Held at Stage 6 (Calibration)</strong>: Results will NOT be revealed to {selectedItem.employee.name} until you grant formal Admin permission below.
                    </span>
                  </div>
                )}

              </form>
            )}
          </div>
        )}
      </Modal>

      {/* PDF Viewer Full Screen Modal */}
      {pdfMeta && (
        <PdfViewerModal
          isOpen={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          fileName={pdfMeta.fileName}
          fileUrl={pdfMeta.fileUrl}
          title={pdfMeta.title}
          authorName={pdfMeta.authorName || 'Deepak'}
          goalTitle={pdfMeta.goalTitle}
        />
      )}

      {/* Batch Release Cycle Confirmation */}
      <ConfirmDialog
        isOpen={showReleaseConfirm}
        onClose={() => setShowReleaseConfirm(false)}
        onConfirm={handleReleaseCycle}
        title="Approve & Release All Evaluations?"
        message={`Are you sure you want to grant Admin permission and release all ${pendingCount} pending employee evaluations for ${activeCycle.name}? This will transition the cycle to Stage 7 (Results Released) and publish official calibrated scores and comments to all employees immediately.`}
        confirmText="Yes, Grant Permission & Release All"
      />

      {/* Revoke Permission Confirmation */}
      <ConfirmDialog
        isOpen={showRevokeConfirm}
        onClose={() => setShowRevokeConfirm(false)}
        onConfirm={handleRevokePermission}
        title="Revoke Admin Permission?"
        message={`Are you sure you want to revoke release permission for ${itemToRevoke?.employee.name}? Their evaluation will be sealed and held back at Stage 6 (Calibration), and will not be visible on their employee dashboard until approved again.`}
        confirmText="Revoke Permission"
      />
    </div>
  )
}
