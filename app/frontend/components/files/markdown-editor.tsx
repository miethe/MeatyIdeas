"use client"

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bold, Heading, Italic, Link as LinkIcon, List, ListOrdered, Share2 } from 'lucide-react'
import { toast } from 'sonner'

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { apiGet } from '@/lib/apiClient'
import { FileSchema } from '@/lib/types'
import { span } from '@/lib/telemetry'
import { cn } from '@/lib/utils'

export type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  projectId: string | null
  disabled?: boolean
  minRows?: number
}

type BacklinkOption = {
  id: string
  title: string
  path: string
}

export function MarkdownEditor({ value, onChange, projectId, disabled = false, minRows = 12 }: MarkdownEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const [backlinkOpen, setBacklinkOpen] = React.useState(false)
  const [backlinkSearch, setBacklinkSearch] = React.useState('')
  const backlinkContainerRef = React.useRef<HTMLDivElement | null>(null)

  const filesQuery = useQuery({
    queryKey: ['project-files-flat', projectId],
    enabled: backlinkOpen && Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return [] as BacklinkOption[]
      const rows = await apiGet<any[]>(`/projects/${projectId}/files`)
      return rows
        .map((row) => {
          try {
            const parsed = FileSchema.parse(row)
            return { id: parsed.id, title: parsed.title, path: parsed.path }
          } catch (error) {
            console.error('Failed to parse file for backlink picker', error)
            return null
          }
        })
        .filter(Boolean) as BacklinkOption[]
    },
    staleTime: 60_000,
  })

  const filteredBacklinks = React.useMemo(() => {
    if (!filesQuery.data) return []
    if (!backlinkSearch) return [...filesQuery.data].sort((a, b) => a.title.localeCompare(b.title))
    const term = backlinkSearch.toLowerCase()
    return filesQuery.data
      .filter((item) => item.title.toLowerCase().includes(term) || item.path.toLowerCase().includes(term))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [filesQuery.data, backlinkSearch])

  React.useEffect(() => {
    if (!backlinkOpen) return
    const handleClick = (event: MouseEvent) => {
      if (!backlinkContainerRef.current) return
      if (!backlinkContainerRef.current.contains(event.target as Node)) {
        setBacklinkOpen(false)
        setBacklinkSearch('')
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setBacklinkOpen(false)
        setBacklinkSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [backlinkOpen])

  const focusTextarea = React.useCallback(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [])

  const applyWrapper = React.useCallback(
    (prefix: string, suffix: string, placeholder?: string) => {
      const node = textareaRef.current
      if (!node) return
      const { selectionStart, selectionEnd, value: current } = node
      const selected = current.substring(selectionStart, selectionEnd) || placeholder || ''
      const nextValue = `${current.substring(0, selectionStart)}${prefix}${selected}${suffix}${current.substring(selectionEnd)}`
      onChange(nextValue)
      const cursor = selectionStart + prefix.length + selected.length
      requestAnimationFrame(() => {
        if (!textareaRef.current) return
        textareaRef.current.selectionStart = cursor
        textareaRef.current.selectionEnd = cursor
        textareaRef.current.focus()
      })
    },
    [onChange]
  )

  const applyLinePrefix = React.useCallback(
    (prefix: string, ordered = false) => {
      const node = textareaRef.current
      if (!node) return
      const { selectionStart, selectionEnd, value: current } = node
      const before = current.substring(0, selectionStart)
      const after = current.substring(selectionEnd)
      const selection = current.substring(selectionStart, selectionEnd)
      const lines = selection.split('\n')
      const transformed = lines.map((line, index) => {
        if (!line.trim()) return line
        if (ordered) {
          return `${index + 1}. ${line.replace(/^\d+\.\s+/, '')}`
        }
        if (line.startsWith(prefix)) return line
        return `${prefix}${line.replace(/^[-*+]\s+/, '')}`
      })
      const nextValue = `${before}${transformed.join('\n')}${after}`
      onChange(nextValue)
      requestAnimationFrame(() => {
        if (!textareaRef.current) return
        textareaRef.current.selectionStart = selectionStart
        textareaRef.current.selectionEnd = selectionStart + transformed.join('\n').length
        textareaRef.current.focus()
      })
    },
    [onChange]
  )

  const handleInsertLink = React.useCallback(() => {
    const node = textareaRef.current
    if (!node) return
    const url = window.prompt('Link URL')
    if (!url) return
    const label = node.value.substring(node.selectionStart, node.selectionEnd) || 'Link'
    applyWrapper(`[${label}](`, ')')
    const next = textareaRef.current
    if (!next) return
    const insertionPoint = Math.max(next.selectionStart - 1, 0)
    next.setSelectionRange(insertionPoint, insertionPoint)
    focusTextarea()
  }, [applyWrapper, focusTextarea])

  const handleBacklinkSelect = React.useCallback(
    (option: BacklinkOption) => {
      applyWrapper('[[', ']]', option.title)
      span('file.create.backlink_added', { project_id: projectId, target_file_id: option.id })
      setBacklinkOpen(false)
      setBacklinkSearch('')
      focusTextarea()
    },
    [applyWrapper, focusTextarea, projectId]
  )

  const triggerBacklink = () => {
    if (!projectId) {
      toast.error('Select a project before adding backlinks')
      return
    }
    setBacklinkOpen((prev) => !prev)
    if (!backlinkOpen) span('file.create.toolbar_action', { action: 'backlink' })
  }

  const toolbarButtonClass = 'h-8 w-8 rounded-md border border-border bg-muted/60 text-muted-foreground hover:bg-muted transition flex items-center justify-center'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => {
            span('file.create.toolbar_action', { action: 'bold' })
            applyWrapper('**', '**', 'bold text')
          }}
          disabled={disabled}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => {
            span('file.create.toolbar_action', { action: 'italic' })
            applyWrapper('*', '*', 'italic text')
          }}
          disabled={disabled}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => {
            span('file.create.toolbar_action', { action: 'heading' })
            applyLinePrefix('## ')
          }}
          disabled={disabled}
          aria-label="Heading"
        >
          <Heading className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => {
            span('file.create.toolbar_action', { action: 'list_unordered' })
            applyLinePrefix('- ')
          }}
          disabled={disabled}
          aria-label="Bullet list"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => {
            span('file.create.toolbar_action', { action: 'list_ordered' })
            applyLinePrefix('', true)
          }}
          disabled={disabled}
          aria-label="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={handleInsertLink}
          disabled={disabled}
          aria-label="Insert link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        <div className="relative" ref={backlinkContainerRef}>
          <button
            type="button"
            className={cn(toolbarButtonClass, backlinkOpen && 'bg-muted text-foreground')}
            onClick={triggerBacklink}
            disabled={disabled}
            aria-label="Insert backlink"
          >
            <Share2 className="h-4 w-4" />
          </button>
          {backlinkOpen && (
            <div className="absolute z-50 mt-2 w-72 rounded-md border bg-background shadow-lg">
              <Command className="max-h-60">
                <CommandInput
                  autoFocus
                  placeholder="Search project files…"
                  value={backlinkSearch}
                  onValueChange={setBacklinkSearch}
                />
                <CommandList>
                  {filesQuery.isLoading ? (
                    <CommandEmpty>Loading…</CommandEmpty>
                  ) : filteredBacklinks.length === 0 ? (
                    <CommandEmpty>No matches</CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {filteredBacklinks.map((item) => (
                        <CommandItem key={item.id} value={item.title} onSelect={() => handleBacklinkSelect(item)}>
                          <span className="truncate">
                            {item.title}
                            <span className="block text-xs text-muted-foreground">{item.path}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </div>
          )}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="# Title\n\nStart writing…"
        className="focus-ring block w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
        rows={minRows}
        disabled={disabled}
      />
    </div>
  )
}
