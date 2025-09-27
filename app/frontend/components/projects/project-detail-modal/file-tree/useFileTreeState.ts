import * as React from 'react'
import { toast } from 'sonner'

import { apiGet } from '@/lib/apiClient'
import { ProjectTreeNode, ProjectTreeResponseSchema } from '@/lib/types'
import { useProjectEvents } from '@/lib/events/project-events'
import type { ProjectEventMessage } from '@/lib/events/project-events'

import { EXPANSION_KEY_PREFIX, READ_FOCUS_KEY_PREFIX } from '../constants'
import { ModalTreeState, TreeSelection, VisibleTreeRow } from '../types'

type UseFileTreeStateArgs = {
  projectId: string | null
  open: boolean
}

type UseFileTreeStateResult = {
  visibleRows: VisibleTreeRow[]
  expandedPaths: Set<string>
  selected: TreeSelection | null
  setSelected: React.Dispatch<React.SetStateAction<TreeSelection | null>>
  focusedPath: string | null
  setFocusedPath: React.Dispatch<React.SetStateAction<string | null>>
  searchValue: string
  searchResults: ProjectTreeNode[] | null
  isSearching: boolean
  handleSearchChange: (value: string) => void
  handleNodeClick: (node: ProjectTreeNode) => void
  handleSearchResultSelect: (node: ProjectTreeNode) => Promise<void>
  toggleDirectory: (path: string) => Promise<void>
  ensureVisiblePath: (path: string, autoSelectDir?: boolean) => Promise<void>
  onKeyDownTree: (event: React.KeyboardEvent<HTMLDivElement>) => void
  searchInputRef: React.RefObject<HTMLInputElement>
  getNodeByPath: (path: string) => ProjectTreeNode | undefined
}

