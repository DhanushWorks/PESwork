import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useApp } from '../../app/AppContext'

export interface ThemeToggleProps {
  className?: string
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useApp()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative p-2 rounded-xl transition-all duration-200 cursor-pointer group active:scale-95 border bg-slate-50 dark:bg-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.16] text-slate-700 dark:text-white border-slate-200 dark:border-white/30 hover:border-slate-300 dark:hover:border-white/60 dark:shadow-[0_0_12px_rgba(255,255,255,0.1)] flex items-center justify-center shrink-0 ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
        {/* Sun Icon for Light Mode */}
        <Sun
          strokeWidth={2.4}
          className={`w-4 h-4 text-black dark:text-white absolute transition-transform duration-200 ${
            isDark ? 'scale-0 rotate-90 opacity-0 pointer-events-none' : 'scale-100 rotate-0 opacity-100 group-hover:scale-110'
          }`}
        />

        {/* Moon Icon for Dark Mode */}
        <Moon
          strokeWidth={2.4}
          className={`w-4 h-4 text-white dark:text-white absolute transition-transform duration-200 ${
            isDark ? 'scale-100 rotate-0 opacity-100 group-hover:scale-110' : 'scale-0 -rotate-90 opacity-0 pointer-events-none'
          }`}
        />
      </div>
    </button>
  )
}

