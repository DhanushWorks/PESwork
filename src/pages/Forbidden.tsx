import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft, RotateCcw, AlertTriangle } from 'lucide-react'
import { useOptionalApp } from '../app/AppContext'
import { useRouteError } from 'react-router-dom'

export const Forbidden: React.FC = () => {
  const app = useOptionalApp()
  const role = app?.currentUser?.role || 'employee'

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="dark-glass-card rounded-2xl p-8 max-w-md w-full border border-amber-500/30 flex flex-col items-center text-center shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F0F3FA] tracking-tight">Access Restricted</h1>
        <p className="text-sm text-slate-600 dark:text-zinc-300 max-w-md mt-2 font-sans">
          This area is restricted to specific role permissions. Your current demo role is{' '}
          <strong className="capitalize text-slate-800 dark:text-[#F0F3FA]">{role}</strong>.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            to={`/${role}`}
            className="premium-glow-btn h-10 px-5 text-xs font-semibold cursor-pointer inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export const NotFound: React.FC = () => {
  const app = useOptionalApp()
  const role = app?.currentUser?.role || 'employee'

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="dark-glass-card rounded-2xl p-8 max-w-md w-full border border-slate-200 dark:border-white/10 flex flex-col items-center text-center shadow-lg">
        <div className="text-5xl font-black text-slate-900 dark:text-white mb-2 font-sans">404</div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-[#F0F3FA]">Page Not Found</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-300 max-w-sm mt-1 font-sans">
          The workspace path you navigated to does not exist or has moved.
        </p>
        <Link
          to={`/${role}`}
          className="mt-6 premium-glow-btn h-10 px-5 text-xs font-semibold cursor-pointer inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Workspace</span>
        </Link>
      </div>
    </div>
  )
}

export const RouteErrorBoundary: React.FC = () => {
  const app = useOptionalApp()
  const role = app?.currentUser?.role || 'employee'
  const error = useRouteError() as any

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="dark-glass-card rounded-2xl p-8 max-w-md w-full border border-rose-500/30 flex flex-col items-center text-center shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-[#F0F3FA] tracking-tight">Something went wrong</h1>
        <p className="text-xs text-slate-500 dark:text-zinc-300 max-w-md mt-1.5 leading-relaxed font-sans">
          {error?.message || 'An unexpected error occurred while loading this view.'}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="premium-glow-btn h-10 px-4 text-xs font-semibold cursor-pointer inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload Page</span>
          </button>
          <Link
            to={`/${role}`}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[14px] border border-slate-200 dark:border-white/12 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-[#E6E9F2] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-semibold shadow-xs transition-all cursor-pointer font-sans"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

