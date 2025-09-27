"use client"

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Folder as FolderIcon } from 'lucide-react'

import { apiGet } from '@/lib/apiClient'
import { DirectoryListItem, DirectoryListItemSchema } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { span } from '@/lib/telemetry'

export type FolderPathComboboxProps = {
  projectId: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  allowCreate?: boolean
  onRequestCreate?: (path: string) => void
  disabled?: boolean
}

export function FolderPathCombobox({
  projectId,
  value,
  onChange,
  placeholder = 'Select folder…',
  allowCreate = true,
  onRequestCreate,
  disabled = false,
}: FolderPathComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const dirsQuery = useQuery({
    queryKey: ['project-dirs', projectId],
    queryFn: async () => {
      const rows = await apiGet<any[]>(`/projects/${projectId}/directories`)
      return rows.map((row) => DirectoryListItemSchema.parse(row)) as DirectoryListItem[]
    },
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })

  const options = React.useMemo(() => {
    const map = new Map<string, DirectoryListItem>()
    if (dirsQuery.data) {
      dirsQuery.data.forEach((item) => {
        if (!map.has(item.path)) {
          map.set(item.path, item)
        }
      })
    }
    map.set('', { path: '', name: 'Root', depth: 0, updated_at: null, source: 'derived' })
    return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path))
  }, [dirsQuery.data])

  const filtered = React.useMemo(() => {
    if (!search) return options
    const term = search.toLowerCase()
    return options.filter((opt) => opt.path.toLowerCase().includes(term) || opt.name.toLowerCase().includes(term))
  }, [options, search])

  const handleSelect = React.useCallback(
    (next: string) => {
      onChange(next)
      setOpen(false)
      setSearch('')
      span('file_path_selector_used', {
        project_id: projectId,
        mode: 'existing',
        path: next,
      })
    },
    [onChange, projectId]
  )

  const handleCreate = React.useCallback(() => {
    if (!onRequestCreate) return
    const candidate = search.trim()
    if (!candidate) return
    setOpen(false)
    span('file_path_selector_used', {
      project_id: projectId,
      mode: 'create',
      path: candidate,
    })
    onRequestCreate(candidate)
  }, [onRequestCreate, projectId, search])

  React.useEffect(() => {
    if (!open) return undefined
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const selectedLabel = React.useMemo(() => {
    if (!value) return 'Root /'
    const match = options.find((opt) => opt.path === value)
    return match ? match.path : value
  }, [options, value])

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className={cn('flex w-full items-center justify-between', !value && 'text-muted-foreground')}
        onClick={() => {
          if (disabled) return
          setOpen((prev) => !prev)
          setSearch(value)
        }}
        disabled={disabled}
      >
        <span className="flex items-center gap-2 truncate">
          <FolderIcon className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{value ? selectedLabel : placeholder}</span>
        </span>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </Button>
      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-md border bg-background shadow-lg">
          <Command className="max-h-60">
            <CommandInput
              autoFocus
              placeholder="Search folders…"
              value={search}
              onValueChange={(next) => setSearch(next)}
            />
            <CommandList>
              {dirsQuery.isLoading && <CommandEmpty>Loading…</CommandEmpty>}
              {!dirsQuery.isLoading && filtered.length === 0 && <CommandEmpty>No folders found</CommandEmpty>}
              <CommandGroup>
                {filtered.map((opt) => (
                  <CommandItem
                    key={opt.path || 'root'}
                    value={opt.path || 'root'}
                    onSelect={() => handleSelect(opt.path)}
                    style={{ paddingLeft: `${Math.min(opt.depth ?? 0, 6) * 0.75 + 0.75}rem` }}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate text-sm">{opt.path ? opt.path : 'Root /'}</span>
                    {value === opt.path && <Check className="h-4 w-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
              {allowCreate && search.trim() && !options.some((opt) => opt.path.toLowerCase() === search.trim().toLowerCase()) && (
                <CommandGroup heading="Actions">
                  <CommandItem
                    value="__create__"
                    onSelect={handleCreate}
                    className="flex items-center justify-between text-sm text-primary"
                  >
                    Create new folder “{search.trim()}”
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  )
}
