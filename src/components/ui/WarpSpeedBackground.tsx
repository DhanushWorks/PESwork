import React, { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  z: number
  pz: number
  color: string
  size: number
}

interface WarpSpeedBackgroundProps {
  className?: string
  starCount?: number
  speed?: number
  warpSpeed?: number
  colors?: string[]
}

const DEFAULT_COLORS = [
  '#ffffff',
  '#e0e7ff',
  '#818cf8',
  '#6366f1',
  '#38bdf8',
  '#c084fc',
]

export const WarpSpeedBackground: React.FC<WarpSpeedBackgroundProps> = ({
  className = '',
  starCount = 550,
  speed = 1.4,
  warpSpeed = 6.5,
  colors = DEFAULT_COLORS,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = window.innerWidth
    let height = window.innerHeight
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    // Center focal point
    let targetCx = width / 2
    let targetCy = height / 2
    let currentCx = targetCx
    let currentCy = targetCy

    let isWarping = false
    let currentSpeed = speed

    const maxDepth = 1200
    const stars: Star[] = []

    const initStar = (star?: Star): Star => {
      const angle = Math.random() * Math.PI * 2
      // Distribute stars outwards in a disc/cylinder
      const distance = Math.sqrt(Math.random()) * Math.max(width, height) * 0.9

      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        z: star ? maxDepth : Math.random() * maxDepth,
        pz: star ? maxDepth : Math.random() * maxDepth,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 1.5 + 0.8,
      }
    }

    const resize = () => {
      if (!canvas) return
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      ctx.scale(dpr, dpr)

      targetCx = width / 2
      targetCy = height / 2
      currentCx = targetCx
      currentCy = targetCy
    }

    resize()
    window.addEventListener('resize', resize)

    // Populate initial stars
    for (let i = 0; i < starCount; i++) {
      stars.push(initStar())
    }

    // Parallax mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      const offsetX = (e.clientX - width / 2) * 0.12
      const offsetY = (e.clientY - height / 2) * 0.12
      targetCx = width / 2 + offsetX
      targetCy = height / 2 + offsetY
    }

    // Warp acceleration on press/touch
    const handlePointerDown = () => {
      isWarping = true
    }
    const handlePointerUp = () => {
      isWarping = false
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('mouseup', handlePointerUp)
    window.addEventListener('touchstart', handlePointerDown, { passive: true })
    window.addEventListener('touchend', handlePointerUp, { passive: true })

    const focalLength = 320

    const render = () => {
      // Smoothly interpolate center
      currentCx += (targetCx - currentCx) * 0.05
      currentCy += (targetCy - currentCy) * 0.05

      // Smooth acceleration into hyperspace
      const targetSpeed = isWarping ? warpSpeed : speed
      currentSpeed += (targetSpeed - currentSpeed) * 0.08

      // Semi-transparent fade creates hyperspace velocity streaks
      ctx.fillStyle = isWarping ? 'rgba(7, 7, 10, 0.35)' : 'rgba(9, 9, 12, 0.28)'
      ctx.fillRect(0, 0, width, height)

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i]

        star.pz = star.z
        star.z -= currentSpeed

        if (star.z <= 0) {
          const fresh = initStar(star)
          star.x = fresh.x
          star.y = fresh.y
          star.z = fresh.z
          star.pz = fresh.z
          continue
        }

        // Current perspective projected coordinates
        const k = focalLength / star.z
        const px = star.x * k + currentCx
        const py = star.y * k + currentCy

        // Previous position for drawing light streaks
        const pk = focalLength / star.pz
        const ppx = star.x * pk + currentCx
        const ppy = star.y * pk + currentCy

        // Verify if star is on screen
        if (px < -50 || px > width + 50 || py < -50 || py > height + 50) {
          const fresh = initStar(star)
          star.x = fresh.x
          star.y = fresh.y
          star.z = fresh.z
          star.pz = fresh.z
          continue
        }

        // Depth-based intensity
        const depthRatio = 1 - star.z / maxDepth
        const alpha = Math.max(0.15, Math.min(1, depthRatio * 1.3))
        const thickness = Math.max(0.7, star.size * (1 + depthRatio * 1.2))

        ctx.lineWidth = thickness
        ctx.strokeStyle = star.color
        ctx.globalAlpha = alpha

        ctx.beginPath()
        ctx.moveTo(ppx, ppy)
        ctx.lineTo(px, py)
        ctx.stroke()

        // Core star point
        ctx.fillStyle = star.color
        ctx.beginPath()
        ctx.arc(px, py, thickness * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('mouseup', handlePointerUp)
      window.removeEventListener('touchstart', handlePointerDown)
      window.removeEventListener('touchend', handlePointerUp)
      cancelAnimationFrame(animationFrameId)
    }
  }, [starCount, speed, warpSpeed, colors])

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none select-none z-0 ${className}`}
      aria-hidden="true"
    />
  )
}

