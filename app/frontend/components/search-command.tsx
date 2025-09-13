"use client"
import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useHotkeys } from 'react-hotkeys-hook'
import { useQuery } from '@tanstack/react-query'
import { apiGet, apiJson } from '@/lib/apiClient'
import { useRouter } from 'next/navigation'

type Props = { children: React.ReactNode }

export function CommandPalette({ children }: Props) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const [tags, setTags] = React.useState<string[]>([])
  const [status, setStatus] = React.useState<string | undefined>(undefined)
  const [sort, setSort] = React.useState<'score' | 'updated_at'>('score')
  const [saved, setSaved] = React.useState<any[]>([])
  const router = useRouter()

  useHotkeys('meta+k,ctrl+k,/', (e) => {
    e.preventDefault()
    setOpen(true)
  })

  // Parse typed filters: tag:, status:, sort:
  function parseFilters(input: string) {
    const parts = input.split(/\s+/)
    const free: string[] = []
    const t: string[] = []
    let st: string | undefined
    let so: 'score' | 'updated_at' = 'score'
    for (const p of parts) {
      if (p.startsWith('tag:')) t.push(p.slice(4))
      else if (p.startsWith('status:')) st = p.slice(7)
      else if (p.startsWith('sort:')) {
        const v = p.slice(5)
        if (v === 'updated') so = 'updated_at'
      } else if (p.trim()) free.push(p)
    }
    return { q: free.join(' ').trim(), tags: t, status: st, sort: so }
  }

  const parsed = React.useMemo(() => parseFilters(q), [q])

  const { data, isFetching } = useQuery({
    queryKey: ['search', parsed.q, parsed.tags, parsed.status, parsed.sort],
    queryFn: async () => {
      if (!parsed.q || parsed.q.length < 2) return [] as any[]
      const usp = new URLSearchParams({ q: parsed.q, limit: '10', sort: parsed.sort })
      for (const t of parsed.tags) usp.append('tag', t)
      if (parsed.status) usp.append('status', parsed.status)
      const rows = await apiGet<any[]>(`/search?${usp.toString()}`)
      return rows.map((r) => ({ type: 'file', id: r.file_id, title: r.title, path: r.path, project_id: r.project_id, snippet: r.snippet }))
    },
  })

  // Load saved searches
  React.useEffect(() => {
    apiGet<any[]>(`/search/saved`).then(setSaved).catch(() => setSaved([]))
  }, [])

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

  async function onSaveCurrent() {
    const body = { name: parsed.q || 'Search', query: parsed.q, filters: { tag: parsed.tags, status: parsed.status, sort: parsed.sort } }
    try {
      await apiJson('POST', '/search/saved', body)
      const items = await apiGet<any[]>(`/search/saved`)
      setSaved(items)
    } catch (e) {
      console.error(e)
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
              {/* Saved searches */}
              {saved && saved.length > 0 && (
                <CommandGroup heading="Saved Searches">
                  {saved.map((s) => (
                    <CommandItem key={s.id} value={`saved ${s.name}`} onSelect={() => {
                      const f = s.filters || {}
                      const qparts = [s.query, ...(f.tag || []).map((x: string) => `tag:${x}`), f.status ? `status:${f.status}` : '', f.sort && f.sort !== 'score' ? 'sort:updated' : ''].filter(Boolean)
                      setQ(qparts.join(' '))
                    }}>
                      {s.name}
                    </CommandItem>
                  ))}
                  <CommandItem value="save current" onSelect={onSaveCurrent}>Save current search…</CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Actions">
                <CommandItem value="new project" onSelect={() => onSelect({ type: 'action', id: 'new-project' })}>
                  New Project
                </CommandItem>
              </CommandGroup>
              {data && data.length > 0 && (
                <CommandGroup heading="Files">
                  {data.map((it) => (
                    <CommandItem key={it.id} value={`${it.title} ${it.path}`} onSelect={() => onSelect(it)}>
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{it.title}</span>
                          <span className="truncate text-muted-foreground">{it.path}</span>
                        </div>
                        {it.snippet && (
                          <div className="text-xs text-muted-foreground truncate" dangerouslySetInnerHTML={{ __html: it.snippet.replaceAll('[', '<mark>').replaceAll(']', '</mark>') }} />
                        )}
                      </div>
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
