import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export type ToastMessage = {
  id: string
  title: string
  description?: string
  type: ToastType
}

type ToastContextType = {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    ({ title, description, type }: Omit<ToastMessage, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      setToasts((prev) => [...prev, { id, title, description, type }])

      setTimeout(() => {
        removeToast(id)
      }, 4500)
    },
    [removeToast]
  )

  const success = useCallback(
    (title: string, description?: string) => addToast({ title, description, type: 'success' }),
    [addToast]
  )
  const error = useCallback(
    (title: string, description?: string) => addToast({ title, description, type: 'error' }),
    [addToast]
  )
  const warning = useCallback(
    (title: string, description?: string) => addToast({ title, description, type: 'warning' }),
    [addToast]
  )
  const info = useCallback(
    (title: string, description?: string) => addToast({ title, description, type: 'info' }),
    [addToast]
  )

  return (
    <ToastContext.Provider value={{ addToast, success, error, warning, info }}>
      {children}
      {/* Toast container overlay */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          let icon = <Info className="w-5 h-5 text-slate-900 dark:text-white flex-shrink-0" />
          let borderClass = 'border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b]'
          if (toast.type === 'success') {
            icon = <CheckCircle2 className="w-5 h-5 toast-success-tick flex-shrink-0" />
            borderClass = 'border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b]'
          } else if (toast.type === 'warning') {
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            borderClass = 'border-amber-200 dark:border-amber-800/80 bg-white dark:bg-[#18181b]'
          } else if (toast.type === 'error') {
            icon = <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            borderClass = 'border-rose-200 dark:border-rose-800/80 bg-white dark:bg-[#18181b]'
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3.5 p-4 rounded-2xl border shadow-xl dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9)] backdrop-blur-md transition-all duration-300 ease-out transform translate-y-0 ${borderClass}`}
              role="alert"
            >
              <div className="mt-0.5">{icon}</div>
              <div className="flex-1 text-sm min-w-0">
                <p className="font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-slate-600 dark:text-zinc-300 text-xs mt-1 leading-snug">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-200 rounded-lg p-1 transition-colors cursor-pointer shrink-0"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

