import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { calibrationService } from '../../services'
import { CalibrationItem } from '../../services/mock/calibrationService'
import { RatingBadge } from '../../components/ui/Badge'
import { RatingInput } from '../../components/ui/RatingInput'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { CustomDropdown } from '../../components/ui/CustomDropdown'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { RATING_BANDS } from '../../lib/scoring'
import { formatDate } from '../../lib/formatters'
import { AnimatedSearchBar } from '../../components/ui/AnimatedSearchBar'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Edit2,
  FileCheck,
  Filter,
  Layers,
  Lock,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sliders,
  Sparkles,
} from 'lucide-react'

export const AdminCalibration: React.FC = () => {
  const { activeCycle, currentUser, refreshData } = useApp()
  const { success, error, warning } = useToast()
  const navigate = useNavigate()

  const [items, setItems] = useState<CalibrationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  // Calibration Modal
  const [showCalModal, setShowCalModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CalibrationItem | null>(null)
  const [adjustedScore, setAdjustedScore] = useState<number>(4.0)
  const [calibrationReason, setCalibrationReason] = useState<string>('')
  const [isCalibrating, setIsCalibrating] = useState(false)

  // Release Cycle Modal
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false)
  const [isReleasing, setIsReleasing] = useState(false)

  const fetchItems = async () => {
    setLoading(true)
    const data = await calibrationService.listForCycle(activeCycle.id)
    setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchItems()
  }, [activeCycle.id])

  const openCalibrateModal = (item: CalibrationItem) => {
    setSelectedItem(item)
    setAdjustedScore(item.currentScore)
    setCalibrationReason(item.calibrationRecord?.reason || '')
    setShowCalModal(true)
  }

  const handleSaveCalibration = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return
    if (!calibrationReason.trim() || calibrationReason.trim().length < 10) {
      error(
        'Reason required',
        'Please provide a thorough justification for the calibration committee consensus (at least 10 characters).'
      )
      return
    }

    setIsCalibrating(true)
    try {
      await calibrationService.calibrate(
        activeCycle.id,
        selectedItem.employee.id,
        adjustedScore,
        calibrationReason,
        currentUser.name
      )

      success(
        'Score calibrated',
        `Adjusted ${selectedItem.employee.name}'s score to ${adjustedScore.toFixed(2)} with committee consensus.`
      )
      setShowCalModal(false)
      await refreshData()
      fetchItems()
    } catch (err: any) {
      error('Calibration failed', err.message)
    } finally {
      setIsCalibrating(false)
    }
  }

  const handleReleaseCycle = async () => {
    setIsReleasing(true)
    try {
      const res = await calibrationService.releaseCycle(activeCycle.id)
      success(
        'Results Released Successfully!',
        `Released ${res.releasedCount} employee evaluations. Results are now immediately visible to individual employees.`
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

  const filteredItems = items.filter((item) => {
    if (deptFilter !== 'all' && item.employee.department !== deptFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const empMatch = item.employee?.name?.toLowerCase().includes(q)
      const titleMatch = item.employee?.designation?.toLowerCase().includes(q)
      const mgrMatch = item.manager?.name?.toLowerCase().includes(q)
      if (!empMatch && !titleMatch && !mgrMatch) return false
    }
    return true
  })

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

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Calibration Committee Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Cross-department rating normalization, quota benchmarks & compensation alignment
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isCalibrationStage && (
            <button
              type="button"
              onClick={() => setShowReleaseConfirm(true)}
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-black font-semibold text-xs sm:text-sm cursor-pointer inline-flex items-center gap-2 shadow-xs transition-all border border-transparent dark:border-white/10 shrink-0 self-start sm:self-auto"
            >
              <Send className="w-4 h-4 text-indigo-600 dark:text-[#4FE3C1]" />
              <span>Release Cycle to Employees ({items.length})</span>
            </button>
          )}

          {isReleased && (
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/90 dark:bg-emerald-500/10 dark:text-[#4FE3C1] dark:border-emerald-500/25 text-xs font-mono font-medium">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-[#4FE3C1]" />
              <span>Cycle Results Released</span>
            </span>
          )}
        </div>
      </div>

      {/* Stage Notice Banner if not in calibration */}
      {!isCalibrationStage && !isReleased && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-[#FFB454] flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-[#FFB454] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Cycle is currently in the "{activeCycle.stage.replace('_', ' ')}" stage.
              </p>
              <p className="text-amber-800/80 dark:text-zinc-400 mt-1">
                Official score adjustments are enacted during the "Calibration" stage. You can advance the cycle stage in Review Cycles.
              </p>
            </div>
          </div>
          <Link
            to={`/admin/cycles/${activeCycle.id}`}
            className="text-xs font-mono font-bold text-amber-900 dark:text-[#FFB454] underline flex-shrink-0 hover:text-amber-700 dark:hover:text-white transition-colors"
          >
            Advance to Calibration →
          </Link>
        </div>
      )}

      {/* Rating Distribution Visualizer (Unified 2-Color Linear / Stripe Standard) */}
      <div className="rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md space-y-6 relative overflow-hidden transition-colors">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-emerald-500/15 flex items-center justify-center text-indigo-600 dark:text-[#4FE3C1]">
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                RATING DISTRIBUTION BENCHMARKS
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Cross-Department Calibration Distribution
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              Target quota benchmarks vs actual manager submitted ratings across active cohorts
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-xs font-mono font-medium text-slate-700 dark:text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-[#4FE3C1] live-dot-pulse" />
              <span>{filteredItems.length} Evaluations</span>
            </span>
          </div>
        </div>

        {/* Proportional Segmented Spectrum Bar (Unified 2-Color Palette) */}
        <div className="space-y-2">
          <div className="w-full h-2.5 rounded-full overflow-hidden p-0.5 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] flex items-center gap-1">
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
                    className="h-full rounded-full bg-indigo-600 dark:bg-[#4FE3C1] transition-all duration-500 opacity-90 hover:opacity-100"
                    style={{ width: `${pct}%` }}
                    title={`${b.label}: ${count} (${pct}%)`}
                  />
                )
              })
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 dark:text-zinc-500 px-0.5">
            <span>Band 1 • 1.00–1.99</span>
            <span>Band 3 • 2.75–3.74 (Target Median)</span>
            <span>Band 5 • 4.50–5.00</span>
          </div>
        </div>

        {/* 5 Rating Band KPI Cards (Disciplined 2-Color Architecture) */}
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
                    ? 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-900 dark:text-white'
                    : 'bg-slate-50/50 dark:bg-white/[0.015] border-slate-100 dark:border-white/[0.05] text-slate-400 dark:text-zinc-400 opacity-75'
                }`}
              >
                {/* Top Row: Band Identifier & Score Range */}
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-400 dark:text-zinc-500">
                    {b.band}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.08]">
                    {b.min.toFixed(1)}–{b.max.toFixed(2)}
                  </span>
                </div>

                {/* Rating Band Title */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white truncate leading-snug">
                    {b.label}
                  </h3>
                </div>

                {/* Hero Number + Unit + Percentage Capsule */}
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                      {count}
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-zinc-500">
                      evals
                    </span>
                  </div>

                  {hasEvaluations ? (
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/90 dark:bg-emerald-500/15 dark:text-[#4FE3C1] dark:border-emerald-500/30">
                      {pct}%
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06]">
                      0%
                    </span>
                  )}
                </div>

                {/* Progress Bar (Monochrome Track + Emerald Accent) */}
                <div className="space-y-1.5 pt-1">
                  <div className="w-full bg-slate-200 dark:bg-white/[0.08] rounded-full h-1.5 overflow-hidden p-[1px]">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-indigo-600 dark:bg-[#4FE3C1]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Cohort Footnote */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                    <span>Cohort share</span>
                    <span>{count} of {filteredItems.length}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Search and Filters Toolbar (Matching Linear / Vercel Pattern) */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Department Rubber Segmented Control */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
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
          </div>

          {/* Search Input with Shortcut Badge */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72 lg:w-80">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search calibrated staff, manager..."
                className="w-full h-10 pl-10 pr-10 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-400 dark:focus:border-white/30 transition-all font-sans"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-white/10 text-[10px] font-mono text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-white/[0.06]">
                /
              </div>
            </div>

            <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px] shrink-0 hidden sm:inline">
              Showing {filteredItems.length} of {items.length} staff
            </span>
          </div>
        </div>
      </div>

      {/* Calibration Table */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md overflow-hidden transition-all">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] font-mono">
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Manager</th>
                <th className="py-3.5 px-4">Original Manager Score</th>
                <th className="py-3.5 px-4">Calibrated Score</th>
                <th className="py-3.5 px-4">Rating Outcome</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-slate-800 dark:text-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 dark:text-zinc-400 font-mono">
                    Loading calibration roster...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 dark:text-zinc-400 font-mono">
                    No submitted reviews ready for calibration in this department filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const hasCalibration = !!item.calibrationRecord
                  const isModified =
                    hasCalibration &&
                    Math.abs(item.calibrationRecord!.originalScore - item.calibrationRecord!.adjustedScore) > 0.01

                  return (
                    <tr key={item.employee.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.employee.avatar}
                            alt={item.employee.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10"
                          />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{item.employee.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400">{item.employee.designation}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 dark:text-zinc-200">{item.manager.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400">{item.employee.department}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-zinc-200">
                        {item.managerReview.compositeScore.toFixed(2)} / 5.0
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-slate-900 dark:text-white text-sm">
                            {item.currentScore.toFixed(2)}
                          </span>
                          {isModified && (
                            <span className="text-[10px] font-mono font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/90 dark:text-[#4FE3C1] dark:bg-emerald-500/15 dark:border-emerald-500/30 px-1.5 py-0.5 rounded">
                              Adjusted
                            </span>
                          )}
                        </div>
                        {hasCalibration && (
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400 italic mt-0.5 truncate max-w-xs">
                            "{item.calibrationRecord!.reason}"
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <RatingBadge score={item.currentScore} />
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openCalibrateModal(item)}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 font-medium text-xs transition-all cursor-pointer shadow-2xs group"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
                          <span>Calibrate</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calibration Modal */}
      <Modal
        isOpen={showCalModal}
        onClose={() => setShowCalModal(false)}
        title="Calibrate Employee Evaluation"
        subtitle={`Adjust outcome for ${selectedItem?.employee.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveCalibration} className="space-y-4 text-xs font-mono">
          <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-slate-400 dark:text-[#8D96AA] text-[10px] uppercase font-bold block">
                Original Manager Score
              </span>
              <span className="text-sm font-mono font-extrabold text-slate-800 dark:text-white">
                {selectedItem?.managerReview.compositeScore.toFixed(2)} / 5.00
              </span>
            </div>
            <RatingBadge score={selectedItem?.managerReview.compositeScore || 3.0} />
          </div>

          <div>
            <RatingInput
              label="Calibrated Final Score (1.0 to 5.0)"
              value={adjustedScore}
              onChange={setAdjustedScore}
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-[#E6E9F2] block mb-1">
              Committee Justification & Rationale *
            </label>
            <textarea
              rows={4}
              required
              value={calibrationReason}
              onChange={(e) => setCalibrationReason(e.target.value)}
              placeholder="e.g. Committee consensus: Cross-functional design system impact unblocked 4 pods, justifying top-tier performance rating..."
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-white/12 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 dark:focus:ring-[#4FE3C1]/40 focus:border-indigo-500 dark:focus:border-[#4FE3C1] bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-[#8D96AA]"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCalModal(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors cursor-pointer text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCalibrating}
              className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-black font-semibold text-xs cursor-pointer inline-flex items-center gap-2 shadow-xs transition-all border border-transparent dark:border-white/10"
            >
              <FileCheck className="w-4 h-4 text-indigo-600 dark:text-[#4FE3C1]" />
              <span>{isCalibrating ? 'Saving...' : 'Save Calibration'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Release Cycle Confirmation */}
      <ConfirmDialog
        isOpen={showReleaseConfirm}
        onClose={() => setShowReleaseConfirm(false)}
        onConfirm={handleReleaseCycle}
        title="Simulate Release of Evaluation Results?"
        message={`Are you sure you want to release ${items.length} employee evaluation outcomes for ${activeCycle.name}? This will transition the review cycle to "Released" and make finalized scores and manager feedback visible in Employee Results immediately.`}
        confirmText="Release Results Now"
        variant="primary"
        isLoading={isReleasing}
      />
    </div>
  )
}

