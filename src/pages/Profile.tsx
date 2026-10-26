import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../app/AppContext'
import { useToast } from '../components/ui/Toast'
import { peopleService } from '../services'
import { RoleBadge } from '../components/ui/Badge'
import { formatDate } from '../lib/formatters'
import {
  CheckCheck,
  Copy,
  Camera,
  Upload,
  Sparkles,
  Link as LinkIcon,
  X,
  Check,
  RotateCcw,
  User,
} from 'lucide-react'

const PRESET_AVATARS = [
  { id: '1', label: 'Eleanor', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=250&auto=format&fit=crop&q=80' },
  { id: '2', label: 'Alex', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250&auto=format&fit=crop&q=80' },
  { id: '3', label: 'Marcus', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=250&auto=format&fit=crop&q=80' },
  { id: '4', label: 'Sarah', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=250&auto=format&fit=crop&q=80' },
  { id: '5', label: 'James', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=250&auto=format&fit=crop&q=80' },
  { id: '6', label: 'Elena', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=250&auto=format&fit=crop&q=80' },
  { id: '7', label: 'Maya', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=250&auto=format&fit=crop&q=80' },
  { id: '8', label: 'David', url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=250&auto=format&fit=crop&q=80' },
]

/**
 * Resizes and center-crops an uploaded image file into a square avatar data URL (< 50KB)
 */
function resizeImageToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 320
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(e.target?.result as string)
          return
        }

        // Center crop to square
        const minDim = Math.min(img.width, img.height)
        const sx = (img.width - minDim) / 2
        const sy = (img.height - minDim) / 2

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.88))
      }
      img.onerror = () => reject(new Error('Failed to load selected image.'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsDataURL(file)
  })
}

export const Profile: React.FC = () => {
  const { currentUser, allUsers, refreshData } = useApp()
  const { success, error } = useToast()

  const [name, setName] = useState(currentUser.name)
  const [designation, setDesignation] = useState(currentUser.designation)
  const [department, setDepartment] = useState(currentUser.department)
  const [avatar, setAvatar] = useState(currentUser.avatar || '')

  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Photo modal & customization states
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [photoTab, setPhotoTab] = useState<'upload' | 'gallery' | 'url'>('upload')
  const [modalTempAvatar, setModalTempAvatar] = useState(currentUser.avatar || '')
  const [customUrlInput, setCustomUrlInput] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const modalFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(currentUser.name || '')
    setDesignation(currentUser.designation || '')
    setDepartment(currentUser.department || '')
    setAvatar(currentUser.avatar || '')
  }, [currentUser.id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPhotoModal) {
        setShowPhotoModal(false)
      }
    }
    if (showPhotoModal) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showPhotoModal])

  const manager = allUsers.find((u) => u.id === currentUser.managerId)

  const handleCopy = (text: string, field: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Direct photo save helper
  const handleApplyPhoto = async (newPhotoUrl: string) => {
    setIsSaving(true)
    try {
      setAvatar(newPhotoUrl)
      const updated = await peopleService.update(currentUser.id, {
        avatar: newPhotoUrl,
      })
      if (updated?.avatar) {
        setAvatar(updated.avatar)
      }
      await refreshData()
      setShowPhotoModal(false)
      success('Profile photo updated', 'Your new profile photo has been saved successfully.')
    } catch (err: any) {
      error('Update failed', err.message || 'Could not update profile photo.')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle file chosen from device
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isFromModal = false) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      error('Invalid file type', 'Please select an image file (PNG, JPG, WebP).')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      error('File too large', 'Please choose an image under 10MB.')
      return
    }

    setIsUploadingPhoto(true)
    try {
      const resized = await resizeImageToAvatar(file)
      if (isFromModal) {
        setModalTempAvatar(resized)
      } else {
        await handleApplyPhoto(resized)
      }
    } catch (err: any) {
      error('Photo processing failed', err.message || 'Could not process selected image.')
    } finally {
      setIsUploadingPhoto(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      error('Name required', 'Please provide a valid full name.')
      return
    }

    setIsSaving(true)
    try {
      const updated = await peopleService.update(currentUser.id, {
        name: name.trim(),
        designation: designation.trim(),
        department: department.trim(),
        avatar: avatar || currentUser.avatar,
      })
      if (updated?.avatar) {
        setAvatar(updated.avatar)
      }
      await refreshData()
      success('Profile updated', 'Your display details and profile photo were saved successfully.')
    } catch (err: any) {
      error('Update failed', err.message || 'Could not update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 w-full pb-20 sm:pb-24 lg:pb-16 font-sans">
      {/* 1. PERSONAL IDENTITY & ACTIVE ACCOUNT */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="pb-3 border-b border-slate-200 dark:border-white/[0.08]">
          <h2 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-sans">
            Personal Identity & Active Account
          </h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Avatar & Identity Header Card with Edit Photo Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08]">
            <div className="flex items-center gap-5">
              {/* Interactive Profile Photo Container */}
              <div
                className="relative group cursor-pointer shrink-0"
                onClick={() => {
                  setModalTempAvatar(avatar || currentUser.avatar || '')
                  setShowPhotoModal(true)
                }}
                title="Click to edit profile photo"
              >
                <img
                  src={avatar || currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser.name}
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover ring-2 ring-slate-200 dark:ring-white/10 shadow-md group-hover:ring-slate-400 dark:group-hover:ring-white/30 transition-all"
                />

                {/* Hover Camera Overlay */}
                <div className="absolute inset-0 rounded-full bg-black/45 backdrop-blur-[1px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px] font-semibold tracking-wide">Edit</span>
                </div>

                {/* Bottom-right Camera Badge Icon */}
                <button
                  type="button"
                  title="Change profile photo"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md ring-2 ring-white dark:ring-zinc-900 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Direct hidden file input for immediate device upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleFileChange(e, false)}
              />

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base text-slate-900 dark:text-[#F0F3FA] truncate">
                    {name || currentUser.name}
                  </span>
                  <RoleBadge role={currentUser.role} />
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-300 font-sans truncate">{currentUser.email}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-300/70 font-sans">
                  Member of {department || currentUser.department} department · Managed by{' '}
                  {manager ? `${manager.name} (${manager.designation})` : 'Executive Board'}
                </p>
              </div>
            </div>

            {/* Quick Action Photo Buttons */}
            <div className="flex items-center gap-2.5 sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto || isSaving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/80 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {isUploadingPhoto ? 'Processing...' : 'Upload Photo'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTempAvatar(avatar || currentUser.avatar || '')
                  setShowPhotoModal(true)
                }}
                className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/[0.1] transition-colors cursor-pointer"
              >
                Choose Photo
              </button>
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

      {/* 3. PROFILE PHOTO CUSTOMIZER MODAL */}
      {showPhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 dark:bg-black/60 transition-all animate-in fade-in duration-200 overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPhotoModal(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-modal-title"
            className="relative w-full max-w-md sm:max-w-lg rounded-2xl bg-white dark:bg-[#18181b] border border-slate-200/90 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[calc(100dvh-2.5rem)] sm:max-h-[min(90vh,600px)] overflow-hidden my-auto animate-in zoom-in-95 duration-150"
          >
            {/* Fixed Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
              <div>
                <h3 id="photo-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Update Profile Photo
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-sans">
                  Upload an image from your device, pick an avatar, or enter a web link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="px-5 sm:px-6 py-4 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4 font-sans text-xs">
              {/* Compact Live Preview Row */}
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200/80 dark:border-zinc-800/80">
                <div className="relative shrink-0">
                  <img
                    src={modalTempAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250'}
                    alt="Preview"
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-200 dark:ring-zinc-700 shadow-sm"
                  />
                  <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-emerald-500 text-white shadow-xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                </div>
                <div className="space-y-0.5 min-w-0">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                    Live Preview
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal">
                    This photo will display across your profile, appraisal cards, and team rosters.
                  </p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPhotoTab('upload')}
                  className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    photoTab === 'upload'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoTab('gallery')}
                  className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    photoTab === 'gallery'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Avatar Gallery
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoTab('url')}
                  className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    photoTab === 'url'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  Image URL
                </button>
              </div>

              {/* Tab 1: Upload from Device */}
              {photoTab === 'upload' && (
                <div className="space-y-3">
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, true)}
                  />
                  <div
                    onClick={() => modalFileInputRef.current?.click()}
                    className="p-5 rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600 bg-slate-50/50 dark:bg-zinc-900/30 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 grid place-items-center text-slate-700 dark:text-zinc-300">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                        Click to choose image from your computer
                      </span>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                        Supports JPG, PNG, or WebP. Auto-crops & optimizes instantly.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Gallery of Pre-sets */}
              {photoTab === 'gallery' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Select any high-resolution enterprise avatar:
                  </p>
                  <div className="grid grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                    {PRESET_AVATARS.map((p) => {
                      const isSelected = modalTempAvatar === p.url
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setModalTempAvatar(p.url)}
                          className={`relative rounded-xl p-1.5 transition-all text-center cursor-pointer group ${
                            isSelected
                              ? 'ring-2 ring-slate-900 dark:ring-white bg-slate-100 dark:bg-zinc-800'
                              : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60'
                          }`}
                        >
                          <img
                            src={p.url}
                            alt={p.label}
                            className="w-13 h-13 mx-auto rounded-full object-cover shadow-2xs group-hover:scale-105 transition-transform"
                          />
                          <span className="text-[10px] font-medium text-slate-700 dark:text-zinc-300 mt-1 block truncate">
                            {p.label}
                          </span>
                          {isSelected && (
                            <div className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: Custom Image URL */}
              {photoTab === 'url' && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">
                    Paste Web Image URL (HTTPS)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/my-photo.jpg"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-slate-400 dark:focus:ring-zinc-600 font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customUrlInput.trim().startsWith('http')) {
                          setModalTempAvatar(customUrlInput.trim())
                        } else {
                          error('Invalid URL', 'Please enter a valid HTTP or HTTPS image URL.')
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                    >
                      Preview
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                    Tip: Use direct image links from Unsplash, GitHub, or LinkedIn CDN.
                  </p>
                </div>
              )}
            </div>

            {/* Fixed Footer Actions */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-slate-50/90 dark:bg-[#18181b]/95 z-10">
              <button
                type="button"
                onClick={() => {
                  const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250'
                  setModalTempAvatar(defaultAvatar)
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Default
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleApplyPhoto(modalTempAvatar)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Photo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
