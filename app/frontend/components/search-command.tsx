"use client"
import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useHotkeys } from 'react-hotkeys-hook'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/apiClient'
import { useRouter } from 'next/navigation'

type Props = { children: React.ReactNode }

export function CommandPalette({ children }: Props) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const router = useRouter()

  useHotkeys('meta+k,ctrl+k,/', (e) => {
    e.preventDefault()
    setOpen(true)
  })

  const { data, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: async () => {
      if (!q || q.length < 2) return [] as any[]
      const rows = await apiGet<any[]>(`/search?q=${encodeURIComponent(q)}&limit=10`)
      return rows.map((r) => ({ type: 'file', id: r.file_id, title: r.title, path: r.path, project_id: r.project_id }))
    },
  })

  function onSelect(item: any) {
    setOpen(false)
    if (item.type === 'file') {
      router.push(`/projects/${item.project_id}?file=${item.id}`)
      return
    }
    if (item.type === 'action' && item.id === 'new-project') {
      window.dispatchEvent(new Event('open-new-project'))
      return
    }
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 sm:max-w-[600px]">
          <Command>
            <CommandInput placeholder="Search projects and files..." value={q} onValueChange={setQ} />
            <CommandList>
              <CommandEmpty>{isFetching ? 'Loading...' : 'No results'}</CommandEmpty>
              <CommandGroup heading="Actions">
                <CommandItem value="new project" onSelect={() => onSelect({ type: 'action', id: 'new-project' })}>
                  New Project
                </CommandItem>
              </CommandGroup>
              {data && data.length > 0 && (
                <CommandGroup heading="Files">
                  {data.map((it) => (
                    <CommandItem key={it.id} value={`${it.title} ${it.path}`} onSelect={() => onSelect(it)}>
                      <span className="truncate">{it.title}</span>
                      <span className="ml-2 truncate text-muted-foreground">{it.path}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
