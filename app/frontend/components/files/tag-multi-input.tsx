"use client"

import * as React from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

export type TagMultiInputProps = {
  value: string[]
  onChange: (next: string[]) => void
  suggestions?: string[]
  disabled?: boolean
  placeholder?: string
}

export function TagMultiInput({ value, onChange, suggestions = [], disabled = false, placeholder = 'Add a tag' }: TagMultiInputProps) {
  const [input, setInput] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listId = React.useId()

  const normalizedSuggestions = React.useMemo(() => {
    const existing = new Set(value.map((tag) => tag.toLowerCase()))
    return suggestions.filter((tag) => !existing.has(tag.toLowerCase()))
  }, [suggestions, value])

  const commit = React.useCallback(() => {
    const raw = input.trim()
    if (!raw) return
    const exists = value.find((tag) => tag.toLowerCase() === raw.toLowerCase())
    if (exists) {
      setInput('')
      return
    }
    onChange([...value, raw])
    setInput('')
  }, [input, onChange, value])

  const handleRemove = React.useCallback(
    (tag: string) => {
      onChange(value.filter((item) => item !== tag))
    },
    [onChange, value]
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    const { key } = event
    if (key === 'Enter' || key === 'Tab' || key === ',') {
      event.preventDefault()
      commit()
    } else if (key === 'Backspace' && !input && value.length > 0) {
      event.preventDefault()
      const next = [...value]
      next.pop()
      onChange(next)
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-md border px-3 py-2', disabled && 'bg-muted opacity-80')}>
      {value.map((tag) => (
        <span key={tag} className="flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
          #{tag}
          {!disabled && (
            <button
              type="button"
              className="ml-1 rounded-full p-0.5 text-accent-foreground/70 transition hover:bg-accent-foreground/10"
              aria-label={`Remove ${tag}`}
              onClick={() => handleRemove(tag)}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit()}
        list={listId}
        placeholder={value.length === 0 ? placeholder : ''}
        disabled={disabled}
      />
      <datalist id={listId}>
        {normalizedSuggestions.map((tag) => (
          <option value={tag} key={tag} />
        ))}
      </datalist>
    </div>
  )
}