export function useFileTreeState({ projectId, open }: UseFileTreeStateArgs): UseFileTreeStateResult {
  const [treeState, setTreeState] = React.useState<ModalTreeState>({ nodes: {}, children: {} })
  const treeStateRef = React.useRef(treeState)
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(new Set())
  const expandedPathsRef = React.useRef<Set<string>>(new Set())
  const [selected, setSelected] = React.useState<TreeSelection | null>(null)
  const [focusedPath, setFocusedPath] = React.useState<string | null>(null)
  const focusRef = React.useRef<string | null>(null)
  const [searchValue, setSearchValue] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<ProjectTreeNode[] | null>(null)
  const [isSearching, setIsSearching] = React.useState(false)
  const searchDebounceRef = React.useRef<number | null>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const refreshTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    treeStateRef.current = treeState
  }, [treeState])

  React.useEffect(() => {
    focusRef.current = focusedPath
  }, [focusedPath])

  React.useEffect(() => {
    expandedPathsRef.current = new Set(expandedPaths)
  }, [expandedPaths])

  React.useEffect(() => {
    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current)
    }
  }, [])

  React.useEffect(() => {
    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current)
    }
  }, [])

  const persistExpansion = React.useCallback(
    (next: Set<string>) => {
      if (!projectId) return
      try {
        window.sessionStorage.setItem(EXPANSION_KEY_PREFIX + projectId, JSON.stringify(Array.from(next)))
      } catch {
        // ignore
      }
    },
    [projectId]
  )

  const fetchChildren = React.useCallback(
    async (parentPath: string) => {
      if (!projectId) return
      const searchParams = new URLSearchParams()
      if (parentPath) searchParams.set('path', parentPath)
      let cursor: string | undefined
      const aggregated: ProjectTreeNode[] = []
      do {
        if (cursor) searchParams.set('cursor', cursor)
        else searchParams.delete('cursor')
        const response = await apiGet(`/projects/${projectId}/tree${searchParams.toString() ? `?${searchParams.toString()}` : ''}`)
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

  const refreshTree = React.useCallback(async () => {
    if (!projectId) return
    try {
      await fetchChildren('')
      const expanded = Array.from(expandedPathsRef.current)
      for (const path of expanded) {
        if (path) await fetchChildren(path)
      }
    } catch (error) {
      console.error('Project modal tree refresh failed', error)
    }
  }, [fetchChildren, projectId])

  const findNode = React.useCallback((path: string) => treeStateRef.current.nodes[path], [])

  const ensureVisiblePath = React.useCallback(
    async (path: string, autoSelectDir = false) => {
      if (!projectId || !path) return
      const segments = path.split('/').filter(Boolean)
      const dirSegments = segments.slice(0, -1)
      let accumulated = ''
      for (const segment of dirSegments) {
        accumulated = accumulated ? `${accumulated}/${segment}` : segment
        const parent = parentOf(accumulated)
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
    [fetchChildren, findNode, persistExpansion, projectId]
  )

  React.useEffect(() => {
    if (!open || !projectId) return
    const expandedStoredKey = EXPANSION_KEY_PREFIX + projectId
    try {
      const stored = window.sessionStorage.getItem(expandedStoredKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setExpandedPaths(new Set(parsed))
          return
        }
      }
    } catch {
      // ignore
    }
    setExpandedPaths(new Set())
  }, [open, projectId])

  React.useEffect(() => {
    if (!open || !projectId) return
    const storedFocusKey = READ_FOCUS_KEY_PREFIX + projectId
    try {
      const stored = window.sessionStorage.getItem(storedFocusKey)
      if (stored) {
        setFocusedPath(stored)
      }
    } catch {
      // ignore
    }
  }, [open, projectId])

  React.useEffect(() => {
    if (!open || !projectId) return
    setTreeState({ nodes: {}, children: {} })
    setSelected(null)
    fetchChildren('').catch(() => {})
  }, [fetchChildren, open, projectId])

  const scheduleRefresh = React.useCallback(() => {
    if (refreshTimerRef.current) return
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null
      refreshTree().catch(() => {})
    }, 150)
  }, [refreshTree])

  useProjectEvents(
    projectId,
    React.useCallback(
      (event: ProjectEventMessage) => {
        const type = event.type
        if (type.startsWith('file.') || type.startsWith('dir.') || type === 'files.batch_moved') {
          scheduleRefresh()
        }
      },
      [scheduleRefresh]
    )
  )

  const visibleRows = React.useMemo<VisibleTreeRow[]>(() => {
    if (searchResults) {
      return searchResults.map((node) => ({
        node,
        depth: node.depth ?? node.path.split('/').filter(Boolean).length,
      }))
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
  }, [expandedPaths, searchResults, treeState])

  const toggleDirectory = React.useCallback(
    async (path: string) => {
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
      if (!(treeStateRef.current.children[path]?.length)) {
        await fetchChildren(path)
      }
      setExpandedPaths((prev) => {
        const next = new Set(prev)
        next.add(path)
        persistExpansion(next)
        return next
      })
    },
    [expandedPaths, fetchChildren, persistExpansion, projectId]
  )

  const handleNodeClick = React.useCallback(
    (node: ProjectTreeNode) => {
      if (node.type === 'dir') {
        toggleDirectory(node.path)
        return
      }
      setSelected({ path: node.path, fileId: node.file_id || null })
      setFocusedPath(node.path)
      if (projectId) {
        try {
          window.sessionStorage.setItem(READ_FOCUS_KEY_PREFIX + projectId, node.path)
        } catch {
          // ignore
        }
      }
    },
    [projectId, toggleDirectory]
  )

  const handleSearchChange = React.useCallback(
    (value: string) => {
      setSearchValue(value)
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current)
      if (!projectId) return
      if (!value) {
        setSearchResults(null)
        setIsSearching(false)
        searchDebounceRef.current = null
        return
      }
      searchDebounceRef.current = window.setTimeout(async () => {
        try {
          setIsSearching(true)
          const params = new URLSearchParams({ q: value })
          const data = await apiGet(`/projects/${projectId}/tree?${params.toString()}`)
          const parsed = ProjectTreeResponseSchema.parse(data)
          setSearchResults(parsed.items)
        } catch (error) {
          console.error('Project tree search failed:', error)
          toast.error('Search failed')
        } finally {
          setIsSearching(false)
        }
      }, 220)
    },
    [projectId]
  )

  const handleSearchResultSelect = React.useCallback(
    async (node: ProjectTreeNode) => {
      if (node.type === 'dir') {
        setSearchResults(null)
        setSearchValue('')
        await ensureVisiblePath(node.path, true)
        await toggleDirectory(node.path)
        return
      }
      await ensureVisiblePath(node.path)
      setSearchResults(null)
      setSearchValue('')
      setSelected({ path: node.path, fileId: node.file_id || null })
      setFocusedPath(node.path)
    },
    [ensureVisiblePath, toggleDirectory]
  )

  const onKeyDownTree = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!visibleRows.length) return
      const inSearchMode = Boolean(searchResults)
      const currentIndex = focusedPath ? visibleRows.findIndex((row) => row.node.path === focusedPath) : -1
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const nextIndex = Math.min(currentIndex + 1, visibleRows.length - 1)
        const row = visibleRows[nextIndex]
        if (row) {
          setFocusedPath(row.node.path)
          if (row.node.type === 'file') setSelected({ path: row.node.path, fileId: row.node.file_id || null })
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        const nextIndex = Math.max(currentIndex - 1, 0)
        const row = visibleRows[nextIndex]
        if (row) {
          setFocusedPath(row.node.path)
          if (row.node.type === 'file') setSelected({ path: row.node.path, fileId: row.node.file_id || null })
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
              if (nextRow.node.type === 'file') setSelected({ path: nextRow.node.path, fileId: nextRow.node.file_id || null })
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
            const parentNode = findNode(row.node.parent_path)
            if (parentNode?.type === 'file') {
              setSelected({ path: parentNode.path, fileId: parentNode.file_id || null })
            }
          }
        }
      } else if (event.key === 'Enter') {
        const row = currentIndex >= 0 ? visibleRows[currentIndex] : null
        if (row) {
          event.preventDefault()
          if (inSearchMode) void handleSearchResultSelect(row.node)
          else handleNodeClick(row.node)
        }
      }
    },
    [expandedPaths, findNode, focusedPath, handleNodeClick, handleSearchResultSelect, searchResults, toggleDirectory, visibleRows]
  )

  return {
    visibleRows,
    expandedPaths,
    selected,
    setSelected,
    focusedPath,
    setFocusedPath,
    searchValue,
    searchResults,
    isSearching,
    handleSearchChange,
    handleNodeClick,
    handleSearchResultSelect,
    toggleDirectory,
    ensureVisiblePath,
    onKeyDownTree,
    searchInputRef,
    getNodeByPath: findNode,
  }
}

function parentOf(path: string): string | null {
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}
