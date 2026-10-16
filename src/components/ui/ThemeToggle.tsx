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
      className={`group relative h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-transform duration-100 active:scale-90 flex-shrink-0 focus:outline-hidden cursor-pointer shadow-2xs ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
        {/* Sun Icon for Light Mode */}
        <Sun
          className={`w-4 h-4 text-amber-500 absolute transition-transform duration-200 ${
            isDark ? 'scale-0 rotate-90 opacity-0 pointer-events-none' : 'scale-100 rotate-0 opacity-100'
          }`}
        />

        {/* Moon Icon for Dark Mode */}
        <Moon
          className={`w-4 h-4 text-sky-400 absolute transition-transform duration-200 ${
            isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0 pointer-events-none'
          }`}
        />
      </div>
    </button>
  )
}

