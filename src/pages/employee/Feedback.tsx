import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { feedbackService } from '../../services'
import { FeedbackItem, User } from '../../types'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { CustomDropdown } from '../../components/ui/CustomDropdown'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { formatDate } from '../../lib/formatters'
import { AnimatedSearchBar } from '../../components/ui/AnimatedSearchBar'
import {
  Heart,
  MessageSquare,
  MessageSquareHeart,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  ArrowRight,
  Calendar,
  Quote,
  ShieldCheck,
  Copy,
  Check,
  Award,
  RotateCw,
} from 'lucide-react'

export const EmployeeFeedback: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { currentUser, allUsers } = useApp()
  const { success, error } = useToast()

  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received')
  const [feedback, setFeedback] = useState<{ received: FeedbackItem[]; sent: FeedbackItem[] }>({
    received: [],
    sent: [],
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // 3D Flip Card state for touch/click interaction
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({})

  const toggleFlip = (id: string, e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation()
    setFlippedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Selected Feedback Card Detail Modal
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null)
  const [copied, setCopied] = useState(false)
  const [reactions, setReactions] = useState<Record<string, { love: number; clap: number; rocket: number; idea: number }>>({})

  const getFeedbackReactions = (id: string) => {
    return reactions[id] || { love: 4, clap: 7, rocket: 3, idea: 2 }
  }

  const handleReact = (id: string, reactionType: 'love' | 'clap' | 'rocket' | 'idea') => {
    setReactions((prev) => {
      const current = prev[id] || { love: 4, clap: 7, rocket: 3, idea: 2 }
      return {
        ...prev,
        [id]: {
          ...current,
          [reactionType]: current[reactionType] + 1,
        },
      }
    })
  }

  const handleCopyLink = () => {
    if (!selectedFeedback) return
    const url = `${window.location.origin}${window.location.pathname}?id=${selectedFeedback.id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    success('Card Link Copied', 'Direct link to this recognition card copied to clipboard.')
    setTimeout(() => setCopied(false), 2500)
  }

  // Give Feedback Modal
  const [showModal, setShowModal] = useState(false)
  const [recipientId, setRecipientId] = useState('')
  const [type, setType] = useState<'kudos' | 'constructive'>('kudos')
  const [competency, setCompetency] = useState('Collaboration & Craft')
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const fetchFeedback = async () => {
    setLoading(true)
    const data = await feedbackService.listForUser(currentUser.id)
    setFeedback(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchFeedback()
  }, [currentUser.id])

  useEffect(() => {
    const targetId = searchParams.get('id')
    if (targetId && (feedback.received.length > 0 || feedback.sent.length > 0)) {
      const found = [...feedback.received, ...feedback.sent].find((f) => f.id === targetId)
      if (found) {
        setSelectedFeedback(found)
      }
    }
  }, [searchParams, feedback])

  const eligibleRecipients = allUsers.filter((u) => u.id !== currentUser.id)

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientId) {
      error('Recipient required', 'Please select a colleague to receive your feedback.')
      return
    }
    if (!message.trim() || message.trim().length < 5) {
      error('Message required', 'Please provide meaningful feedback (at least 5 characters).')
      return
    }

    setIsSending(true)
    try {
      await feedbackService.giveFeedback({
        fromUserId: currentUser.id,
        toUserId: recipientId,
        type,
        competency,
        message,
        isPublic: type === 'kudos',
      })

      const target = allUsers.find((u) => u.id === recipientId)
      success(
        'Feedback sent',
        `Your ${type === 'kudos' ? 'kudos' : 'constructive note'} was sent to ${target?.name}.`
      )
      setShowModal(false)
      setMessage('')
      setRecipientId('')
      fetchFeedback()
    } catch (err: any) {
      error('Failed to send feedback', err.message)
    } finally {
      setIsSending(false)
    }
  }

  const rawItems = activeTab === 'received' ? feedback.received : feedback.sent
  const items = searchQuery.trim()
    ? rawItems.filter((item) => {
        const q = searchQuery.toLowerCase()
        const textMatch = item.message?.toLowerCase().includes(q)
        const compMatch = item.competency?.toLowerCase().includes(q)
        const typeMatch = item.type?.toLowerCase().includes(q)
        const sender = allUsers.find((u) => u.id === item.fromUserId)
        const authorMatch = (item.isPublic && sender?.name?.toLowerCase().includes(q)) || false
        return textMatch || compMatch || typeMatch || authorMatch
      })
    : rawItems

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Page Header (Matching Dashboard UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Peer Feedback & Kudos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Real-time recognition, 3D recognition flips & constructive growth notes
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (eligibleRecipients.length > 0 && !recipientId) {
              setRecipientId(eligibleRecipients[0].id)
            }
            setShowModal(true)
          }}
          className="premium-glow-btn h-11 px-5 text-xs font-semibold cursor-pointer inline-flex items-center gap-2 whitespace-nowrap self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Give Feedback</span>
        </button>
      </div>

      {/* Tabs & Search Bar Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1">
        <RubberSegmentedControl
          options={[
            {
              value: 'received',
              label: 'Received Feedback',
              count: feedback.received.length,
              icon: <MessageSquareHeart className="w-3.5 h-3.5" />,
            },
            {
              value: 'sent',
              label: 'Sent Feedback',
              count: feedback.sent.length,
              icon: <Send className="w-3.5 h-3.5" />,
            },
          ]}
          value={activeTab}
          onChange={(val) => setActiveTab(val as 'received' | 'sent')}
          size="md"
        />

        {/* Animated Search Bar with 270px x 48px Experience */}
        <AnimatedSearchBar
          value={searchQuery}
          onChangeValue={setSearchQuery}
          placeholder="Search feedback..."
          animatedPlaceholders={[
            'Search feedback messages...',
            'Filter by competency...',
            'Search kudos & coaching...',
            'Filter by teammate...',
          ]}
          variant="pill"
          sizeVariant="default"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-mono">Loading feedback...</div>
      ) : items.length === 0 ? (
        <EmptyState
          title={activeTab === 'received' ? 'No feedback received yet' : 'No feedback sent yet'}
          description={
            activeTab === 'received'
              ? 'Colleagues can share kudos and coaching moments with you at any time.'
              : 'Recognize a colleague’s great work or offer a helpful tip.'
          }
          action={{
            label: 'Give Feedback to Colleague',
            onClick: () => setShowModal(true),
          }}
        />
      ) : (
        <div className="space-y-4">
          {items.map((fb) => {
            const author = allUsers.find((u) => u.id === fb.fromUserId)
            const recipient = allUsers.find((u) => u.id === fb.toUserId)
            const isKudos = fb.type === 'kudos'
            const cardReactions = getFeedbackReactions(fb.id)

            return (
              <div
                key={fb.id}
                className={`w-flipbox ${flippedCards[fb.id] ? 'is-flipped' : ''}`}
                onClick={(e) => toggleFlip(fb.id, e)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleFlip(fb.id)
                  }
                }}
                aria-label={`Feedback card from ${author?.name || 'Colleague'} - touch to flip`}
              >
                <div className="w-flipbox-inner w-flipbox-h">
                  {/* FRONT SIDE (w-flipbox-front) */}
                  <div
                    className="w-flipbox-front group dark-glass-card rounded-2xl p-5 shadow-sm transition-all duration-200 cursor-pointer select-none flex flex-col justify-between hover:border-slate-300 dark:hover:border-white/20 min-h-[220px]"
                  >
                    <div className="w-flipbox-front-h flex flex-col justify-between h-full space-y-3.5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={
                                (activeTab === 'received' ? author?.avatar : recipient?.avatar) ||
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                              }
                              alt="Avatar"
                              className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 dark:text-[#F0F3FA] transition-colors truncate">
                                {activeTab === 'received'
                                  ? author?.name || 'A Colleague'
                                  : `To: ${recipient?.name || 'A Colleague'}`}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-[#8D96AA] truncate font-mono">
                                {activeTab === 'received'
                                  ? author?.designation
                                  : recipient?.designation}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                isKudos
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50'
                              }`}
                            >
                              {isKudos ? <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> : <TrendingUp className="w-3 h-3 text-indigo-500" />}
                              {isKudos ? 'Kudos Recognition' : 'Constructive Coaching'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                              {formatDate(fb.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Executive Feedback Quote Block */}
                        <div
                          className={`relative p-3.5 sm:p-4 rounded-xl transition-all border ${
                            isKudos
                              ? 'bg-rose-500/[0.03] dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/30 border-l-[3px] border-l-rose-500'
                              : 'bg-indigo-500/[0.03] dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-900/30 border-l-[3px] border-l-indigo-500'
                          }`}
                        >
                          {/* Competency & Quote Meta Row */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-semibold">
                                Competency
                              </span>
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono border ${
                                  isKudos
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/25'
                                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/25'
                                }`}
                              >
                                {isKudos ? (
                                  <Sparkles className="w-3 h-3 text-rose-500 dark:text-rose-400 shrink-0" />
                                ) : (
                                  <Award className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                                )}
                                <span>{fb.competency}</span>
                              </span>
                            </div>

                            <Quote
                              className={`w-3.5 h-3.5 shrink-0 opacity-40 ${
                                isKudos ? 'text-rose-500' : 'text-indigo-500'
                              }`}
                            />
                          </div>

                          {/* Message Body with Refined Editorial Font */}
                          <blockquote className="text-[13px] sm:text-[13.5px] leading-relaxed font-medium text-slate-800 dark:text-zinc-100 tracking-[-0.015em]">
                            "{fb.message}"
                          </blockquote>
                        </div>
                      </div>

                      {/* Interactive Card Action Footer */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-zinc-800/60 text-xs">
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                          Ref #{fb.id.slice(-4).toUpperCase()}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => toggleFlip(fb.id, e)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 transition-all shadow-2xs cursor-pointer active:scale-95 font-mono"
                            title="Touch to flip card"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Touch to Flip</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedFeedback(fb)
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors py-0.5 px-1 cursor-pointer font-mono"
                            title="Open full recognition modal"
                          >
                            <span>Open Modal</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BACK SIDE (w-flipbox-back: Exact same footprint, flips seamlessly in-place) */}
                  <div
                    className="w-flipbox-back dark-glass-card rounded-2xl p-5 shadow-xl flex flex-col justify-between border border-slate-200 dark:border-white/15 select-none cursor-pointer transition-colors duration-300 min-h-[220px]"
                  >
                    <div className="w-flipbox-back-h flex flex-col justify-between h-full space-y-3">
                      <div className="space-y-2.5">
                        {/* Top Header of Card Page */}
                        <div className={`flex items-center justify-between gap-2 border-b pb-2 ${
                          isKudos ? 'border-rose-100 dark:border-zinc-800' : 'border-slate-100 dark:border-zinc-800'
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono ${
                              isKudos
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                            }`}>
                              {isKudos ? (
                                <>
                                  <Sparkles className="w-3 h-3 text-rose-600 dark:text-rose-300" />
                                  <span>Peer Recognition Certificate</span>
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="w-3 h-3 text-indigo-600 dark:text-indigo-300" />
                                  <span>Constructive Growth Card</span>
                                </>
                              )}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-[#8D96AA] shrink-0">
                              Ref #{fb.id.slice(-4).toUpperCase()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => toggleFlip(fb.id, e)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 transition-all cursor-pointer active:scale-95 font-mono shadow-xs"
                              title="Flip card back to front"
                            >
                              <RotateCw className="w-3 h-3" />
                              <span>Flip Back</span>
                            </button>
                          </div>
                        </div>

                        {/* Author -> Recipient Flow */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] min-w-0">
                            <img
                              src={author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                              alt={author?.name || 'Author'}
                              className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20 shadow-xs shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8D96AA] font-mono">
                                Recognized By
                              </div>
                              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {author?.name || 'A Colleague'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] min-w-0">
                            <img
                              src={recipient?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'}
                              alt={recipient?.name || 'Recipient'}
                              className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20 shadow-xs shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-[#4FE3C1] font-mono">
                                Honoring
                              </div>
                              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {recipient?.name || 'A Colleague'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Pillar and Date Row */}
                        <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08]">
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-[#F0F3FA] font-medium truncate font-mono text-[11px]">
                            <Award className="w-3.5 h-3.5 text-[#FFB454] shrink-0" />
                            <span className="truncate">Pillar: {fb.competency}</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 dark:text-[#8D96AA] shrink-0">
                            {formatDate(fb.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Reactions Bar & Actions */}
                      <div className={`flex items-center justify-between pt-2.5 border-t text-xs ${
                        isKudos ? 'border-rose-100 dark:border-zinc-800' : 'border-slate-100 dark:border-zinc-800'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReact(fb.id, 'love')
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-rose-600 dark:bg-white/[0.04] dark:hover:bg-rose-500/20 dark:text-rose-400 text-xs font-semibold border border-slate-200 dark:border-white/10 shadow-2xs transition-colors cursor-pointer active:scale-95"
                            title="Love"
                          >
                            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400" />
                            <span>{cardReactions.love}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReact(fb.id, 'clap')
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 text-amber-700 dark:bg-white/[0.04] dark:hover:bg-amber-500/20 dark:text-amber-300 text-xs font-semibold border border-slate-200 dark:border-white/10 shadow-2xs transition-colors cursor-pointer active:scale-95"
                            title="Applause"
                          >
                            <span>👏</span>
                            <span>{cardReactions.clap}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReact(fb.id, 'rocket')
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-indigo-700 dark:bg-white/[0.04] dark:hover:bg-indigo-500/20 dark:text-indigo-300 text-xs font-semibold border border-slate-200 dark:border-white/10 shadow-2xs transition-colors cursor-pointer active:scale-95"
                            title="Rocket"
                          >
                            <span>🚀</span>
                            <span>{cardReactions.rocket}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReact(fb.id, 'idea')
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 text-amber-700 dark:bg-white/[0.04] dark:hover:bg-amber-500/20 dark:text-amber-300 text-xs font-semibold border border-slate-200 dark:border-white/10 shadow-2xs transition-colors cursor-pointer active:scale-95"
                            title="Insight"
                          >
                            <span>💡</span>
                            <span>{cardReactions.idea}</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedFeedback(fb)
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors py-0.5 px-1 cursor-pointer font-mono shrink-0 ml-auto"
                          title="Open full recognition modal"
                        >
                          <span>Open Modal</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Give Feedback Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Share Peer Feedback"
        subtitle="Feedback promotes high performance, psychological safety, and growth"
        maxWidth="md"
      >
        <form onSubmit={handleSendFeedback} className="space-y-3.5 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Colleague *</label>
            <CustomDropdown
              value={recipientId}
              onChange={setRecipientId}
              fullWidth
              placeholder="Select team member..."
              options={[
                { value: '', label: 'Select team member...' },
                ...eligibleRecipients.map((u) => ({
                  value: u.id,
                  label: `${u.name} — ${u.designation} (${u.department})`,
                })),
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Feedback Category</label>
              <CustomDropdown
                value={type}
                onChange={(val) => setType(val as any)}
                fullWidth
                options={[
                  { value: 'kudos', label: 'Kudos (Recognition)' },
                  { value: 'constructive', label: 'Constructive (Growth Opportunity)' },
                ]}
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Competency Tag</label>
              <CustomDropdown
                value={competency}
                onChange={setCompetency}
                fullWidth
                options={[
                  { value: 'Collaboration & Craft', label: 'Collaboration & Craft' },
                  { value: 'Technical Mastery', label: 'Technical Mastery' },
                  { value: 'Execution & Reliability', label: 'Execution & Reliability' },
                  { value: 'Leadership & Mentorship', label: 'Leadership & Mentorship' },
                  { value: 'Customer Obsession', label: 'Customer Obsession' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Your Message *</label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Be specific: describe what they did, how it helped the team, and what to keep doing..."
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs"
            />
          </div>

          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors shadow-xs text-xs"
            >
              {isSending ? 'Sending...' : 'Send Feedback'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Selected Feedback Card Page / Executive Presentation Modal */}
      {selectedFeedback && (() => {
        const modalAuthor = allUsers.find((u) => u.id === selectedFeedback.fromUserId)
        const modalRecipient = allUsers.find((u) => u.id === selectedFeedback.toUserId)
        const isKudos = selectedFeedback.type === 'kudos'
        const currentReactions = getFeedbackReactions(selectedFeedback.id)

        return (
          <Modal
            isOpen={!!selectedFeedback}
            onClose={() => setSelectedFeedback(null)}
            title={isKudos ? 'Peer Recognition Certificate' : 'Constructive Growth Card'}
            subtitle={`Card #${selectedFeedback.id.toUpperCase()} • Official Performance Record`}
            maxWidth="xl"
          >
            <div className="space-y-3.5 pt-0.5">
              {/* Luxury Certificate Card Container */}
              <div
                className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-lg transition-all ${
                  isKudos
                    ? 'bg-gradient-to-br from-rose-50/60 via-white to-amber-50/30 dark:from-rose-950/20 dark:via-zinc-900 dark:to-amber-950/10 border-rose-200/80 dark:border-rose-900/40'
                    : 'bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/30 dark:from-indigo-950/20 dark:via-zinc-900 dark:to-blue-950/10 border-indigo-200/80 dark:border-indigo-900/40'
                }`}
              >
                {/* Decorative watermarks and badges */}
                <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-200/80 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        isKudos
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200 ring-1 ring-rose-400/30'
                          : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 ring-1 ring-indigo-400/30'
                      }`}
                    >
                      {isKudos ? (
                        <>
                          <Sparkles className="w-3 h-3 text-rose-600 dark:text-rose-300" />
                          <span>Kudos Recognition</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-3 h-3 text-indigo-600 dark:text-indigo-300" />
                          <span>Growth & Coaching</span>
                        </>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                      <ShieldCheck className="w-3 h-3 text-indigo-600 dark:text-[#4FE3C1]" />
                      <span>{selectedFeedback.isPublic ? 'Public Team Recognition' : 'Direct Colleague Feedback'}</span>
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 flex items-center gap-1 shrink-0">
                    <Calendar className="w-3 h-3" />
                    {formatDate(selectedFeedback.createdAt)}
                  </span>
                </div>

                {/* Author -> Recipient Flow: Symmetrical, Self-Contained & Overflow-Protected */}
                <div className="rounded-xl p-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs border border-slate-200/70 dark:border-zinc-800/80 shadow-xs mb-3.5 overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                    {/* From: Sender */}
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50/80 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-800/60 min-w-0 overflow-hidden">
                      <img
                        src={
                          modalAuthor?.avatar ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                        }
                        alt={modalAuthor?.name || 'Author'}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-400/40 shadow-xs shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                          Recognized By
                        </div>
                        <div className="font-bold text-xs text-slate-900 dark:text-zinc-100 truncate">
                          {modalAuthor?.name || 'A Colleague'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {modalAuthor?.designation || modalAuthor?.department}
                        </div>
                      </div>
                    </div>

                    {/* To: Recipient */}
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/70 dark:border-indigo-900/40 min-w-0 overflow-hidden">
                      <img
                        src={
                          modalRecipient?.avatar ||
                          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'
                        }
                        alt={modalRecipient?.name || 'Recipient'}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-400/50 shadow-xs shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          Honoring
                        </div>
                        <div className="font-bold text-xs text-slate-900 dark:text-zinc-100 truncate">
                          {modalRecipient?.name || 'A Colleague'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {modalRecipient?.designation || modalRecipient?.department}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Competency & Main Quote Block */}
                <div
                  className={`relative p-4 sm:p-5 rounded-xl border transition-all mb-3.5 ${
                    selectedFeedback.type === 'kudos'
                      ? 'bg-rose-500/[0.03] dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/30 border-l-[3px] border-l-rose-500'
                      : 'bg-indigo-500/[0.03] dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-900/30 border-l-[3px] border-l-indigo-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-semibold">
                        Competency
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono border ${
                          selectedFeedback.type === 'kudos'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/25'
                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/25'
                        }`}
                      >
                        {selectedFeedback.type === 'kudos' ? (
                          <Sparkles className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0" />
                        ) : (
                          <Award className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                        )}
                        <span>{selectedFeedback.competency}</span>
                      </span>
                    </div>
                    <Quote
                      className={`w-4 h-4 opacity-40 ${
                        selectedFeedback.type === 'kudos' ? 'text-rose-500' : 'text-indigo-500'
                      }`}
                    />
                  </div>

                  <blockquote className="text-sm sm:text-[14.5px] leading-relaxed font-medium text-slate-800 dark:text-zinc-100 tracking-[-0.012em]">
                    "{selectedFeedback.message}"
                  </blockquote>
                </div>

                {/* Reactions Bar */}
                <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleReact(selectedFeedback.id, 'love')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all text-xs font-semibold active:scale-95 cursor-pointer"
                      title="Heart this recognition"
                    >
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      <span>{currentReactions.love}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReact(selectedFeedback.id, 'clap')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all text-xs font-semibold active:scale-95 cursor-pointer"
                      title="Applause"
                    >
                      <span>👏</span>
                      <span>{currentReactions.clap}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReact(selectedFeedback.id, 'rocket')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all text-xs font-semibold active:scale-95 cursor-pointer"
                      title="Rocket / High impact"
                    >
                      <span>🚀</span>
                      <span>{currentReactions.rocket}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReact(selectedFeedback.id, 'idea')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all text-xs font-semibold active:scale-95 cursor-pointer"
                      title="Insightful feedback"
                    >
                      <span>💡</span>
                      <span>{currentReactions.idea}</span>
                    </button>
                  </div>

                  {/* Copy Link Button */}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors text-xs font-medium shadow-xs cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-[#4FE3C1]" />
                        <span className="text-indigo-600 dark:text-[#4FE3C1] font-semibold">Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy Card Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                  PerformIQ Recognition Network • Verified Feedback Record
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFeedback(null)}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-medium text-xs transition-colors shadow-xs cursor-pointer"
                >
                  Close Card
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}

