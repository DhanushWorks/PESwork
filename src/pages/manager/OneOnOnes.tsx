import React, { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../app/AppContext'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { AnimatedSearchBar } from '../../components/ui/AnimatedSearchBar'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import {
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  CheckSquare,
  Plus,
  Video,
  ExternalLink,
  RotateCcw,
  Check,
  UserCheck,
  TrendingUp,
  MessagesSquare,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react'

export interface ActionItem {
  id: string
  text: string
  completed: boolean
  targetDate?: string
  assignedTo?: string
}

export interface MeetingCheckIn {
  id: string
  employeeId: string
  employeeName: string
  role: string
  department: string
  employeeCode: string
  avatar: string
  date: string
  cadence: string
  agendaTitle: string
  agendaDescription: string
  agendaPoints: string[]
  actionItems: ActionItem[]
  status: 'scheduled' | 'completed'
}

const INITIAL_MEETINGS: MeetingCheckIn[] = [
  {
    id: 'm-1',
    employeeId: 'u-emp-1',
    employeeName: 'Alex Rivera',
    role: 'Staff Frontend Engineer',
    department: 'Engineering',
    employeeCode: 'EMP-042',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    date: 'This Thursday, 2:00 PM',
    cadence: 'Bi-Weekly Sync · 30 min',
    agendaTitle: 'Design System v3 Rollout & Core Architecture Alignment',
    agendaDescription:
      'Discuss Design System v3 rollout adoption metrics across product squads and align on the Q4 technical roadmap deliverables.',
    agendaPoints: [
      'Design token pipeline sync across Web and Mobile repositories',
      'Bundle size budget enforcement in CI/CD telemetry pipeline',
      'Mentorship roadmap for junior frontend engineers on team',
    ],
    actionItems: [
      {
        id: 'act-1',
        text: 'Review lighthouse test pipeline telemetry',
        completed: true,
        targetDate: 'Nov 30, 2026',
        assignedTo: 'Alex Rivera',
      },
      {
        id: 'act-2',
        text: 'Draft guild agenda for Tuesday technical share',
        completed: false,
        targetDate: 'Dec 05, 2026',
        assignedTo: 'Alex Rivera',
      },
      {
        id: 'act-3',
        text: 'Finalize design token versioning RFC with platform lead',
        completed: false,
        targetDate: 'Dec 12, 2026',
        assignedTo: 'Alex Rivera',
      },
    ],
    status: 'scheduled',
  },
  {
    id: 'm-2',
    employeeId: 'u-emp-2',
    employeeName: 'Priya Patel',
    role: 'Senior Distributed Systems Engineer',
    department: 'Engineering',
    employeeCode: 'EMP-055',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    date: 'Next Tuesday, 10:30 AM',
    cadence: 'Bi-Weekly Sync · 45 min',
    agendaTitle: 'Kafka Event Streaming Latency Milestones & SOC2 Audit Checks',
    agendaDescription:
      'Review Kafka event streaming latency milestones, consumer group throughput under peak load, and SOC2 compliance audit checks.',
    agendaPoints: [
      'End-to-end p99 message serialization benchmarks under peak load',
      'PII field masking encryption at rest verification report',
      'Cross-datacenter failover cluster dry-run scheduling',
    ],
    actionItems: [
      {
        id: 'act-4',
        text: 'Finalize PII audit endpoint coverage report',
        completed: true,
        targetDate: 'Nov 28, 2026',
        assignedTo: 'Priya Patel',
      },
      {
        id: 'act-5',
        text: 'Publish latency profiling dashboard to team Grafana',
        completed: false,
        targetDate: 'Dec 08, 2026',
        assignedTo: 'Priya Patel',
      },
    ],
    status: 'scheduled',
  },
  {
    id: 'm-3',
    employeeId: 'u-emp-3',
    employeeName: 'Jordan Lee',
    role: 'Lead Product Designer',
    department: 'Design & Engineering',
    employeeCode: 'EMP-063',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    date: 'Last Friday, 3:00 PM',
    cadence: 'Bi-Weekly Sync · 30 min',
    agendaTitle: 'Appraisal Calibration UX Prototype & Design Tokens',
    agendaDescription:
      'Agreed on Playwright synthetic tests coverage, appraisal calibration flow Figma prototypes, and micro-interaction rubber physics.',
    agendaPoints: [
      'H1 appraisal calibration flow UX prototype walkthrough',
      'Micro-interactions and rubber physics sign-off',
      'Accessibility contrast audit for High Contrast themes',
    ],
    actionItems: [
      {
        id: 'act-6',
        text: 'Jordan submitted 2 revised goals for approval',
        completed: true,
        targetDate: 'Nov 15, 2026',
        assignedTo: 'Jordan Lee',
      },
      {
        id: 'act-7',
        text: 'Export high-res component library tokens for UI engineers',
        completed: true,
        targetDate: 'Nov 20, 2026',
        assignedTo: 'Jordan Lee',
      },
    ],
    status: 'completed',
  },
  {
    id: 'm-4',
    employeeId: 'u-emp-4',
    employeeName: 'Samantha Hayes',
    role: 'Staff Platform Engineer',
    department: 'DevOps & Platform',
    employeeCode: 'EMP-071',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    date: 'Tomorrow, 11:00 AM',
    cadence: 'Weekly Sync · 30 min',
    agendaTitle: 'Kubernetes Pod Autoscaling & Spot Instance Cost Savings',
    agendaDescription:
      'Evaluate Kubernetes pod autoscaling thresholds during unexpected traffic spikes and spot instance cost-savings optimization.',
    agendaPoints: [
      'KEDA event-driven autoscaling for consumer worker pools',
      'AWS Spot interruption tolerance strategy validation',
    ],
    actionItems: [
      {
        id: 'act-8',
        text: 'Review staging chaos test results for Redis cluster failover',
        completed: false,
        targetDate: 'Dec 02, 2026',
        assignedTo: 'Samantha Hayes',
      },
      {
        id: 'act-9',
        text: 'Submit infrastructure cost optimization estimate to VP',
        completed: false,
        targetDate: 'Dec 15, 2026',
        assignedTo: 'Samantha Hayes',
      },
    ],
    status: 'scheduled',
  },
  {
    id: 'm-5',
    employeeId: 'u-emp-5',
    employeeName: 'David Kim',
    role: 'Full Stack Software Engineer',
    department: 'Engineering',
    employeeCode: 'EMP-088',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    date: 'Yesterday, 4:30 PM',
    cadence: 'Bi-Weekly Sync · 30 min',
    agendaTitle: 'Career Growth Discussion: Promotion Path to Senior Engineer',
    agendaDescription:
      'Career growth discussion: Progress towards Senior Software Engineer promotion criteria and cross-team project ownership.',
    agendaPoints: [
      'Independent ownership of appraisal calibration module',
      'Cross-team technical alignment with People Ops guild',
    ],
    actionItems: [
      {
        id: 'act-10',
        text: 'Complete system architecture documentation for calibrations',
        completed: true,
        targetDate: 'Nov 10, 2026',
        assignedTo: 'David Kim',
      },
      {
        id: 'act-11',
        text: 'Schedule peer architecture review session with staff leads',
        completed: true,
        targetDate: 'Nov 18, 2026',
        assignedTo: 'David Kim',
      },
    ],
    status: 'completed',
  },
]

const STORAGE_KEY = 'performiq_1on1_checkins_v2'

export const ManagerOneOnOnes: React.FC = () => {
  const { currentUser } = useApp()
  const { success, info } = useToast()
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'completed'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // State with localStorage persistence
  const [meetings, setMeetings] = useState<MeetingCheckIn[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.warn('Could not read 1:1 meetings from storage', e)
    }
    return INITIAL_MEETINGS
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings))
    } catch (e) {
      console.warn('Could not persist 1:1 meetings', e)
    }
  }, [meetings])

  // Modals state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [selectedMeetingForAction, setSelectedMeetingForAction] = useState<string | null>(null)
  const [newActionItemText, setNewActionItemText] = useState('')
  const [newActionTargetDate, setNewActionTargetDate] = useState('Dec 15, 2026')

  // Schedule modal form state
  const [newMeetingForm, setNewMeetingForm] = useState({
    employeeName: 'Alex Rivera',
    date: 'Upcoming Friday, 3:00 PM',
    cadence: 'Bi-Weekly Sync · 30 min',
    agendaTitle: '',
    agendaDescription: '',
    actionItem: '',
  })

  // Toggle single action item completion
  const handleToggleActionItem = (meetingId: string, actionId: string) => {
    setMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== meetingId) return m
        const updatedActions = m.actionItems.map((act) =>
          act.id === actionId ? { ...act, completed: !act.completed } : act
        )
        const updatedMeeting = { ...m, actionItems: updatedActions }
        const targetAct = m.actionItems.find((a) => a.id === actionId)
        if (targetAct) {
          if (!targetAct.completed) {
            success('Commitment Completed', `"${targetAct.text}" marked as completed.`)
          } else {
            info('Commitment Reopened', `"${targetAct.text}" set to in-progress.`)
          }
        }
        return updatedMeeting
      })
    )
  }

  // Toggle meeting status between scheduled and completed
  const handleToggleMeetingStatus = (meetingId: string) => {
    setMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== meetingId) return m
        const newStatus = m.status === 'scheduled' ? 'completed' : 'scheduled'
        if (newStatus === 'completed') {
          success(`Marked 1:1 with ${m.employeeName} as Completed`)
        } else {
          info(`Reopened 1:1 with ${m.employeeName}`)
        }
        return { ...m, status: newStatus }
      })
    )
  }

  // Add new action item to a meeting
  const handleAddActionItem = () => {
    if (!selectedMeetingForAction || !newActionItemText.trim()) return

    const targetMeeting = meetings.find((m) => m.id === selectedMeetingForAction)
    const assignedName = targetMeeting?.employeeName || 'Direct Report'

    setMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== selectedMeetingForAction) return m
        const newAct: ActionItem = {
          id: `act-${Date.now()}`,
          text: newActionItemText.trim(),
          completed: false,
          targetDate: newActionTargetDate || 'Dec 15, 2026',
          assignedTo: assignedName,
        }
        return { ...m, actionItems: [...m.actionItems, newAct] }
      })
    )

    success('Agreed commitment added', `New milestone recorded for ${assignedName}.`)
    setNewActionItemText('')
    setSelectedMeetingForAction(null)
  }

  // Schedule new 1:1 check-in
  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMeetingForm.agendaTitle.trim()) return

    const reportProfiles: Record<string, { code: string; role: string; dept: string; avatar: string }> = {
      'Alex Rivera': {
        code: 'EMP-042',
        role: 'Staff Frontend Engineer',
        dept: 'Engineering',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      },
      'Priya Patel': {
        code: 'EMP-055',
        role: 'Senior Distributed Systems Engineer',
        dept: 'Engineering',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      },
      'Jordan Lee': {
        code: 'EMP-063',
        role: 'Lead Product Designer',
        dept: 'Design & Engineering',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      },
      'Samantha Hayes': {
        code: 'EMP-071',
        role: 'Staff Platform Engineer',
        dept: 'DevOps & Platform',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      },
      'David Kim': {
        code: 'EMP-088',
        role: 'Full Stack Software Engineer',
        dept: 'Engineering',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      },
    }

    const profile = reportProfiles[newMeetingForm.employeeName] || {
      code: 'EMP-099',
      role: 'Software Engineer',
      dept: 'Engineering',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    }

    const newMeeting: MeetingCheckIn = {
      id: `m-${Date.now()}`,
      employeeId: `u-emp-${Date.now()}`,
      employeeName: newMeetingForm.employeeName,
      role: profile.role,
      department: profile.dept,
      employeeCode: profile.code,
      avatar: profile.avatar,
      date: newMeetingForm.date || 'Upcoming Sync',
      cadence: newMeetingForm.cadence || 'Bi-Weekly Sync · 30 min',
      agendaTitle: newMeetingForm.agendaTitle.trim(),
      agendaDescription: newMeetingForm.agendaDescription.trim() || newMeetingForm.agendaTitle.trim(),
      agendaPoints: ['Review sprint deliverables', 'Strategic milestone check', 'Feedback exchange'],
      actionItems: newMeetingForm.actionItem.trim()
        ? [
            {
              id: `act-${Date.now()}`,
              text: newMeetingForm.actionItem.trim(),
              completed: false,
              targetDate: 'Dec 15, 2026',
              assignedTo: newMeetingForm.employeeName,
            },
          ]
        : [],
      status: 'scheduled',
    }

    setMeetings((prev) => [newMeeting, ...prev])
    success(`Scheduled 1:1 check-in with ${newMeeting.employeeName}`)
    setIsScheduleModalOpen(false)
    setNewMeetingForm({
      employeeName: 'Alex Rivera',
      date: 'Upcoming Friday, 3:00 PM',
      cadence: 'Bi-Weekly Sync · 30 min',
      agendaTitle: '',
      agendaDescription: '',
      actionItem: '',
    })
  }

  // Launch Video Room simulation
  const handleLaunchVideo = (employeeName: string) => {
    info(`Connecting to secure 1:1 video room with ${employeeName}...`)
  }

  // Filtered meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter((item) => {
      if (statusFilter === 'scheduled' && item.status !== 'scheduled') return false
      if (statusFilter === 'completed' && item.status !== 'completed') return false

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesName = item.employeeName.toLowerCase().includes(query)
        const matchesRole = item.role.toLowerCase().includes(query)
        const matchesCode = item.employeeCode.toLowerCase().includes(query)
        const matchesTitle = item.agendaTitle.toLowerCase().includes(query)
        const matchesDesc = item.agendaDescription.toLowerCase().includes(query)
        const matchesActions = item.actionItems.some((a) => a.text.toLowerCase().includes(query))
        return matchesName || matchesRole || matchesCode || matchesTitle || matchesDesc || matchesActions
      }

      return true
    })
  }, [meetings, statusFilter, searchQuery])

  // Aggregate metrics
  const totalMeetings = meetings.length
  const scheduledCount = meetings.filter((m) => m.status === 'scheduled').length
  const completedCount = meetings.filter((m) => m.status === 'completed').length
  const allActionItems = meetings.flatMap((m) => m.actionItems)
  const totalActionCount = allActionItems.length
  const resolvedActionCount = allActionItems.filter((a) => a.completed).length
  const inProgressActionCount = totalActionCount - resolvedActionCount
  const pctComplete = totalActionCount > 0 ? Math.round((resolvedActionCount / totalActionCount) * 100) : 0

  return (
    <div className="space-y-7 w-full pb-16 font-sans animate-fade-in">
      {/* Page Header matching reference */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="heading-premium text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.04em] text-slate-900 dark:text-white leading-[1.15]">
            Bi-Weekly 1:1 Executive Check-ins
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Structured sync agendas, mutual commitments & alignment logs with direct reports
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsScheduleModalOpen(true)}
          className="premium-glow-btn h-11 px-5 text-xs font-semibold cursor-pointer inline-flex items-center gap-2 self-start sm:self-auto shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule 1:1 Sync</span>
        </button>
      </div>

      {/* SECTION 1: Cadence Velocity & Roster Overview (Hero Card) */}
      <div className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs dark:shadow-md space-y-6">
        {/* Top Header Row matching Reference */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/90 dark:border-white/[0.08]">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-600 dark:text-[#8B7CFF] flex items-center justify-center shrink-0 shadow-2xs">
              <MessagesSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.08em] font-bold text-indigo-600 dark:text-[#8B7CFF]">
                  MANAGEMENT CADENCE · CONTINUOUS ALIGNMENT
                </span>
              </div>
              <h2 className="heading-premium text-xl sm:text-2xl font-extrabold tracking-[-0.03em] text-slate-900 dark:text-white mt-0.5">
                Active 1:1 Sync Roster & Agenda Ledgers
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Review discussion agendas, track agreed commitments, and cycle action item completion.
              </p>
            </div>
          </div>

          {/* Rubber Segmented Control Filter Tabs */}
          <div className="flex items-center gap-3 self-start lg:self-center shrink-0">
            <RubberSegmentedControl
              options={[
                { value: 'all', label: 'All', count: totalMeetings },
                {
                  value: 'scheduled',
                  label: 'Scheduled',
                  count: scheduledCount,
                },
                {
                  value: 'completed',
                  label: 'Completed',
                  count: completedCount,
                },
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              size="sm"
            />
          </div>
        </div>

        {/* Milestone Execution Summary Pill & Progress Track (Matching Reference) */}
        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.025] border border-slate-200/80 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-bold text-slate-900 dark:text-white">
              Cadence Velocity:
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50/90 text-indigo-700 dark:text-[#B7B1FF] font-semibold font-mono text-[11px] border border-indigo-200/90 dark:border-[#8B7CFF]/30 dark:bg-[#8B7CFF]/15">
              {resolvedActionCount} of {totalActionCount} Commitments Met ({pctComplete}%)
            </span>
            {inProgressActionCount > 0 && (
              <span className="text-slate-500 dark:text-zinc-400 text-[11px] hidden md:inline">
                · {inProgressActionCount} active commitments in progress
              </span>
            )}
          </div>

          {/* Proportional Segmented Progress Mini Track */}
          <div className="w-full sm:w-64 h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-white/[0.08] flex items-center p-0.5 gap-0.5">
            <div
              style={{ width: `${pctComplete}%` }}
              className="h-full rounded-full bg-indigo-600 dark:bg-[#8B7CFF] transition-all duration-500"
              title={`Completed Commitments: ${resolvedActionCount}`}
            />
            <div
              style={{ width: `${100 - pctComplete}%` }}
              className="h-full rounded-full bg-indigo-500 dark:bg-[#8B7CFF] transition-all duration-500"
              title={`In Progress: ${inProgressActionCount}`}
            />
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-md">
          <AnimatedSearchBar
            value={searchQuery}
            onChangeValue={setSearchQuery}
            placeholder="Search direct report, agenda topic or deliverable..."
            animatedText="Search direct report, agenda topic or deliverable..."
            variant="pill"
            sizeVariant="sm"
          />
        </div>
      </div>

      {/* SECTION 2: Meeting Check-In Cards List */}
      <div className="space-y-6">
        {filteredMeetings.length === 0 ? (
          <div className="dark-glass-card rounded-2xl sm:rounded-3xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-zinc-500 mx-auto flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="heading-premium font-bold text-base text-slate-900 dark:text-white">
              No matching 1:1 check-ins found
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
              Adjust your search keywords or toggle the filter tabs to view other 1:1 syncs.
            </p>
          </div>
        ) : (
          filteredMeetings.map((item) => {
            const completedCountForCard = item.actionItems.filter((a) => a.completed).length
            const isCompleted = item.status === 'completed'

            return (
              <div
                key={item.id}
                className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs dark:shadow-md transition-all duration-200"
              >
                {/* 1. Header Row: Direct Report Identity + Timing + Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90 dark:border-white/[0.08]">
                  {/* Left: Employee Avatar + Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={item.avatar}
                        alt={item.employeeName}
                        className="w-12 h-12 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-white/10"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-indigo-600 dark:bg-emerald-500 ring-2 ring-white dark:ring-[#0B0E14]" />
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="heading-premium text-lg sm:text-xl font-bold tracking-[-0.03em] text-slate-900 dark:text-white truncate">
                          {item.employeeName}
                        </h2>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10 whitespace-nowrap shrink-0">
                          {item.employeeCode}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium truncate">
                        {item.role} · <span className="text-slate-400 dark:text-zinc-500">{item.department}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Date Capsule + Status Capsule matching Reference */}
                  <div className="flex items-center gap-2.5 sm:self-center shrink-0 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10 whitespace-nowrap">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-[#8B7CFF]" />
                      <span>{item.date}</span>
                    </div>

                    {/* Status Capsule matching Reference Image */}
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-indigo-50/90 text-indigo-700 dark:border-[#8B7CFF]/30 dark:bg-[#8B7CFF]/15 dark:text-[#B7B1FF] border border-indigo-200/90 shadow-2xs whitespace-nowrap">
                        COMPLETED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-700 dark:text-[#8B7CFF] border border-[#8B7CFF]/35 shadow-2xs whitespace-nowrap">
                        SCHEDULED
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Discussion Agenda Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-[#8B7CFF] flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.08em] font-bold text-indigo-600 dark:text-[#8B7CFF]">
                        DISCUSSION AGENDA · STRATEGIC TOPICS
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 hidden sm:inline">
                      {item.cadence}
                    </span>
                  </div>

                  {/* Stylized Agenda Container */}
                  <div className="rounded-2xl p-4.5 sm:p-5 bg-indigo-500/[0.03] dark:bg-[#8B7CFF]/[0.05] border border-indigo-500/20 dark:border-[#8B7CFF]/25 space-y-3">
                    <h3 className="heading-premium font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                      {item.agendaTitle}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-[#D1D5DB] leading-relaxed">
                      {item.agendaDescription}
                    </p>

                    {/* Sub-points / Key Talking Points */}
                    {item.agendaPoints && item.agendaPoints.length > 0 && (
                      <div className="pt-3 border-t border-indigo-500/15 dark:border-[#8B7CFF]/15 space-y-2">
                        {item.agendaPoints.map((point, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-[#8D96AA]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8B7CFF] shrink-0" />
                            <span className="font-normal">{point}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Agreed Action Items & Commitments (EXACTLY MATCHING THE REFERENCE ROWS) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-white/[0.04] text-indigo-600 dark:text-[#8B7CFF] flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.08em] font-bold text-indigo-600 dark:text-[#8B7CFF]">
                        AGREED ACTION ITEMS · MUTUAL COMMITMENTS
                      </span>
                    </div>

                    <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-white/10">
                      {completedCountForCard} of {item.actionItems.length} Resolved
                    </span>
                  </div>

                  {item.actionItems.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 italic pl-1">
                      No agreed commitments recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {item.actionItems.map((act) => {
                        const isActDone = act.completed

                        return (
                          <div
                            key={act.id}
                            onClick={() => handleToggleActionItem(item.id, act.id)}
                            className={`group relative rounded-2xl p-4 sm:p-4.5 border transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none ${
                              isActDone
                                ? 'bg-indigo-50/70 dark:bg-emerald-500/[0.08] border-indigo-200/90 dark:border-emerald-500/30 hover:border-indigo-300 dark:hover:border-emerald-500/50 hover:bg-indigo-50 dark:hover:bg-emerald-500/[0.12] text-slate-800 dark:text-[#E6E9F2] shadow-2xs'
                                : 'bg-indigo-500/[0.04] dark:bg-[#8B7CFF]/[0.09] border-[#8B7CFF]/35 dark:border-[#8B7CFF]/35 hover:border-[#8B7CFF]/60 hover:bg-indigo-500/[0.07] dark:hover:bg-[#8B7CFF]/[0.14] text-slate-900 dark:text-[#F0F3FA] shadow-2xs'
                            }`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleToggleActionItem(item.id, act.id)
                              }
                            }}
                            title="Click to toggle commitment status"
                          >
                            {/* Left: Interactive Status Glyph + Title & Metadata */}
                            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                              {/* Status Glyph matching reference */}
                              <div
                                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                                  isActDone
                                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/30 dark:bg-emerald-500 dark:shadow-emerald-500/30'
                                    : 'bg-indigo-500/20 text-[#8B7CFF] border border-[#8B7CFF]/40 shadow-xs'
                                }`}
                              >
                                {isActDone ? (
                                  <Check className="w-4 h-4 stroke-[3]" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-[#8B7CFF] live-dot-pulse" />
                                )}
                              </div>

                              {/* Title & Metadata */}
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`font-display font-bold text-sm sm:text-[15px] tracking-[-0.015em] transition-colors leading-snug ${
                                      isActDone
                                        ? 'line-through decoration-indigo-400/50 dark:decoration-emerald-400/40 text-slate-500 dark:text-zinc-400'
                                        : 'text-slate-900 dark:text-white'
                                    }`}
                                  >
                                    {act.text}
                                  </span>
                                </div>

                                {/* Meta Pill Row */}
                                <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-[11px] font-medium">
                                    <Calendar className="w-3 h-3 text-slate-400 dark:text-zinc-400" />
                                    <span>Target: {act.targetDate || 'Prior to next sync'}</span>
                                  </span>

                                  {isActDone ? (
                                    <span className="text-[11px] font-medium text-indigo-600 dark:text-[#B7B1FF] hidden md:inline">
                                      · Verified deliverable
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-medium text-indigo-600 dark:text-[#8B7CFF] hidden md:inline">
                                      · Active Commitment
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: Status Capsule matching Reference */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-white/10">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border shadow-2xs ${
                                  isActDone
                                    ? 'bg-indigo-50/90 text-indigo-700 dark:border-[#8B7CFF]/30 dark:bg-[#8B7CFF]/15 dark:text-[#B7B1FF] border-indigo-200/90'
                                    : 'bg-indigo-500/15 text-indigo-700 dark:text-[#8B7CFF] border-[#8B7CFF]/35'
                                }`}
                              >
                                {isActDone ? 'COMPLETED' : 'IN PROGRESS'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Card Bottom Toolbar */}
                <div className="pt-4 border-t border-slate-200/90 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleMeetingStatus(item.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border border-slate-200/90 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-zinc-300"
                    >
                      {isCompleted ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Reopen 1:1 Sync</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-emerald-500" />
                          <span>Mark 1:1 as Completed</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMeetingForAction(item.id)
                        setNewActionItemText('')
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Commitment</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleLaunchVideo(item.employeeName)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 shadow-xs transition-all active:scale-[0.98]"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Join Video Room</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* SECTION 3: Curated Conversation Playbooks & Frameworks (Matching Reference's Coursework Grid) */}
      <div className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs dark:shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/90 dark:border-white/[0.08]">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-[#8B7CFF] flex items-center justify-center shrink-0 shadow-2xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.08em] font-bold text-[#8B7CFF]">
                  ENGINEERING LEADERSHIP · CONVERSATION PLAYBOOKS
                </span>
              </div>
              <h2 className="heading-premium text-xl sm:text-2xl font-extrabold tracking-[-0.03em] text-slate-900 dark:text-white mt-0.5">
                Curated 1:1 Coaching Playbooks & Templates
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Battle-tested conversational frameworks for high-performing engineering teams.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Playbook Cards Grid matching the 3 coursework cards in Reference */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
          {/* Card 1 */}
          <div className="group rounded-2xl p-5 border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] transition-all duration-200 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-xs space-y-3.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500">
                PERFORMIQ ACADEMY · 15 MIN READ
              </div>
              <h3 className="heading-premium font-bold text-base text-slate-900 dark:text-white leading-snug">
                Radical Candor & Growth Feedback Loops
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Direct feedback framework balancing personal care with uncompromising technical excellence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => info('Radical Candor framework guide opened in drawer.')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-[#8B7CFF] group-hover:translate-x-0.5 transition-transform pt-2"
            >
              <span>Launch Playbook</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2 */}
          <div className="group rounded-2xl p-5 border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] transition-all duration-200 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-xs space-y-3.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500">
                LEADERSHIP LAB · 30 MIN TEMPLATE
              </div>
              <h3 className="heading-premium font-bold text-base text-slate-900 dark:text-white leading-snug">
                The 10/10/10 Bi-Weekly Sync Model
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                10 mins employee agenda, 10 mins managerial alignment, 10 mins forward commitments.
              </p>
            </div>
            <button
              type="button"
              onClick={() => success('Template Copied', '10/10/10 sync agenda copied to clipboard.')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-[#8B7CFF] group-hover:translate-x-0.5 transition-transform pt-2"
            >
              <span>Use Agenda Template</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 3 */}
          <div className="group rounded-2xl p-5 border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] transition-all duration-200 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-xs space-y-3.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500">
                STAFF PROTOCOL · QUARTERLY CHECK-IN
              </div>
              <h3 className="heading-premium font-bold text-base text-slate-900 dark:text-white leading-snug">
                Career Horizon & Promotion Trajectory
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Milestone calibration framework to evaluate track readiness for Staff and Principal roles.
              </p>
            </div>
            <button
              type="button"
              onClick={() => info('Staff promotion rubric launched.')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-[#8B7CFF] group-hover:translate-x-0.5 transition-transform pt-2"
            >
              <span>Open Rubric</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal 1: Add Action Item */}
      <Modal
        isOpen={Boolean(selectedMeetingForAction)}
        onClose={() => setSelectedMeetingForAction(null)}
        title="Add Agreed Commitment"
        subtitle="Record a new negotiated milestone or follow-up deliverable from this sync."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Commitment Title
            </label>
            <input
              type="text"
              value={newActionItemText}
              onChange={(e) => setNewActionItemText(e.target.value)}
              placeholder="e.g. Publish latency profiling dashboard to team Grafana"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/50 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddActionItem()
                }
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Target Completion
            </label>
            <input
              type="text"
              value={newActionTargetDate}
              onChange={(e) => setNewActionTargetDate(e.target.value)}
              placeholder="e.g. Dec 15, 2026"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/50 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSelectedMeetingForAction(null)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddActionItem}
              disabled={!newActionItemText.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 shadow-xs disabled:opacity-50 transition-all"
            >
              Add Commitment
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Schedule 1:1 */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule 1:1 Executive Sync"
        subtitle="Set up a structured 1:1 sync with agenda and strategic discussion topics."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateMeeting} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Direct Report
              </label>
              <select
                value={newMeetingForm.employeeName}
                onChange={(e) => setNewMeetingForm({ ...newMeetingForm, employeeName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/50 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="Alex Rivera">Alex Rivera (Staff Frontend Engineer)</option>
                <option value="Priya Patel">Priya Patel (Senior Distributed Systems Engineer)</option>
                <option value="Jordan Lee">Jordan Lee (Lead Product Designer)</option>
                <option value="Samantha Hayes">Samantha Hayes (Staff Platform Engineer)</option>
                <option value="David Kim">David Kim (Full Stack Software Engineer)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Date & Time
              </label>
              <input
                type="text"
                value={newMeetingForm.date}
                onChange={(e) => setNewMeetingForm({ ...newMeetingForm, date: e.target.value })}
                placeholder="e.g. This Thursday, 2:00 PM"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/50 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Sync Cadence & Duration
            </label>
            <input
              type="text"
              value={newMeetingForm.cadence}
              onChange={(e) => setNewMeetingForm({ ...newMeetingForm, cadence: e.target.value })}
              placeholder="e.g. Bi-Weekly Sync · 30 min"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/50 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Agenda Topic Headline
            </label>
            <input
              type="text"
              value={newMeetingForm.agendaTitle}
              onChange={(e) => setNewMeetingForm({ ...newMeetingForm, agendaTitle: e.target.value })}
              placeholder="e.g. Design System v3 Rollout & Q4 Architecture Alignment"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/50 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Discussion Summary & Context
            </label>
            <textarea
              rows={3}
              value={newMeetingForm.agendaDescription}
              onChange={(e) => setNewMeetingForm({ ...newMeetingForm, agendaDescription: e.target.value })}
              placeholder="Outline primary focus areas, milestone blockers, or strategic goals for this sync..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/50 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 leading-relaxed resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Initial Action Item (Optional)
            </label>
            <input
              type="text"
              value={newMeetingForm.actionItem}
              onChange={(e) => setNewMeetingForm({ ...newMeetingForm, actionItem: e.target.value })}
              placeholder="e.g. Review Q3 architectural RFC before call"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/50 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 shadow-xs transition-all active:scale-[0.98]"
            >
              Schedule Check-in
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
