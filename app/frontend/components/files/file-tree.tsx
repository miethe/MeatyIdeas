"use client"
import React, { useEffect, useMemo, useState } from 'react'
import { apiGet } from '@/lib/apiClient'
import { Button } from '@/components/ui/button'
import { FileMoveDialog } from './file-move-dialog'

type TreeNode = {
  name: string
  path: string
  type: 'dir' | 'file'
  children?: TreeNode[]
  file_id?: string
  title?: string
}

export function FileTree({ projectId, onOpenFile }: { projectId: string; onOpenFile?: (fileId: string) => void }) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [moveFile, setMoveFile] = useState<{ id: string; currentPath: string; currentTitle: string } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const nodes = await apiGet<TreeNode[]>(`/projects/${projectId}/files/tree`)
        setTree(nodes)
      } catch (e) {
        // ignore
      }
    }
    load()
  }, [projectId])

  function toggle(path: string) {
    setExpanded((m) => ({ ...m, [path]: !m[path] }))
  }

  function renderNode(node: TreeNode) {
    if (node.type === 'dir') {
      const isExp = expanded[node.path] ?? true
      return (
        <li key={node.path} className="my-1">
          <div className="flex items-center gap-2">
            <button className="text-xs" onClick={() => toggle(node.path)}>{isExp ? '▾' : '▸'}</button>
            <span className="font-medium">{node.name}</span>
          </div>
          {isExp && node.children && node.children.length > 0 && (
            <ul className="ml-5 border-l pl-3">
              {node.children.map((c) => renderNode(c))}
            </ul>
          )}
        </li>
      )
    }
    return (
      <li key={node.path} className="my-1 flex items-center justify-between gap-2">
        <a
          href="#"
          className="truncate hover:underline"
          onClick={(e) => {
            e.preventDefault()
            if (node.file_id) onOpenFile?.(node.file_id)
          }}
        >
          {node.name}
        </a>
        <div className="flex items-center gap-2">
          {node.file_id && (
            <Button variant="outline" size="sm" onClick={() => setMoveFile({ id: node.file_id!, currentPath: node.path, currentTitle: node.title || node.name })}>
              Move/Rename
            </Button>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="rounded border">
      <div className="border-b p-2 text-sm font-semibold">Files</div>
      <div className="max-h-96 overflow-y-auto p-2">
        {tree.length === 0 ? (
          <div className="text-sm text-muted-foreground">No files yet.</div>
        ) : (
          <ul>{tree.map((n) => renderNode(n))}</ul>
        )}
      </div>
      {moveFile && (
        <FileMoveDialog
          projectId={projectId}
          fileId={moveFile.id}
          currentPath={moveFile.currentPath}
          currentTitle={moveFile.currentTitle}
          onClose={() => setMoveFile(null)}
          onApplied={() => {
            setMoveFile(null)
            // refresh tree
            apiGet<TreeNode[]>(`/projects/${projectId}/files/tree`).then(setTree).catch(() => {})
          }}
        />
      )}
    </div>
  )
}

