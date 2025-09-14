"use client"
import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { apiGet } from '@/lib/apiClient'
import { useInfiniteQuery } from '@tanstack/react-query'

type Result = { file_id: string; title: string; path: string; project_id: string; snippet?: string }

export function ResultsModal({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (b: boolean) => void; initial?: Partial<Filters> }) {
  const [filters, setFilters] = React.useState<Filters>({ q: '', tags: [], status: undefined, sort: 'score', project_slug: undefined, path_prefix: undefined, types: [], ...initial })

  const { data, fetchNextPage, hasNextPage, isFetching } = useInfiniteQuery({
    queryKey: ['results', filters],
    initialPageParam: 0,
    getNextPageParam: (lastPage, all) => (lastPage.length === 50 ? all.length * 50 : undefined),
    queryFn: async ({ pageParam }) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-0">
        <div className="flex h-[80vh] flex-col">
          <div className="border-b p-3">
            <FiltersBar value={filters} onChange={setFilters} />
          </div>
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            <div>Title</div>
            <div>Path</div>
            <div>Project</div>
            <div>Updated</div>
          </div>
          <div className="flex-1 overflow-auto" onScroll={onScroll}>
            {results.map((r) => (
              <div key={r.file_id} className="grid grid-cols-[2fr_2fr_1fr_1fr] items-start gap-2 px-3 py-2 hover:bg-accent">
                <div className="truncate font-medium">{r.title}</div>
                <div className="truncate text-muted-foreground">{r.path}</div>
                <div className="truncate text-muted-foreground">{r.project_id.slice(0, 6)}</div>
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

