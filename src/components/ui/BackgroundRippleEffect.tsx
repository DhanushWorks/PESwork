import React, { useEffect, useRef, useCallback } from 'react'
import { useApp } from '../../app/AppContext'

interface BackgroundRippleEffectProps {
  className?: string
  cellSize?: number
  interactive?: boolean
}

interface RippleWave {
  id: number
  x: number
  y: number
  startTime: number
  maxRadius: number
  speed: number // px per ms
  duration: number // total ms
}

export const BackgroundRippleEffect: React.FC<BackgroundRippleEffectProps> = ({
  className = '',
  cellSize = 54,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { theme } = useApp()
  const isDark = theme === 'dark'

  // Waves list in a ref so canvas loop accesses it with 0 re-render overhead
  const wavesRef = useRef<RippleWave[]>([])
  const waveIdCounter = useRef(0)
  const animFrameRef = useRef<number | null>(null)
  const mouseCellRef = useRef<{ row: number; col: number } | null>(null)
  const isRunningRef = useRef(false)

  // Trigger a new ripple wave
  const addRippleWave = useCallback((x: number, y: number, speedMultiplier = 1) => {
    const width = window.innerWidth
    const height = window.innerHeight
    const maxDimension = Math.hypot(width, height)
    
    waveIdCounter.current += 1
    const newWave: RippleWave = {
      id: waveIdCounter.current,
      x,
      y,
      startTime: performance.now(),
      maxRadius: maxDimension * 1.1,
      speed: 0.45 * speedMultiplier, // px per ms
      duration: (maxDimension * 1.1) / (0.45 * speedMultiplier) + 600,
    }

    wavesRef.current.push(newWave)
    startAnimationLoop()
  }, [])

  // Start animation loop if not currently running
  const startAnimationLoop = useCallback(() => {
    if (isRunningRef.current) return
    isRunningRef.current = true

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const render = () => {
      const now = performance.now()
      const width = canvas.width / (window.devicePixelRatio || 1)
      const height = canvas.height / (window.devicePixelRatio || 1)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      // Filter out completed waves
      wavesRef.current = wavesRef.current.filter((w) => now - w.startTime < w.duration)

      // Base background color
      const currentDark = document.documentElement.classList.contains('dark')
      const bgColor = currentDark ? '#070709' : '#f0f2f5'
      const gridBorderColor = currentDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(203, 213, 225, 0.55)'

      // Clear Canvas
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, width, height)

      // Compute Grid columns and rows
      const cols = Math.ceil(width / cellSize) + 1
      const rows = Math.ceil(height / cellSize) + 1

      // Render cells with ripple waves
      const waves = wavesRef.current
      const hasWaves = waves.length > 0
      const hoverCell = mouseCellRef.current

      // Pre-compute current radii and opacities for active waves
      const activeWaveCalculations = waves.map((w) => {
        const elapsed = now - w.startTime
        const currentRadius = elapsed * w.speed
        const progress = Math.min(1, elapsed / w.duration)
        const waveFade = Math.max(0, 1 - progress)
        return {
          ...w,
          currentRadius,
          waveFade,
          waveThickness: 90, // px band width of wave
        }
      })

      // Draw each cell in the grid
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cellX = c * cellSize
          const cellY = r * cellSize
          const cellCenterX = cellX + cellSize / 2
          const cellCenterY = cellY + cellSize / 2

          let waveIntensity = 0

          if (hasWaves) {
            for (let i = 0; i < activeWaveCalculations.length; i++) {
              const w = activeWaveCalculations[i]
              const dist = Math.hypot(cellCenterX - w.x, cellCenterY - w.y)
              const diff = Math.abs(dist - w.currentRadius)

              if (diff < w.waveThickness) {
                // Peak at diff == 0, falling off to edges of band
                const bandPos = 1 - diff / w.waveThickness
                // Smooth sinusoidal wave envelope
                const smoothEnvelope = Math.sin((bandPos * Math.PI) / 2)
                const intensity = smoothEnvelope * w.waveFade
                if (intensity > waveIntensity) {
                  waveIntensity = intensity
                }
              }
            }
          }

          // Check for mouse hover
          const isHovered = hoverCell && hoverCell.row === r && hoverCell.col === c
          if (isHovered && waveIntensity < 0.3) {
            waveIntensity = 0.3
          }

          // Fill cell if illuminated by wave or hover
          if (waveIntensity > 0.02) {
            if (currentDark) {
              // Glowing Cyber Indigo & Violet in Dark Mode
              const alpha = Math.min(0.85, waveIntensity * 0.9)
              const rG = Math.round(99 + waveIntensity * 50)
              const gG = Math.round(102 + waveIntensity * 60)
              const bG = 241
              ctx.fillStyle = `rgba(${rG}, ${gG}, ${bG}, ${alpha})`
              ctx.fillRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1)

              // Cell inner highlight glow
              if (waveIntensity > 0.45) {
                ctx.fillStyle = `rgba(255, 255, 255, ${waveIntensity * 0.4})`
                ctx.fillRect(cellX + 2, cellY + 2, cellSize - 4, cellSize - 4)
              }
            } else {
              // Crisp Luminous White & Sky Blue in Light Mode
              const alpha = Math.min(0.9, waveIntensity * 0.95)
              ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
              ctx.fillRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1)

              if (waveIntensity > 0.4) {
                ctx.fillStyle = `rgba(99, 102, 241, ${waveIntensity * 0.15})`
                ctx.fillRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2)
              }
            }
          }

          // Draw Grid Cell Border
          ctx.strokeStyle = gridBorderColor
          ctx.lineWidth = 0.6
          ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellSize, cellSize)
        }
      }

      // If active waves exist or mouse is moving, continue loop; otherwise sleep
      if (wavesRef.current.length > 0) {
        animFrameRef.current = requestAnimationFrame(render)
      } else {
        isRunningRef.current = false
        animFrameRef.current = null
      }
    }

    animFrameRef.current = requestAnimationFrame(render)
  }, [cellSize])

  // Handle Resize & DPR
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx.scale(dpr, dpr)

    // Redraw frame immediately
    startAnimationLoop()
  }, [startAnimationLoop])

  useEffect(() => {
    handleResize()
    window.addEventListener('resize', handleResize)

    // Launch pleasant initial epicenter ripple on load
    const timer = setTimeout(() => {
      addRippleWave(window.innerWidth / 2, window.innerHeight / 2, 0.8)
    }, 180)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timer)
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      isRunningRef.current = false
    }
  }, [handleResize, addRippleWave])

  // React to theme changes smoothly with instantaneous frame refresh
  useEffect(() => {
    startAnimationLoop()
  }, [isDark, startAnimationLoop])

  // Mouse / Touch Interaction Handlers
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    addRippleWave(x, y, 1.1)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const col = Math.floor(x / cellSize)
    const row = Math.floor(y / cellSize)

    if (
      !mouseCellRef.current ||
      mouseCellRef.current.col !== col ||
      mouseCellRef.current.row !== row
    ) {
      mouseCellRef.current = { col, row }
      startAnimationLoop()
    }
  }

  const handleMouseLeave = () => {
    mouseCellRef.current = null
    startAnimationLoop()
  }

  return (
    <div
      className={`fixed inset-0 overflow-hidden pointer-events-auto select-none z-0 flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      {/* 60fps GPU-Accelerated Canvas (0 DOM Node Lag) */}
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="absolute inset-0 w-full h-full cursor-pointer touch-none block"
      />

      {/* Radial Vignette: Smooth dark/light depth gradient around boundaries */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_30%,#f0f2f5_85%)] dark:bg-[radial-gradient(circle_at_center,transparent_25%,#070709_88%)] opacity-85 transition-colors duration-300" />
    </div>
  )
}
