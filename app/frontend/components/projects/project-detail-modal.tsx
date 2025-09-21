"use client"

import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/skeleton'
import { Input } from '@/components/ui/input'
import { apiGet, apiJson } from '@/lib/apiClient'
import {
  FilePreview,
  FilePreviewSchema,
  ProjectActivityEntry,
  ProjectActivityResponseSchema,
  ProjectModalSummary,
  ProjectModalSummarySchema,
  ProjectTreeNode,
  ProjectTreeResponseSchema,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { span } from '@/lib/telemetry'
import { useHotkeys } from 'react-hotkeys-hook'
import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Activity,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  FileWarning,
  GitCommit,
  Loader2,
  RefreshCcw,
  Search,
  Star,
  StarOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { MarkdownViewer } from '@/components/markdown-viewer'

const LAST_TAB_KEY = 'project-modal.last-tab'
const EXPANSION_KEY_PREFIX = 'project-modal.expanded.'
const READ_FOCUS_KEY_PREFIX = 'project-modal.focus.'

const TREE_ROW_HEIGHT = 28

const SUPPORTED_PRISM_LANGS: Record<string, string> = {
  markdown: 'markdown',
  javascript: 'javascript',
  typescript: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  json: 'json',
  yaml: 'yaml',
  shell: 'bash',
  bash: 'bash',
  css: 'css',
  html: 'markup',
  python: 'python',
  go: 'go',
  rust: 'rust',
  java: 'java',
  kotlin: 'kotlin',
  swift: 'swift',
  c: 'c',
  'c++': 'cpp',
  cpp: 'cpp',
  sql: 'sql',
}

type Props = {
  projectId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAfterClose?: () => void
  onExpand?: (project: { id: string; slug: string }) => void
}

type VisibleTreeRow = {
  node: ProjectTreeNode
  depth: number
}

type ModalTreeState = {
  nodes: Record<string, ProjectTreeNode>
  children: Record<string, string[]>
}

type TreeSelection = {
  path: string
  fileId: string | null
}

export function ProjectDetailModal({ projectId, open, onOpenChange, onAfterClose, onExpand }: Props) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState<'overview' | 'preview' | 'activity'>(() => {
    if (typeof window === 'undefined') return 'overview'
    try {
      const stored = window.localStorage.getItem(LAST_TAB_KEY)
      if (stored === 'overview' || stored === 'preview' || stored === 'activity') return stored
    } catch {}
    return 'overview'
  })
  const [treeState, setTreeState] = React.useState<ModalTreeState>({ nodes: {}, children: {} })
  const treeStateRef = React.useRef(treeState)
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(new Set())
  const [selected, setSelected] = React.useState<TreeSelection | null>(null)
  const [focusedPath, setFocusedPath] = React.useState<string | null>(null)
  const focusRef = React.useRef<string | null>(null)
  const [searchValue, setSearchValue] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<ProjectTreeNode[] | null>(null)
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchDebounceToken, setSearchDebounceToken] = React.useState<number | null>(null)
  const [autoReadmeLoadedFor, setAutoReadmeLoadedFor] = React.useState<string | null>(null)

  React.useEffect(() => {
    treeStateRef.current = treeState
  }, [treeState])


  React.useEffect(() => {
    focusRef.current = focusedPath
  }, [focusedPath])

  React.useEffect(() => {
    return () => {
      if (searchDebounceToken) window.clearTimeout(searchDebounceToken)
    }
  }, [searchDebounceToken])

  const summaryQuery = useQuery({
    queryKey: ['project-modal-summary', projectId],
    enabled: open && !!projectId,
    queryFn: async () => {
      try {
        const data = await apiGet(`/projects/${projectId}/modal`)
        return ProjectModalSummarySchema.parse(data)
      } catch (error) {
        console.error('Failed to load project modal summary:', error)
        throw error
      }
    },
    staleTime: 60_000,
  })

  React.useEffect(() => {
    if (!open) return
    if (!projectId) return
    const expandedStoredKey = EXPANSION_KEY_PREFIX + projectId
    try {
      const stored = window.sessionStorage.getItem(expandedStoredKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setExpandedPaths(new Set(parsed))
        }
      } else {
        setExpandedPaths(new Set())
      }
    } catch {
      setExpandedPaths(new Set())
    }
  }, [open, projectId])

  React.useEffect(() => {
    if (!open || !projectId) return
    const storedFocusKey = READ_FOCUS_KEY_PREFIX + projectId
    try {
      const stored = window.sessionStorage.getItem(storedFocusKey)
      if (stored) {
        setFocusedPath(stored)
      }
    } catch {}
  }, [open, projectId])

  React.useEffect(() => {
    if (!open || !projectId) return
    setTreeState({ nodes: {}, children: {} })
    setSelected(null)
    fetchChildren('')
      .then(() => {
        // fetchChildren will update state
      })
      .catch(() => {})
  }, [open, projectId])

  React.useEffect(() => {
    if (!projectId) return
    if (!open) return
    if (!summaryQuery.data) return
    if (!summaryQuery.data.readme_path) return
    if (autoReadmeLoadedFor === projectId) return
    ensureVisiblePath(summaryQuery.data.readme_path, true)
      .then(() => {
        setAutoReadmeLoadedFor(projectId)
        setSelected({ path: summaryQuery.data.readme_path!, fileId: findNode(summaryQuery.data.readme_path!)?.file_id || null })
        setActiveTab('preview')
      })
      .catch(() => {})
  }, [open, projectId, summaryQuery.data, autoReadmeLoadedFor])

  const starMutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!projectId) return
      if (next) await apiJson('POST', `/projects/${projectId}/star`, {})
      else await apiJson('DELETE', `/projects/${projectId}/star`, null)
    },
    onSuccess: () => {
      if (!projectId) return
      queryClient.invalidateQueries({ queryKey: ['project-modal-summary', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: () => toast.error('Unable to update star state'),
  })

  const visibleRows = React.useMemo<VisibleTreeRow[]>(() => {
    if (searchResults) {
      return searchResults.map((r) => ({ node: r, depth: r.depth ?? r.path.split('/').filter(Boolean).length }))
    }
    const acc: VisibleTreeRow[] = []
    const visit = (parent: string, depth: number) => {
      const children = treeState.children[parent] || []
      for (const path of children) {
        const node = treeState.nodes[path]
        if (!node) continue
        acc.push({ node, depth })
        if (node.type === 'dir' && expandedPaths.has(path)) {
          visit(path, depth + 1)
        }
      }
    }
    visit('', 0)
    return acc
  }, [treeState, expandedPaths, searchResults])

  const treeContainerRef = React.useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => treeContainerRef.current,
    estimateSize: () => TREE_ROW_HEIGHT,
  })

  const previewQuery = useQuery({
    queryKey: ['project-modal-preview', selected?.fileId],
    enabled: open && !!projectId && !!selected?.fileId,
    queryFn: async () => {
      if (!selected?.fileId) throw new Error('missing file id')
      const data = await apiGet(`/files/${selected.fileId}/preview`)
      const parsed = FilePreviewSchema.parse(data)
      span('project_modal_file_previewed', {
        project_id: projectId,
        file_id: parsed.id,
        path: parsed.path,
        extension: parsed.path.split('.').pop(),
        truncated: parsed.is_truncated,
      })
      return parsed
    },
    staleTime: 0,
  })

  const activityQuery = useInfiniteQuery({
    queryKey: ['project-modal-activity', projectId],
    enabled: open && !!projectId && activeTab === 'activity',
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    queryFn: async ({ pageParam }) => {
      if (!projectId) throw new Error('missing project id')
      const params = new URLSearchParams({ limit: '20' })
      if (pageParam) params.set('cursor', pageParam)
      const data = await apiGet(`/projects/${projectId}/activity?${params.toString()}`)
      return ProjectActivityResponseSchema.parse(data)
    },
  })

  const flattenedActivity: ProjectActivityEntry[] = React.useMemo(() => {
    if (!activityQuery.data) return []
    return activityQuery.data.pages.flatMap((page) => page.items)
  }, [activityQuery.data])

  const onTabChange = (tab: string) => {
    if (tab === activeTab) return
    if (tab === 'overview' || tab === 'preview' || tab === 'activity') {
      setActiveTab(tab)
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(LAST_TAB_KEY, tab)
      } catch {}
      if (projectId) span('project_modal_tab_changed', { project_id: projectId, tab })
    }
  }

  React.useEffect(() => {
    if (open && projectId) span('project_modal_opened', { project_id: projectId })
  }, [open, projectId])

  useHotkeys(
    'mod+p',
    (event) => {
      if (!open) return
      event.preventDefault()
      if (searchInputRef.current) searchInputRef.current.focus()
    },
    [open]
  )

  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    if (searchDebounceToken) window.clearTimeout(searchDebounceToken)
    if (!projectId) return
    if (!value) {
      setSearchResults(null)
      setIsSearching(false)
      setSearchDebounceToken(null)
      return
    }
    const token = window.setTimeout(async () => {
      try {
        setIsSearching(true)
        const params = new URLSearchParams({ q: value })
        const data = await apiGet(`/projects/${projectId}/tree?${params.toString()}`)
        const parsed = ProjectTreeResponseSchema.parse(data)
        setSearchResults(parsed.items)
      } catch {
        toast.error('Search failed')
      } finally {
        setIsSearching(false)
      }
    }, 220)
    setSearchDebounceToken(token)
  }

  const handleNodeClick = (node: ProjectTreeNode) => {
    if (node.type === 'dir') {
      toggleDirectory(node.path)
    } else {
      setSelected({ path: node.path, fileId: node.file_id || null })
      setFocusedPath(node.path)
      if (projectId) {
        try {
          window.sessionStorage.setItem(READ_FOCUS_KEY_PREFIX + projectId, node.path)
        } catch {}
      }
      if (activeTab !== 'preview') setActiveTab('preview'
      )
    }
  }

  const toggleDirectory = async (path: string) => {
    if (!projectId) return
    const isExpanded = expandedPaths.has(path)
    if (isExpanded) {
      setExpandedPaths((prev) => {
        const next = new Set(prev)
        next.delete(path)
        persistExpansion(next)
        return next
      })
      return
    }
    // Ensure children loaded
    if (!(treeStateRef.current.children[path]?.length)) {
      await fetchChildren(path)
    }
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      next.add(path)
      persistExpansion(next)
      return next
    })
  }

  const persistExpansion = (setValue: Set<string>) => {
    if (!projectId) return
    try {
      window.sessionStorage.setItem(EXPANSION_KEY_PREFIX + projectId, JSON.stringify(Array.from(setValue)))
    } catch {}
  }

  const fetchChildren = React.useCallback(
    async (parentPath: string) => {
      if (!projectId) return
      const search = new URLSearchParams()
      if (parentPath) search.set('path', parentPath)
      let cursor: string | undefined
      const aggregated: ProjectTreeNode[] = []
      do {
        if (cursor) search.set('cursor', cursor)
        else search.delete('cursor')
        const response = await apiGet(`/projects/${projectId}/tree${search.toString() ? `?${search.toString()}` : ''}`)
        const parsed = ProjectTreeResponseSchema.parse(response)
        aggregated.push(...parsed.items)
        cursor = parsed.next_cursor || undefined
      } while (cursor)
      setTreeState((prev) => {
        const nextNodes = { ...prev.nodes }
        const nextChildren = { ...prev.children }
        aggregated.forEach((node) => {
          nextNodes[node.path] = node
        })
        nextChildren[parentPath || ''] = aggregated.map((node) => node.path)
        return { nodes: nextNodes, children: nextChildren }
      })
    },
    [projectId]
  )

  const findNode = (path: string): ProjectTreeNode | undefined => treeStateRef.current.nodes[path]

  const ensureVisiblePath = React.useCallback(
    async (path: string, autoSelectDir = false) => {
      if (!projectId || !path) return
      const segments = path.split('/').filter(Boolean)
      const dirSegments = segments.slice(0, -1)
      let accumulated = ''
      for (const segment of dirSegments) {
        accumulated = accumulated ? `${accumulated}/${segment}` : segment
        const parent = _parentOf(accumulated)
        if (!findNode(accumulated)) {
          await fetchChildren(parent || '')
        }
        setExpandedPaths((prev) => {
          const next = new Set(prev)
          next.add(accumulated)
          persistExpansion(next)
          return next
        })
      }
      const fileParent = dirSegments.length ? dirSegments.join('/') : ''
      if (!findNode(path)) {
        await fetchChildren(fileParent)
      }
      if (autoSelectDir && dirSegments.length > 0) {
        setExpandedPaths((prev) => {
          const next = new Set(prev)
          next.add(dirSegments.join('/'))
          persistExpansion(next)
          return next
        })
      }
    },
    [projectId, fetchChildren]
  )

  const handleSearchResultSelect = async (node: ProjectTreeNode) => {
    if (node.type === 'dir') {
      setSearchResults(null)
      setSearchValue('')
      await ensureVisiblePath(node.path, true)
      toggleDirectory(node.path)
      return
    }
    await ensureVisiblePath(node.path)
    setSearchResults(null)
    setSearchValue('')
    setSelected({ path: node.path, fileId: node.file_id || null })
    setFocusedPath(node.path)
    setActiveTab('preview')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onOpenChange(false)
      if (onAfterClose) onAfterClose()
    } else {
      onOpenChange(true)
    }
  }

  const handleExpand = () => {
    if (!summaryQuery.data || !projectId) return
    span('project_modal_expand_clicked', { project_id: projectId })
    if (onExpand) onExpand({ id: summaryQuery.data.id, slug: summaryQuery.data.slug })
    handleOpenChange(false)
  }

  const onKeyDownTree = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!visibleRows.length) return
    const inSearchMode = Boolean(searchResults)
    const currentIndex = focusedPath ? visibleRows.findIndex((row) => row.node.path === focusedPath) : -1
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const nextIndex = Math.min(currentIndex + 1, visibleRows.length - 1)
      const row = visibleRows[nextIndex]
      if (row) {
        setFocusedPath(row.node.path)
        if (row.node.type === 'file' ) setSelected({ path: row.node.path, fileId: row.node.file_id || null })
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const nextIndex = Math.max(currentIndex - 1, 0)
      const row = visibleRows[nextIndex]
      if (row) {
        setFocusedPath(row.node.path)
        if (row.node.type === 'file' ) setSelected({ path: row.node.path, fileId: row.node.file_id || null })
      }
    } else if (event.key === 'ArrowRight') {
      if (inSearchMode) return
      const row = currentIndex >= 0 ? visibleRows[currentIndex] : null
      if (row && row.node.type === 'dir') {
        event.preventDefault()
        if (!expandedPaths.has(row.node.path)) {
          toggleDirectory(row.node.path)
        } else {
          const nextIndex = currentIndex + 1
          const nextRow = visibleRows[nextIndex]
          if (nextRow) {
            setFocusedPath(nextRow.node.path)
            if (nextRow.node.type === 'file' ) setSelected({ path: nextRow.node.path, fileId: nextRow.node.file_id || null })
          }
        }
      }
    } else if (event.key === 'ArrowLeft') {
      if (inSearchMode) return
      const row = currentIndex >= 0 ? visibleRows[currentIndex] : null
      if (row) {
        event.preventDefault()
        if (row.node.type === 'dir' && expandedPaths.has(row.node.path)) {
          toggleDirectory(row.node.path)
        } else if (row.node.parent_path) {
          setFocusedPath(row.node.parent_path)
          if (findNode(row.node.parent_path)?.type === 'file') setSelected({ path: row.node.parent_path, fileId: findNode(row.node.parent_path)?.file_id || null })
        }
      }
    } else if (event.key === 'Enter') {
      const row = currentIndex >= 0 ? visibleRows[currentIndex] : null
      if (row) {
        event.preventDefault()
        if (inSearchMode) handleSearchResultSelect(row.node)
        else handleNodeClick(row.node)
      }
    }
  }

  const previewContent = React.useMemo(() => {
    const preview = previewQuery.data
    if (!preview) return null
    if (preview.preview_type !== 'text' || !preview.content) return null
    return preview.content
  }, [previewQuery.data])

  const { highlightedHtml, isHighlighting } = usePrismHighlight(previewQuery.data)

  const modalTitle = summaryQuery.data?.name || 'Project'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-[1200px] overflow-hidden p-0">
        <div className="flex h-[85vh] flex-col">
          <ModalHeader
            summary={summaryQuery.data}
            loading={summaryQuery.isLoading}
            onExpand={handleExpand}
            onToggleStar={() => {
              if (!summaryQuery.data) return
              starMutation.mutate(!summaryQuery.data.is_starred)
            }}
            starPending={starMutation.isPending}
            error={summaryQuery.error}
          />
          <div className="flex flex-1 overflow-hidden border-t">
            <aside className="flex w-80 shrink-0 flex-col border-r">
              <div className="border-b p-3">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    value={searchValue}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search files…"
                    className="h-8 flex-1"
                  />
                </div>
              </div>
              <div
                ref={treeContainerRef}
                tabIndex={0}
                onKeyDown={onKeyDownTree}
                className="relative flex-1 overflow-auto outline-none"
              >
                {summaryQuery.isLoading ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <Skeleton key={idx} className="h-4" />
                    ))}
                  </div>
                ) : isSearching ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
                  </div>
                ) : visibleRows.length === 0 ? (
                  <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">No files</div>
                ) : (
                  <div
                    style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
                    className="min-h-full"
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const row = visibleRows[virtualRow.index]
                      const node = row.node
                      const isFocused = focusedPath === node.path
                      const isSelected = selected?.path === node.path
                      const selectNode = searchResults ? () => handleSearchResultSelect(node) : () => handleNodeClick(node)
                      return (
                        <div
                          key={node.path}
                          data-depth={row.depth}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                          className={cn(
                            'flex h-7 items-center gap-2 px-3 text-sm',
                            isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/30',
                            isFocused && 'ring-1 ring-primary'
                          )}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setFocusedPath(node.path)
                          }}
                          onClick={selectNode}
                        >
                          <div style={{ width: row.depth * 12 }} />
                          {node.type === 'dir' ? (
                            expandedPaths.has(node.path) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="truncate">{node.name}</span>
                          {node.badges?.includes('readme') && (
                            <Badge variant="secondary" className="ml-1 text-[10px] uppercase">
                              README
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {searchResults && searchValue && (
                <div className="border-t bg-muted/40 p-2 text-xs text-muted-foreground">
                  Showing matches for “{searchValue}”—select to jump
                </div>
              )}
            </aside>
            <section className="flex flex-1 flex-col overflow-hidden">
              <Tabs value={activeTab} onValueChange={onTabChange} className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="preview" disabled={!selected}>File Preview</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>
                  <div className="text-xs text-muted-foreground">{modalTitle}</div>
                </div>
                <TabsContent value="overview" className="flex-1 overflow-auto px-4 py-6">
                  <OverviewTab summary={summaryQuery.data} loading={summaryQuery.isLoading} />
                </TabsContent>
                <TabsContent value="preview" className="flex-1 overflow-hidden">
                  <PreviewTab
                    summary={summaryQuery.data}
                    selection={selected}
                    preview={previewQuery.data}
                    loading={previewQuery.isLoading}
                    error={previewQuery.error}
                    highlightedHtml={highlightedHtml}
                    isHighlighting={isHighlighting}
                  />
                </TabsContent>
                <TabsContent value="activity" className="flex-1 overflow-hidden">
                  <ActivityTab
                    entries={flattenedActivity}
                    loading={activityQuery.isLoading}
                    fetchNext={activityQuery.fetchNextPage}
                    hasNext={activityQuery.hasNextPage}
                    fetchingNext={activityQuery.isFetchingNextPage}
                  />
                </TabsContent>
              </Tabs>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type ModalHeaderProps = {
  summary: ProjectModalSummary | undefined
  loading: boolean
  onExpand: () => void
  onToggleStar: () => void
  starPending: boolean
  error?: Error | null
}

function ModalHeader({ summary, loading, onExpand, onToggleStar, starPending, error }: ModalHeaderProps) {
  if (loading && !summary) {
    return (
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
    )
  }
  if (!summary) {
    return (
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <div className="text-lg font-semibold">Project</div>
          <div className="text-sm text-muted-foreground">
            {error ? `Error loading metadata: ${error.message}` : 'Unable to load project metadata.'}
          </div>
        </div>
        <Button variant="outline" onClick={onExpand}>
          <ExternalLink className="mr-2 h-4 w-4" /> Expand
        </Button>
      </div>
    )
  }
  const updated = summary.updated_at ? new Date(summary.updated_at) : null
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">{summary.name}</h2>
          <Badge variant="outline" className="uppercase text-xs">
            {summary.status}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {summary.description || 'No description provided.'}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {updated && <span>Updated {updated.toLocaleString()}</span>}
          <span>· {summary.file_count} files</span>
          <span>· {summary.directory_count} folders</span>
        </div>
        {summary.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.tags.map((tag) => (
              <Badge key={tag.slug} variant="secondary" style={tag.color ? { backgroundColor: `${tag.color}26`, color: tag.color } : undefined}>
                #{tag.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onToggleStar} disabled={starPending}>
          {summary.is_starred ? (
            <>
              <Star className="mr-2 h-4 w-4 fill-current" /> Unstar
            </>
          ) : (
            <>
              <StarOff className="mr-2 h-4 w-4" /> Star
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onExpand}>
          <ExternalLink className="mr-2 h-4 w-4" /> Expand →
        </Button>
      </div>
    </div>
  )
}

type OverviewTabProps = {
  summary: ProjectModalSummary | undefined
  loading: boolean
}

function OverviewTab({ summary, loading }: OverviewTabProps) {
  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24" />
          ))}
        </div>
      </div>
    )
  }
  if (!summary) {
    return <div className="p-4 text-sm text-muted-foreground">Metadata unavailable.</div>
  }
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">Quick stats</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.quick_stats.map((stat) => (
            <div key={stat.id} className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className="mt-1 text-sm font-medium">{stat.value}</div>
              {stat.subvalue && <div className="text-xs text-muted-foreground">{stat.subvalue}</div>}
              {stat.timestamp && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(stat.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {summary.language_mix.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Languages</h3>
          <LanguageDistribution stats={summary.language_mix} />
        </div>
      )}
      {summary.highlight && summary.highlight.snippet && (
        <div className="rounded-md border bg-muted/40 p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Highlight</div>
          <div className="mt-1 text-sm font-medium">{summary.highlight.title || summary.highlight.path}</div>
          <p className="mt-2 text-sm text-muted-foreground">{summary.highlight.snippet}</p>
        </div>
      )}
    </div>
  )
}

type LanguageDistributionProps = { stats: ProjectModalSummary['language_mix'] }

function LanguageDistribution({ stats }: LanguageDistributionProps) {
  const total = stats.reduce((sum, stat) => sum + stat.count, 0)
  if (!total) return null
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded bg-muted">
        {stats.map((stat) => (
          <div
            key={stat.language}
            className="bg-primary/70 first:rounded-l last:rounded-r"
            style={{ width: `${Math.max((stat.count / total) * 100, 4)}%` }}
            title={`${stat.language} · ${stat.count}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {stats.map((stat) => (
          <span key={stat.language}>
            {stat.language} ({stat.count})
          </span>
        ))}
      </div>
    </div>
  )
}

type PreviewTabProps = {
  summary: ProjectModalSummary | undefined
  selection: TreeSelection | null
  preview: FilePreview | undefined
  loading: boolean
  error: unknown
  highlightedHtml: string | null
  isHighlighting: boolean
}

function PreviewTab({ summary, selection, preview, loading, error, highlightedHtml, isHighlighting }: PreviewTabProps) {
  if (!selection) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select a file to preview.</div>
  }
  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-[320px] w-full" />
      </div>
    )
  }
  if (error) {
    return <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">Failed to load preview.</div>
  }
  if (!preview) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No preview available.</div>
  }
  if (preview.preview_type !== 'text') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <FileWarning className="h-10 w-10" />
        <div>
          <div className="font-medium">Preview unsupported</div>
          <p className="text-xs">This file type cannot be previewed in the modal. Open the project to view it fully.</p>
        </div>
        {summary && (
          <Button variant="outline" size="sm" onClick={() => window.open(`/projects/${summary.slug}?file=${preview.id}`, '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" /> Open in project
          </Button>
        )}
      </div>
    )
  }
  const updated = preview.updated_at ? new Date(preview.updated_at) : null
  const isMarkdown = (preview.language || '').toLowerCase() === 'markdown'
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-3">
        <div className="text-sm font-medium">{preview.title}</div>
        <div className="text-xs text-muted-foreground">
          {preview.path} • {preview.size.toLocaleString()} bytes
          {updated && <> • Updated {updated.toLocaleString()}</>}
          {preview.is_truncated && <> • Truncated preview (first {(Math.round((preview.content?.length || 0) / 1000) || 0).toLocaleString()} KB)</>}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 py-4">
        {isMarkdown && preview.rendered_html ? (
          <MarkdownViewer html={preview.rendered_html} md={preview.content || ''} />
        ) : highlightedHtml ? (
          <pre className="language" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">{isHighlighting ? 'Highlighting…' : preview.content}</pre>
        )}
      </div>
    </div>
  )
}

type ActivityTabProps = {
  entries: ProjectActivityEntry[]
  loading: boolean
  fetchNext: () => void
  hasNext: boolean | undefined
  fetchingNext: boolean
}

function ActivityTab({ entries, loading, fetchNext, hasNext, fetchingNext }: ActivityTabProps) {
  if (loading && entries.length === 0) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Skeleton key={idx} className="h-12" />
        ))}
      </div>
    )
  }
  if (entries.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No recent activity.</div>
  }
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="space-y-4 px-6 py-4">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3">
              <ActivityIcon type={entry.type} />
              <div>
                <div className="text-sm font-medium">{entry.message}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleString()}
                  {entry.actor && <> • {entry.actor}</>}
                  {entry.type === 'commit' && entry.context?.short_sha && <span> • {entry.context.short_sha}</span>}
                  {entry.type === 'file_change' && entry.context?.path && <span> • {entry.context.path}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {hasNext && (
        <div className="border-t p-3 text-center">
          <Button variant="ghost" size="sm" onClick={fetchNext} disabled={fetchingNext}>
            {fetchingNext ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            {fetchingNext ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}

function ActivityIcon({ type }: { type: string }) {
  if (type === 'commit') return <GitCommit className="mt-1 h-4 w-4 text-primary" />
  if (type === 'file_change') return <FileText className="mt-1 h-4 w-4 text-primary/70" />
  return <Activity className="mt-1 h-4 w-4 text-muted-foreground" />
}

function _parentOf(path: string): string | null {
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

type PrismState = {
  highlightedHtml: string | null
  isHighlighting: boolean
}

function usePrismHighlight(preview: FilePreview | undefined): PrismState {
  const [state, setState] = React.useState<PrismState>({ highlightedHtml: null, isHighlighting: false })

  React.useEffect(() => {
    if (!preview || preview.preview_type !== 'text' || !preview.content) {
      setState({ highlightedHtml: null, isHighlighting: false })
      return
    }
    let cancelled = false
    const languageKey = (preview.language || '').toLowerCase()
    const grammarName = SUPPORTED_PRISM_LANGS[languageKey] || 'markup'
    async function run() {
      setState({ highlightedHtml: null, isHighlighting: true })
      const Prism = await import('prismjs')
      if (!Prism.languages[grammarName]) {
        try {
          await loadPrismLanguage(grammarName)
        } catch {
          // ignore
        }
      }
      const grammar = Prism.languages[grammarName] || Prism.languages.markup
      const html = Prism.highlight(preview.content || '', grammar, grammarName)
      if (!cancelled) setState({ highlightedHtml: html, isHighlighting: false })
    }
    run()
    return () => {
      cancelled = true
    }
  }, [preview?.id, preview?.content, preview?.language, preview?.preview_type])

  return state
}

async function loadPrismLanguage(name: string) {
  switch (name) {
    case 'typescript':
      await import('prismjs/components/prism-typescript')
      await import('prismjs/components/prism-tsx')
      break
    case 'tsx':
      await import('prismjs/components/prism-tsx')
      break
    case 'jsx':
      await import('prismjs/components/prism-jsx')
      break
    case 'javascript':
      await import('prismjs/components/prism-javascript')
      break
    case 'json':
      await import('prismjs/components/prism-json')
      break
    case 'yaml':
      await import('prismjs/components/prism-yaml')
      break
    case 'bash':
      await import('prismjs/components/prism-bash')
      break
    case 'css':
      await import('prismjs/components/prism-css')
      break
    case 'markup':
      await import('prismjs/components/prism-markup')
      break
    case 'python':
      await import('prismjs/components/prism-python')
      break
    case 'go':
      await import('prismjs/components/prism-go')
      break
    case 'rust':
      await import('prismjs/components/prism-rust')
      break
    case 'java':
      await import('prismjs/components/prism-java')
      break
    case 'kotlin':
      await import('prismjs/components/prism-kotlin')
      break
    case 'swift':
      await import('prismjs/components/prism-swift')
      break
    case 'c':
      await import('prismjs/components/prism-c')
      break
    case 'cpp':
      await import('prismjs/components/prism-cpp')
      break
    case 'sql':
      await import('prismjs/components/prism-sql')
      break
    case 'markdown':
      await import('prismjs/components/prism-markdown')
      break
    default:
      await import('prismjs/components/prism-markup')
  }
}
