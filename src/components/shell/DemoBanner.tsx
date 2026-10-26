import React, { useState } from 'react'
import { Sparkles, X, RotateCcw } from 'lucide-react'
import { useOptionalApp } from '../../app/AppContext'
import { useToast } from '../ui/Toast'
import { ConfirmDialog } from '../ui/Modal'

export const DemoBanner: React.FC = () => {
  const app = useOptionalApp()
  const resetDemoData = app?.resetDemoData
  const toast = useToast()
  const success = toast?.success || console.log
  const [isDismissed, setIsDismissed] = useState(true) // dismissed by default to keep the UI clean
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const handleReset = async () => {
    if (!resetDemoData) return
    setIsResetting(true)
    await resetDemoData()
    setIsResetting(false)
    setShowResetDialog(false)
    success('Demo data restored', 'All mock records have been reset to clean initial seed state.')
  }

  if (isDismissed) {
    return null
  }

  return (
    <>
      <div className="bg-[#101b2b] text-slate-300 text-[11px] px-4 py-1.5 flex items-center justify-between border-b border-[#1e2c42] z-50">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-cyan-950 text-cyan-300 px-2 py-0.2 rounded font-semibold text-[10px] border border-cyan-800/50">
            <Sparkles className="w-3 h-3" /> DEMO PREVIEW
          </span>
          <span className="truncate hidden md:inline text-slate-400">
            Enterprise Performance & Appraisal Management System.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowResetDialog(true)}
            className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Seeds</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-slate-400 hover:text-white p-0.5"
            title="Minimize banner"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleReset}
        title="Reset Demo Prototype State?"
        message="This will restore all employee goals, reviews, cycles, and calibration data back to clean seed data."
        confirmText="Reset State"
        variant="warning"
        isLoading={isResetting}
      />
    </>
  )
}
