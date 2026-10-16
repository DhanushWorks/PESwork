import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { cycleService } from '../../services'
import { ReviewCycle, CycleWeights } from '../../types'
import { CycleStageBadge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { DatePicker } from '../../components/ui/DatePicker'
import { formatDate } from '../../lib/formatters'
import { validateCycleWeights } from '../../lib/validation'
import { AnimatedSearchBar } from '../../components/ui/AnimatedSearchBar'
import {
  ArrowRight,
  Calendar,
  Layers,
  Plus,
  RefreshCw,
  Scale,
} from 'lucide-react'

export const AdminCycles: React.FC = () => {
  const { allCycles, activeCycle, switchActiveCycle, refreshData } = useApp()
  const { success, error, warning } = useToast()
  const navigate = useNavigate()

  const [cycles, setCycles] = useState<ReviewCycle[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Create Cycle Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('2027-01-01')
  const [endDate, setEndDate] = useState('2027-06-30')
  const [goalsWeight, setGoalsWeight] = useState(50)
  const [compWeight, setCompWeight] = useState(30)
  const [valuesWeight, setValuesWeight] = useState(20)

  const fetchCycles = async () => {
    setLoading(true)
    const list = await cycleService.list()
    setCycles(list)
    setLoading(false)
  }

  useEffect(() => {
    fetchCycles()
  }, [])

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault()

    const weights: CycleWeights = {
      goals: Number(goalsWeight),
      competencies: Number(compWeight),
      values: Number(valuesWeight),
    }

    const validation = validateCycleWeights(weights)
    if (!validation.isValid) {
      error('Invalid weights', validation.errors[0])
      return
    }

    try {
      const created = await cycleService.create({
        name,
        description,
        stage: 'draft',
        startDate,
        endDate,
        weights,
        deadlines: {
          goalsDue: `${startDate.substring(0, 7)}-31`,
          selfReviewDue: `${startDate.substring(0, 4)}-03-15`,
          managerReviewDue: `${startDate.substring(0, 4)}-04-05`,
          calibrationDue: `${startDate.substring(0, 4)}-04-20`,
          releaseDate: `${startDate.substring(0, 4)}-04-25`,
        },
      })

      success('Cycle created', `"${name}" was created with a total 100% weight formula.`)
      setShowCreateModal(false)
      await refreshData()
      fetchCycles()
      navigate(`/admin/cycles/${created.id}`)
    } catch (err: any) {
      error('Failed to create cycle', err.message)
    }
  }

  const totalFormWeights = Number(goalsWeight) + Number(compWeight) + Number(valuesWeight)

  const filteredCycles = searchQuery.trim()
    ? cycles.filter((c) => {
        const q = searchQuery.toLowerCase()
        const nameMatch = c.name.toLowerCase().includes(q)
        const descMatch = c.description?.toLowerCase().includes(q)
        const stageMatch = c.stage.toLowerCase().includes(q)
        return nameMatch || descMatch || stageMatch
      })
    : cycles

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* Page Header (Matching Dashboard UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Appraisal Cycles
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Configure performance cycles, evaluation weights & active cohort timelines
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-black font-semibold text-xs sm:text-sm cursor-pointer inline-flex items-center gap-2 shadow-xs transition-all border border-slate-200 dark:border-white/10 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Cycle</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <AnimatedSearchBar
          value={searchQuery}
          onChangeValue={setSearchQuery}
          placeholder="Search appraisal cycles..."
          animatedPlaceholders={[
            'Search cycles by name...',
            'Filter by cycle year...',
            'Search by stage...',
            'Find appraisal cycle...',
          ]}
          variant="pill"
          sizeVariant="default"
        />
        <span className="text-slate-400 dark:text-[#8D96AA] font-mono text-xs">
          Showing {filteredCycles.length} of {cycles.length} cycles
        </span>
      </div>

      {/* Cycles List */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        {filteredCycles.map((c) => {
          const isActive = c.id === activeCycle.id

          return (
            <div
              key={c.id}
              className={`rounded-2xl sm:rounded-3xl p-6 sm:p-7 transition-all duration-300 space-y-5 border bg-white dark:bg-[#18181b] text-slate-900 dark:text-white ${
                isActive
                  ? 'border-indigo-300 dark:border-[#4FE3C1]/30 shadow-md ring-1 ring-indigo-500/10 dark:ring-[#4FE3C1]/10'
                  : 'border-slate-200/90 dark:border-zinc-700/80 hover:border-slate-300 dark:hover:border-zinc-600 shadow-xs'
              }`}
            >
              {/* Top Row: Stage, Active Pill, Date & Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-3 flex-1">
                  {/* Meta Badges */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <CycleStageBadge stage={c.stage} />
                    {isActive && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-emerald-500/15 dark:text-[#4FE3C1] border border-indigo-200/90 dark:border-emerald-500/30 px-3 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-[#4FE3C1] live-dot-pulse" />
                        Active Workspace
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 shrink-0" />
                      <span>{formatDate(c.startDate)} – {formatDate(c.endDate)}</span>
                    </span>
                  </div>

                  {/* Cycle Title */}
                  <div>
                    <Link
                      to={`/admin/cycles/${c.id}`}
                      className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white hover:text-slate-700 dark:hover:text-zinc-200 transition-colors inline-block tracking-tight"
                    >
                      {c.name}
                    </Link>
                  </div>

                  {/* Upgraded Cycle Description (Clean, Readable, Premium Typography) */}
                  <p className="text-sm sm:text-[14.5px] text-slate-600 dark:text-zinc-300 leading-relaxed max-w-3xl font-normal tracking-[-0.012em]">
                    {c.description}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2.5 shrink-0 sm:self-start">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={async () => {
                        await switchActiveCycle(c.id)
                        success('Workspace switched', `Active cycle changed to ${c.name}.`)
                      }}
                      className="h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-xs font-semibold text-slate-700 dark:text-zinc-200 transition-all cursor-pointer shadow-2xs"
                    >
                      Make Active
                    </button>
                  )}

                  <Link
                    to={`/admin/cycles/${c.id}`}
                    className="inline-flex items-center gap-2 h-10 px-4 sm:px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-slate-100 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-xs border border-transparent dark:border-white/10"
                  >
                    <span>Manage Stage</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Evaluation Formula with Segmented Proportional Weight Bar (Stripe & Lattice Pattern) */}
              <div className="pt-4 border-t border-slate-200/90 dark:border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-medium">
                    <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-[#4FE3C1] shrink-0" />
                    <span>Evaluation Component Formula</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-emerald-500/15 dark:text-[#4FE3C1] border border-indigo-200/90 dark:border-emerald-500/30 text-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-[#4FE3C1]" />
                      Goals: {c.weights.goals}%
                    </span>
                    <span className="text-slate-400 dark:text-zinc-600">+</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/10 text-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-zinc-300" />
                      Competencies: {c.weights.competencies}%
                    </span>
                    <span className="text-slate-400 dark:text-zinc-600">+</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/10 text-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-400" />
                      Values: {c.weights.values}%
                    </span>
                    <span className="text-slate-500 dark:text-zinc-400 font-semibold">= 100%</span>
                  </div>
                </div>

                {/* Proportional Mini Segmented Weight Bar */}
                <div className="w-full h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-white/[0.04] flex items-center gap-1 p-0.5 border border-slate-200/80 dark:border-transparent">
                  <div
                    style={{ width: `${c.weights.goals}%` }}
                    className="h-full rounded-full bg-indigo-600 dark:bg-[#4FE3C1] transition-all"
                    title={`Goals: ${c.weights.goals}%`}
                  />
                  <div
                    style={{ width: `${c.weights.competencies}%` }}
                    className="h-full rounded-full bg-slate-400 dark:bg-white/40 transition-all"
                    title={`Competencies: ${c.weights.competencies}%`}
                  />
                  <div
                    style={{ width: `${c.weights.values}%` }}
                    className="h-full rounded-full bg-slate-300 dark:bg-white/20 transition-all"
                    title={`Values: ${c.weights.values}%`}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Create Cycle Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Performance Review Cycle"
        subtitle="Configure duration and weighted appraisal formula"
        maxWidth="lg"
        overflowVisible={true}
      >
        <form onSubmit={handleCreateCycle} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Cycle Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FY27 H1 Performance & Growth Review"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Cycle Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Strategic themes, focus goals, and guidelines for this cohort..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <DatePicker
                label="Cycle Start Date"
                required
                value={startDate}
                onChange={(val) => setStartDate(val)}
              />
            </div>
            <div>
              <DatePicker
                label="Cycle End Date"
                required
                value={endDate}
                onChange={(val) => setEndDate(val)}
                align="right"
              />
            </div>
          </div>

          {/* Component Weights */}
          <div className="p-3 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-slate-800 dark:text-zinc-200">Component Weights Formula</span>
              <span
                className={`font-mono text-xs ${
                  totalFormWeights === 100 ? 'text-slate-900 dark:text-white font-bold' : 'text-rose-600 font-bold'
                }`}
              >
                Sum: {totalFormWeights}% (Must equal 100%)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Goals Weight (%)</label>
                <input
                  type="number"
                  min="10"
                  max="80"
                  required
                  value={goalsWeight}
                  onChange={(e) => setGoalsWeight(parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 font-mono bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Competencies (%)</label>
                <input
                  type="number"
                  min="10"
                  max="60"
                  required
                  value={compWeight}
                  onChange={(e) => setCompWeight(parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 font-mono bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Values (%)</label>
                <input
                  type="number"
                  min="5"
                  max="40"
                  required
                  value={valuesWeight}
                  onChange={(e) => setValuesWeight(parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 font-mono bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-[#8D96AA] hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors font-mono text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="premium-glow-btn h-10 px-5 text-xs font-semibold cursor-pointer"
            >
              Create Cycle
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

