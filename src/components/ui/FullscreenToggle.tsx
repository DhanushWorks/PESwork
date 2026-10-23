import React, { useState, useEffect } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'

export interface FullscreenToggleProps {
  className?: string
}

export const FullscreenToggle: React.FC<FullscreenToggleProps> = ({ className = '' }) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false
    return Boolean(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    )
  })

  const [isSupported, setIsSupported] = useState<boolean>(true)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const supported = Boolean(
        document.fullscreenEnabled ||
        (document as any).webkitFullscreenEnabled ||
        (document as any).mozFullScreenEnabled ||
        (document as any).msFullscreenEnabled
      )
      setIsSupported(supported)
    }
  }, [])

  const getIsFullscreen = (): boolean => {
    if (typeof document === 'undefined') return false
    return Boolean(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    )
  }

  const toggleFullscreen = async () => {
    try {
      if (!getIsFullscreen()) {
        const docEl = document.documentElement as any
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen()
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen()
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen()
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen()
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen()
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen()
        }
      }
    } catch (err) {
      console.warn('Fullscreen request blocked or not allowed by browser:', err)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(getIsFullscreen())
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    // Keyboard shortcut: Ctrl+Shift+F or Cmd+Shift+F
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  if (!isSupported) {
    return null
  }

  const title = isFullscreen
    ? 'Exit Full Screen (ESC / Ctrl+Shift+F)'
    : 'Full Screen Mode (Ctrl+Shift+F)'

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      className={`relative p-2 rounded-xl transition-all duration-200 cursor-pointer group active:scale-95 border flex items-center justify-center shrink-0 ${
        isFullscreen
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
          : 'bg-slate-50 dark:bg-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.16] text-slate-700 dark:text-white border-slate-200 dark:border-white/30 hover:border-slate-300 dark:hover:border-white/60 dark:shadow-[0_0_12px_rgba(255,255,255,0.1)]'
      } ${className}`}
      title={title}
      aria-label={title}
    >
      <div className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
        {/* Outward arrows: Maximize */}
        <Maximize2
          strokeWidth={2.4}
          className={`w-4 h-4 absolute transition-all duration-200 ${
            isFullscreen
              ? 'scale-0 rotate-90 opacity-0 pointer-events-none'
              : 'scale-100 rotate-0 opacity-100 group-hover:scale-110 text-slate-800 dark:text-white'
          }`}
        />

        {/* Inward arrows: Minimize */}
        <Minimize2
          strokeWidth={2.4}
          className={`w-4 h-4 absolute transition-all duration-200 ${
            isFullscreen
              ? 'scale-100 rotate-0 opacity-100 group-hover:scale-110 text-white dark:text-slate-900'
              : 'scale-0 -rotate-90 opacity-0 pointer-events-none'
          }`}
        />
      </div>
    </button>
  )
}

