import React, { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

export interface AnimatedSearchBarProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  value: string
  onChangeValue?: (val: string) => void
  animatedText?: string
  animatedPlaceholders?: string[]
  containerClassName?: string
  variant?: 'pill' | 'rounded'
  sizeVariant?: 'xs' | 'sm' | 'md' | 'lg' | 'default'
  showClearButton?: boolean
  showShortcut?: boolean
  shortcutKey?: string
  expandOnFocus?: boolean
  children?: React.ReactNode
}

export const AnimatedSearchBar: React.FC<AnimatedSearchBarProps> = ({
  value,
  onChange,
  onChangeValue,
  animatedText,
  animatedPlaceholders,
  placeholder = 'Search...',
  containerClassName = '',
  variant = 'pill',
  sizeVariant = 'sm',
  showClearButton = true,
  showShortcut = false,
  shortcutKey = '',
  expandOnFocus = true,
  children,
  className = '',
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Primary phrase to type out once: "once if it come that all"
  const targetPhrase = React.useMemo(() => {
    if (animatedText) return animatedText
    if (animatedPlaceholders && animatedPlaceholders.length > 0) return animatedPlaceholders[0]
    return placeholder || 'Search...'
  }, [animatedText, animatedPlaceholders, placeholder])

  // Single forward typing state: types once and stays permanently
  const [currentText, setCurrentText] = useState('')
  const [hasFinishedTyping, setHasFinishedTyping] = useState(false)

  useEffect(() => {
    // If text is already entered or typing finished, stop
    if ((value && value.length > 0) || hasFinishedTyping) return

    let timer: ReturnType<typeof setTimeout>

    if (currentText.length < targetPhrase.length) {
      timer = setTimeout(() => {
        setCurrentText(targetPhrase.slice(0, currentText.length + 1))
      }, 40)
    } else {
      setHasFinishedTyping(true)
    }

    return () => clearTimeout(timer)
  }, [currentText, targetPhrase, value, hasFinishedTyping])

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onChangeValue) {
      onChangeValue('')
    }
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    if (onFocus) onFocus(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    if (onBlur) onBlur(e)
  }

  const isPill = variant === 'pill'

  // Refined compact sizes that fit cleanly in headers and toolbars
  const sizeConfig = {
    xs: {
      height: 'h-7',
      padding: 'px-2.5',
      text: 'text-[11px]',
      icon: 'w-3 h-3 mr-1.5',
      defaultWidth: 'w-36 sm:w-44',
      focusWidth: expandOnFocus ? 'focus-within:w-44 sm:focus-within:w-52' : '',
    },
    sm: {
      height: 'h-8', // 32px height - sleek compact header size
      padding: 'px-2.5',
      text: 'text-xs',
      icon: 'w-3.5 h-3.5 mr-2',
      defaultWidth: 'w-44 sm:w-52',
      focusWidth: expandOnFocus ? 'focus-within:w-52 sm:focus-within:w-64' : '',
    },
    md: {
      height: 'h-9', // 36px height
      padding: 'px-3',
      text: 'text-xs',
      icon: 'w-3.5 h-3.5 mr-2',
      defaultWidth: 'w-52 sm:w-60',
      focusWidth: expandOnFocus ? 'focus-within:w-60 sm:focus-within:w-72' : '',
    },
    lg: {
      height: 'h-10', // 40px height
      padding: 'px-3.5',
      text: 'text-xs sm:text-sm',
      icon: 'w-4 h-4 mr-2.5',
      defaultWidth: 'w-60 sm:w-72',
      focusWidth: expandOnFocus ? 'focus-within:w-72 sm:focus-within:w-80' : '',
    },
    default: {
      height: 'h-8.5', // 34px compact height
      padding: 'px-3',
      text: 'text-xs',
      icon: 'w-3.5 h-3.5 mr-2',
      defaultWidth: 'w-48 sm:w-56',
      focusWidth: expandOnFocus ? 'focus-within:w-56 sm:focus-within:w-64' : '',
    },
  }[sizeVariant] || {
    height: 'h-8',
    padding: 'px-2.5',
    text: 'text-xs',
    icon: 'w-3.5 h-3.5 mr-2',
    defaultWidth: 'w-44 sm:w-52',
    focusWidth: expandOnFocus ? 'focus-within:w-52 sm:focus-within:w-64' : '',
  }

  useEffect(() => {
    if (props.autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [props.autoFocus])

  const displayText = hasFinishedTyping ? targetPhrase : currentText
  const hasCustomWidth = /\b(w-|max-w-|flex-)/.test(containerClassName)
  const defaultWidthClasses = hasCustomWidth
    ? ''
    : `${sizeConfig.defaultWidth} ${sizeConfig.focusWidth}`

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={`group relative flex items-center bg-white dark:bg-black border ${
        isFocused
          ? 'border-neutral-400 dark:border-zinc-500 shadow-xs ring-1 ring-black/5 dark:ring-white/10'
          : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 shadow-2xs'
      } ${
        isPill ? 'rounded-full' : 'rounded-xl'
      } ${sizeConfig.height} ${sizeConfig.padding} ${defaultWidthClasses} ${containerClassName} transition-all duration-200 ease-out cursor-text select-none`}
    >
      {/* Search Magnifying Glass Icon */}
      <Search
        className={`flex-shrink-0 transition-colors duration-200 ${sizeConfig.icon} ${
          isFocused
            ? 'text-slate-900 dark:text-white'
            : 'text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
        }`}
      />

      {/* Input container holding placeholder and input */}
      <div className="relative flex-1 h-full flex items-center overflow-hidden">
        {/* Placeholder overlay: types once and stays stably */}
        {(!value || value.length === 0) && (
          <div
            className={`absolute inset-0 flex items-center pointer-events-none transition-opacity duration-150 ${
              isFocused ? 'opacity-30' : 'opacity-100'
            }`}
          >
            <span
              className={`font-sans text-slate-400 dark:text-zinc-500 truncate ${sizeConfig.text}`}
            >
              {displayText}
            </span>
            {/* Blinking Caret Cursor only while typing */}
            {!hasFinishedTyping && (
              <span className="w-[1.5px] h-3 bg-slate-400 dark:bg-zinc-400 ml-0.5 animate-pulse flex-shrink-0" />
            )}
          </div>
        )}

        {/* Real Active Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            if (onChange) onChange(e)
            if (onChangeValue) onChangeValue(e.target.value)
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder=""
          aria-label={placeholder}
          className={`relative z-10 w-full h-full bg-transparent border-0 p-0 text-slate-900 dark:text-zinc-100 focus:outline-hidden font-sans ${sizeConfig.text} ${className}`}
          {...props}
        />
      </div>

      {/* Clear Button */}
      {showClearButton && value && value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="ml-1 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:rotate-90 rounded-full transition-all duration-200 cursor-pointer flex-shrink-0"
          title="Clear search"
          aria-label="Clear search input"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {children}
    </div>
  )
}
