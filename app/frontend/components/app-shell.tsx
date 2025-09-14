"use client"
import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CommandPalette } from '@/components/search-command'
import { ThemeToggle } from '@/components/theme-toggle'
import { Search, Plus } from 'lucide-react'
import Link from 'next/link'
import { ProjectCreateSheet } from '@/components/projects/project-create-sheet'
import { useHotkeys } from 'react-hotkeys-hook'
import { ProfileMenu } from '@/components/profile/profile-menu'
import { ResultsModal } from '@/components/search/results-modal'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '@/lib/apiClient'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [resultsOpen, setResultsOpen] = React.useState(false)
  const [resultsInitial, setResultsInitial] = React.useState<any | undefined>(undefined)
  useHotkeys('n', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
    e.preventDefault()
    window.dispatchEvent(new Event('open-new-project'))
  })
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: async () => apiGet<any[]>(`/projects`) })
  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] grid-rows-[56px_1fr]">
      <header className="col-span-2 flex items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary" />
          <Link href="/" className="font-semibold">MeatyProjects</Link>
        </div>
        <div className="flex items-center gap-2">
          <CommandPalette>
            <Button variant="outline" size="sm" className="gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="ml-2 hidden rounded bg-muted px-1 text-xs text-muted-foreground sm:inline">⌘K</kbd>
            </Button>
          </CommandPalette>
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </header>
      <aside className="row-start-2 border-r p-3">
        <SidebarSections
          projects={projects || []}
          onOpenResults={() => { setResultsInitial(undefined); setResultsOpen(true) }}
          onOpenTag={(tag) => { setResultsInitial({ q: '', tags: [tag] }); setResultsOpen(true) }}
        />
      </aside>
      <main className={cn('row-start-2 overflow-y-auto p-6')}>{children}</main>
      <ResultsModal open={resultsOpen} onOpenChange={setResultsOpen} initial={resultsInitial} />
    </div>
  )
}

function SidebarSections({ projects, onOpenResults, onOpenTag }: { projects: any[]; onOpenResults: () => void; onOpenTag: (tag: string) => void }) {
  const [openProjects, setOpenProjects] = React.useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('sidebar.projects') || '{}') } catch { return {} }
  })
  React.useEffect(() => { try { localStorage.setItem('sidebar.projects', JSON.stringify(openProjects)) } catch {} }, [openProjects])
  const qc = useQueryClient()
  function toggleProject(id: string) {
    setOpenProjects((s) => ({ ...s, [id]: !s[id] }))
  }
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase text-muted-foreground">Projects</span>
          <ProjectCreateSheet>
            <Button size="sm" variant="secondary" className="gap-1"><Plus className="h-4 w-4" /> New</Button>
          </ProjectCreateSheet>
        </div>
        <div className="space-y-1 text-sm">
          {(projects || []).map((p: any) => (
            <div key={p.id} className="">
              <button className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-accent" onClick={() => toggleProject(p.id)}>
                <span className="truncate" title={p.name}>{p.name}</span>
                <span className="text-xs text-muted-foreground">{openProjects[p.id] ? '−' : '+'}</span>
              </button>
              {openProjects[p.id] && <TopLevelContents projectId={p.id} />}
            </div>
          ))}
        </div>
      </div>
      <TagsSection onOpenResults={onOpenResults} onOpenTag={onOpenTag} />
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase text-muted-foreground">Filters</span>
        </div>
        <div className="space-y-2">
          <Button variant="outline" size="sm" onClick={onOpenResults}>Open Advanced Filters…</Button>
        </div>
      </div>
    </div>
  )
}

function TopLevelContents({ projectId }: { projectId: string }) {
  const { data } = useQuery({ queryKey: ['tree', projectId], queryFn: async () => apiGet<any[]>(`/projects/${projectId}/files/tree`) })
  const top = Array.isArray(data) ? data : []
  return (
    <div className="ml-2 border-l pl-2">
      {top.map((n: any) => (
        <div key={n.path} className="flex items-center gap-2 px-1 py-0.5 text-xs text-muted-foreground">
          <span className="truncate">{n.type === 'dir' ? `${n.name}/` : n.name}</span>
        </div>
      ))}
      {top.length > 0 && (
        <a href={`/projects/${projectId}`} className="block px-1 py-0.5 text-xs text-primary hover:underline">More…</a>
      )}
    </div>
  )
}

function TagsSection({ onOpenResults, onOpenTag }: { onOpenResults: () => void; onOpenTag: (tag: string) => void }) {
  const [q, setQ] = React.useState('')
  const { data } = useQuery({ queryKey: ['tags', q], queryFn: async () => apiGet<any[]>(`/tags${q ? `?q=${encodeURIComponent(q)}` : ''}`) })
  return (
    <div>
      <div className="mb-2 text-xs uppercase text-muted-foreground">Tags</div>
      <input className="mb-2 w-full rounded border px-2 py-1 text-sm" placeholder="Filter tags…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-1 text-sm">
        {(data || []).slice(0, 20).map((t: any) => (
          <button key={t.name} className="w-full truncate rounded px-2 py-1 text-left hover:bg-accent" onClick={() => onOpenTag(t.name)} title={`${t.name} (${t.count})`}>
            #{t.name} <span className="text-xs text-muted-foreground">{t.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
