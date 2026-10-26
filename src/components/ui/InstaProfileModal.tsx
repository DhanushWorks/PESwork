import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Mail,
  Building,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
  Edit2,
  Heart,
  Share2,
  Sparkles,
} from 'lucide-react'
import { User } from '../../types'

type InstaProfileModalProps = {
  user: User | null
  isOpen: boolean
  onClose: () => void
  manager?: User | null
  onEdit?: (user: User) => void
}

// Authentic Instagram Verified Rosette Badge
export const InstaVerifiedBadge: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={`text-[#0095f6] inline-block shrink-0 ${className}`}
    aria-label="Verified Profile"
  >
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.8 14.5l-4-4 1.4-1.4 2.6 2.6 6.8-6.8 1.4 1.4-8.2 8.2z" />
  </svg>
)

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const InstaProfileModal: React.FC<InstaProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  manager,
  onEdit,
}) => {
  const [heartAnim, setHeartAnim] = useState(false)
  const [copied, setCopied] = useState(false)
  const [likesCount, setLikesCount] = useState(128)
  const [isLiked, setIsLiked] = useState(false)

  // Scroll lock & Escape key listener
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !user || typeof document === 'undefined') return null

  const handle = user.name.toLowerCase().replace(/[^a-z0-9]/g, '.')
  const initials = getInitials(user.name)

  const handlePhotoDoubleTap = () => {
    setHeartAnim(true)
    if (!isLiked) {
      setIsLiked(true)
      setLikesCount((prev) => prev + 1)
    }
    setTimeout(() => setHeartAnim(false), 900)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + `/users#${user.employeeCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-black/75 dark:bg-black/85 flex items-center justify-center p-4 overscroll-contain animate-in fade-in duration-200 select-none"
      onClick={onClose}
      onWheel={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onTouchMove={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div
        className="relative bg-white dark:bg-[#121214] text-slate-900 dark:text-white rounded-[28px] border border-slate-200/90 dark:border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.5)] max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar (Instagram Style) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.08]">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
              @{handle}
            </span>
            <InstaVerifiedBadge className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy Profile Link"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-slate-900 dark:text-white" /> : <Share2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Profile Card Body */}
        <div className="p-5 flex flex-col items-center text-center">
          {/* Instagram Story Gradient Ring & Enlarged Avatar */}
          <div
            className="relative cursor-pointer group/photo my-2"
            onClick={handlePhotoDoubleTap}
            title="Double-tap to like photo!"
          >
            {/* Multi-stop vibrant Instagram Story Ring */}
            <div className="p-[3.5px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] via-[#cc2366] to-[#bc1888] shadow-[0_0_25px_rgba(220,39,67,0.35)] group-hover/photo:shadow-[0_0_35px_rgba(220,39,67,0.55)] group-hover/photo:scale-105 active:scale-95 transition-all duration-300">
              <div className="p-[3px] bg-white dark:bg-[#121214] rounded-full">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-36 h-36 sm:w-40 sm:h-40 rounded-full object-cover select-none"
                  />
                ) : (
                  <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-4xl select-none">
                    {initials}
                  </div>
                )}
              </div>
            </div>

            {/* Double-tap Floating Instagram Heart Animation */}
            {heartAnim && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-in duration-200">
                <Heart className="w-20 h-20 text-rose-500 fill-rose-500 drop-shadow-[0_8px_20px_rgba(244,63,94,0.6)] animate-bounce" />
              </div>
            )}
          </div>

          {/* User Name & Instagram-style Verified Tagline */}
          <div className="mt-3">
            <div className="flex items-center justify-center gap-1.5">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {user.name}
              </h2>
              <InstaVerifiedBadge className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mt-0.5">
              {user.designation}
            </p>
            <div className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500 mt-1 font-sans">
              <Building className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
              <span>{user.department}</span>
            </div>
          </div>

          {/* Instagram 3-Column Stats Row */}
          <div className="grid grid-cols-3 gap-2 w-full mt-4 py-3 border-y border-slate-100 dark:border-white/[0.08] text-center">
            <div className="px-2">
              <div className="font-bold font-sans text-xs text-slate-900 dark:text-white">
                {user.employeeCode}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium uppercase tracking-wider">
                ID Code
              </div>
            </div>
            <div className="px-2 border-x border-slate-100 dark:border-white/[0.08]">
              <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center justify-center">
                {user.active ? 'Active' : 'Inactive'}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium uppercase tracking-wider">
                Status
              </div>
            </div>
            <div className="px-2">
              <div className="font-bold text-xs text-slate-900 dark:text-white capitalize">
                {user.role}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium uppercase tracking-wider">
                Role
              </div>
            </div>
          </div>

          {/* Instagram Bio Section */}
          <div className="w-full text-left mt-3.5 space-y-1.5 text-xs text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-white/[0.02] p-3 rounded-2xl border border-slate-100 dark:border-white/[0.06] font-sans text-[11px]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>PerformIQ Enterprise Talent</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 truncate">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <a
                href={`mailto:${user.email}`}
                className="hover:text-slate-900 dark:hover:text-white truncate"
              >
                {user.email}
              </a>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-200/60 dark:border-white/[0.06]">
              <span>Reports to:</span>
              <span className="font-semibold text-slate-700 dark:text-zinc-200">
                {manager ? manager.name : '— (Executive)'}
              </span>
            </div>
          </div>

          {/* Action Buttons (Instagram Profile Style) */}
          <div className="w-full flex items-center gap-2 mt-4">
            <a
              href={`mailto:${user.email}`}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Contact</span>
            </a>

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onEdit(user)
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                <span>Edit</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePhotoDoubleTap}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isLiked
                  ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-500'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border-transparent text-slate-600 dark:text-zinc-300'
              }`}
              title="Like photo"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Instagram Footer Hint */}
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-sans mt-3 select-none flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Double-tap photo to like · Press Esc to close</span>
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}

