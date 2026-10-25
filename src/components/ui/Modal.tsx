import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  overflowVisible?: boolean
  footer?: React.ReactNode
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
  formId?: string
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'lg',
  overflowVisible = false,
  footer,
  onSubmit,
  formId,
}) => {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth]

  const modalBody = (
    <>
      {/* Scrollable Content Body */}
      <div
        className={`p-4 sm:p-6 flex-1 min-h-0 text-slate-900 dark:text-zinc-100 ${
          overflowVisible ? 'overflow-visible' : 'overflow-y-auto overscroll-contain'
        }`}
      >
        {children}
      </div>

      {/* Fixed Footer at bottom */}
      {footer && (
        <div className="shrink-0 border-t border-slate-100 dark:border-zinc-800/80 px-5 sm:px-6 py-3.5 bg-slate-50/90 dark:bg-[#18181b]/95 backdrop-blur-xs flex items-center justify-end gap-2.5 z-10">
          {footer}
        </div>
      )}
    </>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md transition-all animate-in fade-in duration-200 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`w-full ${widthClasses} bg-white dark:bg-[#18181b] menu-solid-bg modal-surface rounded-2xl shadow-2xl border border-slate-200/90 dark:border-zinc-700/80 transform transition-all animate-in zoom-in-95 duration-150 flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[min(90vh,calc(100vh-2rem))] my-auto overflow-hidden`}
      >
        {/* Fixed Header */}
        <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-zinc-700/80 shrink-0">
          <div>
            <h2 id="modal-title" className="text-base sm:text-lg font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 ml-3"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Footer Area */}
        {onSubmit ? (
          <form
            id={formId}
            onSubmit={onSubmit}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            {modalBody}
          </form>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {modalBody}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

type ConfirmDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary' | 'warning'
  isLoading?: boolean
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isLoading = false,
}) => {
  if (!isOpen) return null

  let btnColor = 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 focus:ring-slate-400'
  if (variant === 'danger') {
    btnColor = 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500'
  } else if (variant === 'warning') {
    btnColor = 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500'
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      footer={
        <>
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-slate-200 dark:border-zinc-700 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-offset-1 cursor-pointer ${btnColor}`}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">{message}</p>
    </Modal>
  )
}

