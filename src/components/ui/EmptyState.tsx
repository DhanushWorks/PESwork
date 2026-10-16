import React from 'react'
import { FolderOpen } from 'lucide-react'

type EmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center flex flex-col items-center justify-center my-4">
      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-3 border border-slate-100">
        {icon || <FolderOpen className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mt-1 leading-relaxed">{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0891b2] hover:bg-[#0e7490] text-white text-xs font-semibold shadow-xs transition-colors"
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  )
}

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="w-full bg-white rounded-xl border border-slate-200/80 p-6 space-y-4 animate-pulse">
      <div className="h-6 bg-slate-100 rounded w-1/4"></div>
      <div className="h-4 bg-slate-100 rounded w-1/2"></div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-50 rounded w-full border border-slate-100"></div>
        ))}
      </div>
    </div>
  )
}

