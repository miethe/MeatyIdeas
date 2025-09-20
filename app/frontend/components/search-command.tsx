"use client"

import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useHotkeys } from 'react-hotkeys-hook'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { apiGet } from '@/lib/apiClient'
import { SearchResponseSchema, SearchResult, SearchResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

const UPDATED_PRESETS: Array<{ id: string; label: string }> = [
  { id: 'any', label: 'Any time' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
]

type Scope = 'all' | 'files' | 'projects'

function resolveUpdatedRange(preset: string): { updated_after?: string; updated_before?: string } {
  const now = new Date()
  if (preset === '7d') {
    const dt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { updated_after: dt.toISOString() }
  }
  if (preset === '30d') {
    const dt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    return { updated_after: dt.toISOString() }
  }
  if (preset === '90d') {
    const dt = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    return { updated_after: dt.toISOString() }
  }
  return {}
}

type Props = { children: React.ReactNode }

export function CommandPalette({ children }: Props) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [scope, setScope] = React.useState<Scope>('all')
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [language, setLanguage] = React.useState<string>('')
  const [updatedPreset, setUpdatedPreset] = React.useState<string>('any')
  const [hasReadme, setHasReadme] = React.useState<boolean>(false)
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const [tagSearch, setTagSearch] = React.useState('')
  const router = useRouter()

  useHotkeys(
    'meta+k,ctrl+k,/',
    (e) => {
      e.preventDefault()
      setOpen((prev) => !prev)
    },
    [setOpen]
  )

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query.trim()), 200)
    return () => window.clearTimeout(id)
  }, [query])

  const tagsQuery = useQuery({
    queryKey: ['filters', 'tags', tagSearch],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (tagSearch) params.set('q', tagSearch)
      params.set('limit', '200')
      const res = await apiGet(`/filters/tags?${params.toString()}`)
      return Array.isArray(res) ? (res as Array<{ label: string; slug: string; color?: string | null }>) : []
    },
    staleTime: 60_000,
  })

  const languagesQuery = useQuery({
    queryKey: ['filters', 'languages'],
    queryFn: async () => {
      const res = await apiGet(`/filters/languages?limit=200`)
      return Array.isArray(res) ? (res as Array<{ label: string; slug: string }>) : []
    },
    staleTime: 60_000,
  })

  const searchQuery = useInfiniteQuery({
    queryKey: ['global-search', { debouncedQuery, scope, selectedTags, language, updatedPreset, hasReadme }],
    enabled: open,
    queryFn: async ({ pageParam }): Promise<SearchResponse> => {
      const params = new URLSearchParams()
      params.set('scope', scope)
      params.set('limit', '20')
      params.set('q', debouncedQuery || '')
      if (pageParam) params.set('cursor', String(pageParam))
      if (language) params.set('language', language)
      if (hasReadme) params.set('has_readme', '1')
      selectedTags.forEach((tag) => params.append('tags[]', tag))
      const range = resolveUpdatedRange(updatedPreset)
      if (range.updated_after) params.set('updated_after', range.updated_after)
      if (range.updated_before) params.set('updated_before', range.updated_before)
      const data = await apiGet(`/search?${params.toString()}`)
      return SearchResponseSchema.parse(data)
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  })

  const results = React.useMemo(() => {
    return searchQuery.data?.pages.flatMap((page) => page.results) ?? []
  }, [searchQuery.data])

  const facets = searchQuery.data?.pages?.[0]?.facets

  function toggleTag(slug: string) {
    setSelectedTags((prev) => (prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]))
  }

  function clearFilters() {
    setSelectedTags([])
    setLanguage('')
    setUpdatedPreset('any')
    setHasReadme(false)
  }

  function handleSelect(item: SearchResult, newTab = false) {
    setOpen(false)
    if (item.type === 'project') {
      const slug = item.project?.slug || item.id
      if (!slug) return
      if (newTab) window.open(`/projects/${slug}`, '_blank')
      else router.push(`/projects/${slug}`)
      return
    }
    if (item.type === 'file') {
      const projectSlug = item.project?.slug
      if (!projectSlug) return
      const target = `/projects/${projectSlug}?file=${item.id}`
      if (newTab) window.open(target, '_blank')
      else router.push(target)
    }
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 sm:max-w-3xl">
          <div className="border-b p-3">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <CommandInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search projects and files..."
                  aria-label="Global search"
                  autoFocus
                />
                <ScopeSelector value={scope} onChange={setScope} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <FilterTagList
                  available={tagsQuery.data || []}
                  selected={selectedTags}
                  onToggle={toggleTag}
                  searchTerm={tagSearch}
                  onSearchChange={setTagSearch}
                />
                <LanguageSelector
                  options={languagesQuery.data || []}
                  value={language}
                  onChange={setLanguage}
                />
                <UpdatedSelector value={updatedPreset} onChange={setUpdatedPreset} />
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-3 py-1 transition',
                    hasReadme ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted'
                  )}
                  onClick={() => setHasReadme((prev) => !prev)}
                >
                  README
                </button>
                {(selectedTags.length > 0 || language || updatedPreset !== 'any' || hasReadme) && (
                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={clearFilters}>
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </div>
          <Command className="max-h-[70vh]">
            <CommandList>
              {searchQuery.isLoading && <CommandEmpty>Searching…</CommandEmpty>}
              {!searchQuery.isLoading && results.length === 0 && <CommandEmpty>No results</CommandEmpty>}
              {facets && (facets.tags?.length || facets.languages?.length) ? (
                <CommandGroup heading="Facets" className="px-4 py-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    {(facets.tags || []).slice(0, 6).map((tag) => (
                      <Badge
                        key={tag.slug}
                        variant={selectedTags.includes(tag.slug) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleTag(tag.slug)}
                      >
                        #{tag.label}
                      </Badge>
                    ))}
                    {(facets.languages || []).slice(0, 4).map((lang) => (
                      <Badge
                        key={lang.slug}
                        variant={language === lang.slug ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setLanguage((prev) => (prev === lang.slug ? '' : lang.slug))}
                      >
                        {lang.label}
                      </Badge>
                    ))}
                  </div>
                </CommandGroup>
              ) : null}
              <CommandSeparator />
              <CommandGroup heading="Results">
                {results.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    data-command
                    className="flex items-start gap-3"
                    value={`${item.name} ${item.path || ''}`}
                    onSelect={() => handleSelect(item)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault()
                        handleSelect(item, true)
                      }
                    }}
                  >
                    <ResultItem item={item} />
                  </CommandItem>
                ))}
                {searchQuery.hasNextPage && (
                  <div className="px-4 py-2 text-sm text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => searchQuery.fetchNextPage()}
                      disabled={searchQuery.isFetchingNextPage}
                    >
                      {searchQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ScopeSelector({ value, onChange }: { value: Scope; onChange: (v: Scope) => void }) {
  return (
    <select
      className="h-9 rounded-md border px-2 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as Scope)}
    >
      <option value="all">All</option>
      <option value="projects">Projects</option>
      <option value="files">Files</option>
    </select>
  )
}

function FilterTagList({
  available,
  selected,
  onToggle,
  searchTerm,
  onSearchChange,
}: {
  available: Array<{ label: string; slug: string; color?: string | null }>
  selected: string[]
  onToggle: (slug: string) => void
  searchTerm: string
  onSearchChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Filter tags"
        className="h-8 w-32 text-xs"
      />
      <div className="flex flex-wrap gap-1">
        {available.slice(0, 6).map((tag) => (
          <Badge
            key={tag.slug}
            variant={selected.includes(tag.slug) ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => onToggle(tag.slug)}
            style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
          >
            #{tag.label}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function LanguageSelector({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; slug: string }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select
      className="h-8 rounded-md border px-2 text-xs text-muted-foreground"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Language</option>
      {options.map((opt) => (
        <option key={opt.slug} value={opt.slug}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function UpdatedSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      className="h-8 rounded-md border px-2 text-xs text-muted-foreground"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {UPDATED_PRESETS.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.label}
        </option>
      ))}
    </select>
  )
}

function ResultItem({ item }: { item: SearchResult }) {
  const projectName = item.project?.name || item.project?.slug || ''
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{item.name}</span>
        <span className="text-xs uppercase text-muted-foreground">{item.type}</span>
      </div>
      {projectName && (
        <div className="text-xs text-muted-foreground">{projectName}</div>
      )}
      {item.path && (
        <div className="text-xs text-muted-foreground">{item.path}</div>
      )}
      {item.excerpt && (
        <div
          className="text-xs text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: item.excerpt.replaceAll('[', '<mark>').replaceAll(']', '</mark>') }}
        />
      )}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
          {item.tags.slice(0, 6).map((tag) => (
            <span key={tag} className="rounded bg-muted px-1 py-0.5">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
