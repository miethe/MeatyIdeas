"use client"
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiJson, getApiBase, getToken } from '@/lib/apiClient'
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const nodes = await apiGet<TreeNode[]>(`/projects/${projectId}/files/tree?include_empty_dirs=1`)
        setTree(nodes)
      } catch (e) {
        // ignore
      }
    }
    load()
  }, [projectId])

  // SSE refresh on directory/file events
  useEffect(() => {
    if (!projectId) return
    const connect = () => {
      const url = `${getApiBase()}/events/stream?project_id=${encodeURIComponent(projectId)}&token=${encodeURIComponent(getToken())}`
      const es = new EventSource(url, { withCredentials: false })
      esRef.current = es
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          const type = data.type as string
          if (type.startsWith('dir.') || type === 'file.moved' || type === 'files.batch_moved') {
            apiGet<TreeNode[]>(`/projects/${projectId}/files/tree?include_empty_dirs=1`).then(setTree).catch(() => {})
          }
        } catch {}
      }
      es.onerror = () => {
        es.close()
        setTimeout(connect, 1500)
      }
    }
    connect()
    return () => { if (esRef.current) { esRef.current.close(); esRef.current = null } }
  }, [projectId])

  function toggle(path: string) {
    setExpanded((m) => ({ ...m, [path]: !m[path] }))
  }

  function renderNode(node: TreeNode) {
    if (node.type === 'dir') {
      const isExp = expanded[node.path] ?? true
      return (
        <li key={node.path} className="my-1"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDrop={async (e) => {
              const fid = e.dataTransfer.getData('text/x-file-id')
              const fpath = e.dataTransfer.getData('text/x-file-path')
              if (fid && node.path) {
                try {
                  await apiJson('POST', `/files/batch/move`, { files: [{ file_id: fid, new_path: `${node.path}/${fpath.split('/').pop()}` }] })
                } catch {}
              }
            }}
        >
          <div className="flex items-center gap-2">
            <button className="text-xs" onClick={() => toggle(node.path)}>{isExp ? '▾' : '▸'}</button>
            <span className="font-medium">{node.name}</span>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={async () => {
                const name = prompt('New folder name')
                if (!name) return
                const path = `${node.path}/${name}`.replaceAll('//','/')
                try { await apiJson('POST', `/projects/${projectId}/dirs`, { path }) } catch {}
              }}>+ Folder</Button>
              <Button variant="ghost" size="sm" onClick={async () => {
                const nn = prompt('Rename folder to (path)', node.path)
                if (!nn) return
                try { await apiJson('PATCH', `/projects/${projectId}/dirs`, { old_path: node.path, new_path: nn }) } catch {}
              }}>Rename</Button>
              <Button variant="ghost" size="sm" onClick={async () => {
                try { await apiJson('DELETE', `/projects/${projectId}/dirs`, { path: node.path }) } catch(e:any) { /* ignore */ }
              }}>Delete</Button>
            </div>
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
      <li key={node.path} className={"my-1 flex items-center justify-between gap-2 " + (selected.has(node.file_id || '') ? 'bg-accent/30' : '')}>
        <a
          href="#"
          className="truncate hover:underline"
          draggable
          onDragStart={(e) => {
            if (node.file_id) {
              e.dataTransfer.setData('text/x-file-id', node.file_id)
              e.dataTransfer.setData('text/x-file-path', node.path)
              e.dataTransfer.effectAllowed = 'move'
            }
          }}
          onClick={(e) => {
            e.preventDefault()
            if (node.file_id) onOpenFile?.(node.file_id)
          }}
          onMouseDown={(e) => {
            if (!node.file_id) return
            const isMeta = e.metaKey || e.ctrlKey
            const isShift = e.shiftKey
            setSelected((prev) => {
              const next = new Set(prev)
              if (isMeta) {
                if (next.has(node.file_id!)) next.delete(node.file_id!)
                else next.add(node.file_id!)
              } else if (isShift) {
                next.add(node.file_id!)
              } else {
                next.clear(); next.add(node.file_id!)
              }
              return next
            })
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
      <div className="border-b p-2 text-sm font-semibold flex items-center gap-2">
        <span>Files</span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={async () => {
            const name = prompt('New folder name (at root)')
            if (!name) return
            try { await apiJson('POST', `/projects/${projectId}/dirs`, { path: name }) } catch {}
          }}>+ Folder</Button>
          {selected.size > 0 && (
            <Button size="sm" variant="outline" onClick={async () => {
              const dest = prompt('Move selected to path (folder)')
              if (!dest) return
              const files = Array.from(selected).map((id) => ({ file_id: id, new_path: `${dest}` }))
              try { await apiJson('POST', `/files/batch/move`, { files }) } catch {}
              setSelected(new Set())
            }}>Move Selected</Button>
          )}
        </div>
      </div>
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
