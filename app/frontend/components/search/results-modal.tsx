"use client"
import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { apiGet } from '@/lib/apiClient'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { getApiBase, getToken } from '@/lib/apiClient'
import { toast } from 'sonner'

type Result = { file_id: string; title: string; path: string; project_id: string; snippet?: string }

export function ResultsModal({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (b: boolean) => void; initial?: Partial<Filters> }) {
  const [filters, setFilters] = React.useState<Filters>({ q: '', tags: [], status: undefined, sort: 'score', project_slug: undefined, path_prefix: undefined, types: [], ...initial })

  const { data, fetchNextPage, hasNextPage, isFetching } = useInfiniteQuery<Result[], unknown>({
    queryKey: ['results', filters],
    initialPageParam: 0,
    getNextPageParam: (lastPage, all) => (lastPage.length === 50 ? all.length * 50 : undefined),
    queryFn: async ({ pageParam }): Promise<Result[]> => {
      const usp = new URLSearchParams({ q: filters.q || '', limit: '50', offset: String(pageParam || 0), sort: filters.sort })
      if (filters.project_slug) usp.append('project_slug', filters.project_slug)
      if (filters.path_prefix) usp.append('path_prefix', filters.path_prefix)
      if (filters.status) usp.append('status', filters.status)
      for (const t of filters.tags) usp.append('tag', t)
      for (const e of filters.types || []) usp.append('type', e)
      const rows = await apiGet<any[]>(`/search?${usp.toString()}`)
      return rows as Result[]
    },
  })

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200 && hasNextPage && !isFetching) fetchNextPage()
  }

  const results = data?.pages.flat() || []
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  async function exportSelected() {
    if (selected.size === 0) return
    // group by project_id
    const groups: Record<string, string[]> = {}
    for (const r of results) {
      if (selected.has(r.file_id)) {
        groups[r.project_id] = groups[r.project_id] || []
        groups[r.project_id].push(r.file_id)
      }
    }
    const base = getApiBase()
    const token = getToken()
    for (const [pid, fids] of Object.entries(groups)) {
      try {
        const res = await fetch(`${base}/projects/${pid}/export`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Token': token }, body: JSON.stringify({ mode: 'zip', selection: { file_ids: fids } }) })
        const { job_id } = await res.json()
        toast('Export enqueued', { description: `Job ${job_id}` })
        // poll for completion
        const poll = async () => {
          const jr = await fetch(`${base}/jobs/${job_id}`, { headers: { 'X-Token': token } }).then((r) => r.json())
          if (jr.status === 'finished' && jr.result && jr.result.download) {
            const url = jr.result.download as string
            toast('Export ready', { description: 'Click to download', action: { label: 'Download', onClick: () => window.open(`${base}${url}`, '_blank') } })
          } else if (jr.status === 'failed') {
            toast.error('Export failed')
          } else {
            setTimeout(poll, 1000)
          }
        }
        setTimeout(poll, 1000)
      } catch {
        toast.error('Failed to export selection')
      }
    }
    setSelected(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-0">
        <div className="flex h-[80vh] flex-col">
          <div className="border-b p-3">
            <div className="flex items-center gap-2">
              <FiltersBar value={filters} onChange={setFilters} />
              {selected.size > 0 && (
                <Button size="sm" variant="outline" onClick={exportSelected}>Export selected ({selected.size})</Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[1.2rem_2fr_2fr_1fr_1fr] gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            <div></div>
            <div>Title</div>
            <div>Path</div>
            <div>Project</div>
            <div>Updated</div>
          </div>
          <div className="flex-1 overflow-auto" onScroll={onScroll}>
            {results.map((r) => (
              <div key={r.project_id + ':' + r.file_id} className="grid grid-cols-[1.2rem_2fr_2fr_1fr_1fr] items-start gap-2 px-3 py-2 hover:bg-accent">
                <div>
                  <input type="checkbox" checked={selected.has(r.file_id)} onChange={(e) => {
                    setSelected((prev) => {
                      const n = new Set(prev)
                      if (e.target.checked) n.add(r.file_id)
                      else n.delete(r.file_id)
                      return n
                    })
                  }} />
                </div>
                <div className="truncate font-medium">{r.title}</div>
                <div className="truncate text-muted-foreground">{r.path}</div>
                <div className="truncate text-muted-foreground">{r.project_id ? String(r.project_id).slice(0, 6) : ""}</div>
                <div className="truncate text-muted-foreground">—</div>
              </div>
            ))}
            {results.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No results</div>}
          </div>
          <div className="border-t p-2 text-right text-sm text-muted-foreground">{isFetching ? 'Loading…' : results.length + ' results'}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type Filters = {
  q: string
  tags: string[]
  status?: string
  sort: 'score' | 'updated_at'
  project_slug?: string
  path_prefix?: string
  types?: string[]
}

function FiltersBar({ value, onChange }: { value: Filters; onChange: (v: Filters) => void }) {
  const [q, setQ] = React.useState(value.q)
  React.useEffect(() => setQ(value.q), [value.q])
  function apply() {
    onChange({ ...value, q })
  }
  return (
    <div className="flex items-center gap-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apply()} className="w-full rounded border px-2 py-1" placeholder="Search… (tag:foo status:draft type:md)" />
      <button className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={apply}>Search</button>
    </div>
  )
}
