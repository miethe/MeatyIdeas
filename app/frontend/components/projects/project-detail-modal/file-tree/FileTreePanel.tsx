import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight, FileText, Loader2, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/skeleton'
import { cn } from '@/lib/utils'
import { ProjectTreeNode } from '@/lib/types'

import { TREE_ROW_HEIGHT } from '../constants'
import { TreeSelection, VisibleTreeRow } from '../types'

type FileTreePanelProps = {
  loading: boolean
  visibleRows: VisibleTreeRow[]
  expandedPaths: Set<string>
  selected: TreeSelection | null
  focusedPath: string | null
  searchValue: string
  searchResults: ProjectTreeNode[] | null
  isSearching: boolean
  onSearchChange: (value: string) => void
  onNodeClick: (node: ProjectTreeNode) => void
  onSearchResultSelect: (node: ProjectTreeNode) => Promise<void>
  onKeyDownTree: (event: React.KeyboardEvent<HTMLDivElement>) => void
  searchInputRef: React.RefObject<HTMLInputElement>
  setFocusedPath: React.Dispatch<React.SetStateAction<string | null>>
}

export function FileTreePanel({
  loading,
  visibleRows,
  expandedPaths,
  selected,
  focusedPath,
  searchValue,
  searchResults,
  isSearching,
  onSearchChange,
  onNodeClick,
  onSearchResultSelect,
  onKeyDownTree,
  searchInputRef,
  setFocusedPath,
}: FileTreePanelProps) {
  const treeContainerRef = React.useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => treeContainerRef.current,
    estimateSize: () => TREE_ROW_HEIGHT,
  })

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r">
      <div className="border-b p-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search files…"
            className="h-8 flex-1"
          />
        </div>
      </div>
      <div ref={treeContainerRef} tabIndex={0} onKeyDown={onKeyDownTree} className="relative flex-1 overflow-auto outline-none">
        {loading ? (
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
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }} className="min-h-full">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = visibleRows[virtualRow.index]
              const node = row.node
              const isFocused = focusedPath === node.path
              const isSelected = selected?.path === node.path
              const selectNode = searchResults ? () => onSearchResultSelect(node) : () => onNodeClick(node)
              const icon = node.type === 'dir'
                ? expandedPaths.has(node.path)
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                : <FileText className="h-4 w-4 text-muted-foreground" />

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
                  onMouseDown={(event) => {
                    event.preventDefault()
                    setFocusedPath(node.path)
                  }}
                  onClick={() => selectNode()}
                >
                  <div style={{ width: row.depth * 12 }} />
                  {icon}
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
  )
}
