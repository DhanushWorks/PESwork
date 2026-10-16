import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface DropdownOption {
  value: string
  label: string
}

export interface CustomDropdownProps {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  align?: 'left' | 'right'
  placeholder?: string
  fullWidth?: boolean
  className?: string
  menuClassName?: string
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  align = 'left',
  placeholder = 'Select...',
  fullWidth = false,
  className = '',
  menuClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div
      className={`relative ${fullWidth ? 'w-full block' : 'inline-block'} text-left ${className}`}
      ref={dropdownRef}
    >
      {/* Trigger Button - clean Vercel card button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`${
          fullWidth ? 'w-full' : ''
        } flex items-center justify-between gap-2.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white dark:bg-black cursor-pointer transition-colors focus:outline-hidden ${
          isOpen
            ? 'border-slate-400 dark:border-zinc-600 ring-1 ring-slate-300 dark:ring-zinc-700 text-slate-900 dark:text-white shadow-xs'
            : 'border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-slate-700 dark:text-zinc-300' : ''
          }`}
        />
      </button>

      {/* Floating Custom Menu - sleek, high z-index, properly positioned */}
      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } top-full mt-1.5 ${
            fullWidth ? 'w-full min-w-[180px]' : 'w-48 min-w-[160px]'
          } max-h-64 overflow-y-auto bg-white dark:bg-black rounded-xl shadow-xl border border-slate-200 dark:border-zinc-800 py-1.5 px-1 z-[100] animate-in fade-in zoom-in-95 duration-100 ${menuClassName}`}
          role="listbox"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
                role="option"
                aria-selected={isSelected}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-colors text-left ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-zinc-900 text-slate-900 dark:text-white font-medium'
                    : 'text-slate-700 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900/60 hover:text-slate-900 dark:hover:text-white font-normal'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white stroke-[2.5] flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
