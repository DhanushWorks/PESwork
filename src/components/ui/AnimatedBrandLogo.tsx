import React, { useState } from 'react'
import { Link } from 'react-router-dom'

export interface AnimatedBrandLogoProps {
  className?: string
  logoSize?: string
  textSize?: string
  interactive?: boolean
  showGlow?: boolean
  showIcon?: boolean
  to?: string
}

const BRAND_NAME = 'PerformIQ'

export const AnimatedBrandLogo: React.FC<AnimatedBrandLogoProps> = ({
  className = '',
  logoSize = 'w-7 h-7',
  textSize = 'text-base sm:text-lg font-semibold tracking-tight',
  interactive = true,
  showGlow = false,
  showIcon = false,
  to,
}) => {
  const [animKey, setAnimKey] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  const handleReplay = (e: React.MouseEvent) => {
    if (interactive) {
      setAnimKey((prev) => prev + 1)
    }
  }

  const letters = Array.from(BRAND_NAME)

  const content = (
    <div
      key={animKey}
      onClick={handleReplay}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group/logo inline-flex items-center justify-center gap-2 select-none cursor-pointer shrink-0 whitespace-nowrap ${className}`}
      title="PerformIQ - Click to view dashboard"
      aria-label="PerformIQ"
    >
      {/* Logo Icon with Spring Entrance Pop (Optional - hidden in ChatGPT header style) */}
      {showIcon && (
        <div className="relative flex items-center justify-center shrink-0">
          {showGlow && (
            <div className="absolute inset-0 w-8 h-8 -left-0.5 -top-0.5 bg-neutral-500/10 dark:bg-neutral-400/15 rounded-full blur-md opacity-0 group-hover/logo:opacity-100 transition-opacity duration-300 pointer-events-none" />
          )}

          <img
            src="/logo.png"
            alt="PerformIQ Logo"
            className={`${logoSize} object-contain dark:hidden animate-logo-pop transition-transform duration-300 group-hover/logo:scale-110`}
          />
          <img
            src="/logo-white.png"
            alt="PerformIQ Logo"
            className={`${logoSize} object-contain hidden dark:block animate-logo-pop transition-transform duration-300 group-hover/logo:scale-110`}
          />
        </div>
      )}

      {/* Letters Cascading Motion - Clean ChatGPT Style (No Blue Accent) */}
      <span
        className={`${textSize} flex items-center shrink-0 whitespace-nowrap text-slate-900 dark:text-white font-semibold tracking-tight`}
        aria-hidden="true"
      >
        {letters.map((char, idx) => {
          const dropDelay = `${280 + idx * 45}ms`
          const waveDelay = `${idx * 35}ms`

          return (
            <span
              key={`${animKey}-${idx}`}
              style={{
                animationDelay: isHovered ? waveDelay : dropDelay,
              }}
              className={`inline-block ${
                isHovered ? 'animate-letter-wave' : 'animate-letter-drop'
              } text-slate-900 dark:text-white font-semibold transition-colors duration-200`}
            >
              {char}
            </span>
          )
        })}
      </span>
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center shrink-0 whitespace-nowrap focus:outline-hidden">
        {content}
      </Link>
    )
  }

  return content
}
