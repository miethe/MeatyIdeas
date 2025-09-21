'use client'

import * as React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { span } from '@/lib/telemetry'

import { useProjectActivity } from './hooks/useProjectActivity'
import { useProjectPreview } from './hooks/useProjectPreview'
import { useProjectSummary } from './hooks/useProjectSummary'
import { useStarProject } from './hooks/useStarProject'
import { usePrismHighlight } from './hooks/usePrismHighlight'
import { FileTreePanel } from './file-tree/FileTreePanel'
import { useFileTreeState } from './file-tree/useFileTreeState'
import { ModalHeader } from './sections/ModalHeader'
import { OverviewTab } from './sections/OverviewTab'
import { PreviewTab } from './sections/PreviewTab'
import { ActivityTab } from './sections/ActivityTab'
import { LAST_TAB_KEY } from './constants'
import { ProjectModalTab } from './types'

type Props = {
  projectId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAfterClose?: () => void
  onExpand?: (project: { id: string; slug: string }) => void
}

export function ProjectDetailModal({ projectId, open, onOpenChange, onAfterClose, onExpand }: Props) {
  const [activeTab, setActiveTab] = React.useState<ProjectModalTab>(() => {
    if (typeof window === 'undefined') return 'overview'
    try {
      const stored = window.localStorage.getItem(LAST_TAB_KEY)
      if (stored === 'overview' || stored === 'preview' || stored === 'activity') return stored
    } catch {
      // ignore
    }
    return 'overview'
  })

  const fileTree = useFileTreeState({ projectId, open })
  const {
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
    onKeyDownTree,
    searchInputRef,
    ensureVisiblePath,
    getNodeByPath,
  } = fileTree

  const summaryQuery = useProjectSummary(projectId, open)
  const previewQuery = useProjectPreview(projectId, selected?.fileId ?? null, open)
  const activityQuery = useProjectActivity(projectId, open && activeTab === 'activity')
  const starMutation = useStarProject(projectId)
  const { highlightedHtml, isHighlighting } = usePrismHighlight(previewQuery.data)

  const [autoReadmeLoadedFor, setAutoReadmeLoadedFor] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!projectId) {
      setAutoReadmeLoadedFor(null)
    }
  }, [projectId])

  React.useEffect(() => {
    if (!open || !projectId) return
    if (!summaryQuery.data?.readme_path) return
    if (autoReadmeLoadedFor === projectId) return
    const path = summaryQuery.data.readme_path
    if (!path) return
    ensureVisiblePath(path, true)
      .then(() => {
        const node = getNodeByPath(path)
        setSelected({ path, fileId: node?.file_id || null })
        setFocusedPath(path)
        setActiveTab('preview')
        setAutoReadmeLoadedFor(projectId)
      })
      .catch(() => {})
  }, [autoReadmeLoadedFor, ensureVisiblePath, getNodeByPath, open, projectId, setFocusedPath, setSelected, summaryQuery.data?.readme_path])

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

  const flattenedActivity = React.useMemo(() => {
    if (!activityQuery.data) return []
    return activityQuery.data.pages.flatMap((page) => page.items)
  }, [activityQuery.data])

  const onTabChange = (tab: string) => {
    if (tab === activeTab) return
    if (tab === 'overview' || tab === 'preview' || tab === 'activity') {
      setActiveTab(tab)
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(LAST_TAB_KEY, tab)
      } catch {
        // ignore
      }
      if (projectId) span('project_modal_tab_changed', { project_id: projectId, tab })
    }
  }

  const handleNodeClickWithTab = React.useCallback(
    (node: Parameters<typeof handleNodeClick>[0]) => {
      handleNodeClick(node)
      if (node.type === 'file' && activeTab !== 'preview') {
        setActiveTab('preview')
      }
    },
    [activeTab, handleNodeClick]
  )

  const handleSearchResultSelectWithTab = React.useCallback(
    async (node: Parameters<typeof handleSearchResultSelect>[0]) => {
      await handleSearchResultSelect(node)
      if (node.type === 'file' && activeTab !== 'preview') {
        setActiveTab('preview')
      }
    },
    [activeTab, handleSearchResultSelect]
  )

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
            error={summaryQuery.error as Error | null}
          />
          <div className="flex flex-1 overflow-hidden border-t">
            <FileTreePanel
              loading={summaryQuery.isLoading}
              visibleRows={visibleRows}
              expandedPaths={expandedPaths}
              selected={selected}
              focusedPath={focusedPath}
              searchValue={searchValue}
              searchResults={searchResults}
              isSearching={isSearching}
              onSearchChange={handleSearchChange}
              onNodeClick={handleNodeClickWithTab}
              onSearchResultSelect={handleSearchResultSelectWithTab}
              onKeyDownTree={onKeyDownTree}
              searchInputRef={searchInputRef}
              setFocusedPath={setFocusedPath}
            />
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
