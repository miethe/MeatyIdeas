"use client"
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiJson } from '@/lib/apiClient'
import { toast } from 'sonner'

type DryRun = {
  will_move: boolean
  old_path: string
  new_path?: string
  title_change?: { from: string; to: string }
  files_to_rewrite: { id: string; title: string }[]
  rewrite_count: number
}

export function FileMoveDialog({ projectId, fileId, currentPath, currentTitle, onClose, onApplied }: {
  projectId: string
  fileId: string
  currentPath: string
  currentTitle: string
  onClose: () => void
  onApplied: () => void
}) {
  const [open, setOpen] = React.useState(true)
  const [newPath, setNewPath] = React.useState(currentPath)
  const [newTitle, setNewTitle] = React.useState(currentTitle)
  const [updateLinks, setUpdateLinks] = React.useState(true)
  const [dry, setDry] = React.useState<DryRun | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function runDry() {
    setLoading(true)
    try {
      const res = await apiJson<DryRun>('POST', `/files/${fileId}/move`, {
        new_path: newPath,
        new_title: newTitle !== currentTitle ? newTitle : undefined,
        update_links: updateLinks,
        dry_run: true,
      })
      setDry(res)
    } catch (e) {
      toast.error('Dry-run failed')
    } finally {
      setLoading(false)
    }
  }

  async function apply() {
    setLoading(true)
    try {
      await apiJson('POST', `/files/${fileId}/move`, {
        new_path: newPath,
        new_title: newTitle !== currentTitle ? newTitle : undefined,
        update_links: updateLinks,
        dry_run: false,
      })
      toast.success('Move applied')
      setOpen(false)
      onApplied()
    } catch (e) {
      toast.error('Move failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onClose() }}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Move / Rename File</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm">New Path</label>
              <input value={newPath} onChange={(e) => setNewPath(e.target.value)} className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
              <div className="text-xs text-muted-foreground">Current: {currentPath}</div>
            </div>
            <div className="space-y-1">
              <label className="text-sm">New Title</label>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
              <div className="text-xs text-muted-foreground">Current: {currentTitle}</div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={updateLinks} onChange={(e) => setUpdateLinks(e.target.checked)} /> Update links in other files when title changes
          </label>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={runDry} disabled={loading}>Dry Run</Button>
            <Button onClick={apply} disabled={loading}>Apply</Button>
            <Button variant="ghost" onClick={() => { setOpen(false); onClose() }}>Cancel</Button>
          </div>
          {dry && (
            <div className="rounded border p-2 text-sm">
              <div className="font-medium">Impact</div>
              <div>Will move: <span className="font-mono">{String(dry.will_move)}</span> {dry.will_move && (<span>→ {dry.new_path}</span>)}</div>
              {dry.title_change && (
                <div>Title change: {dry.title_change.from} → {dry.title_change.to}</div>
              )}
              <div>Files to rewrite: {dry.rewrite_count}</div>
              {dry.files_to_rewrite.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {dry.files_to_rewrite.map((f) => (
                    <li key={f.id}>{f.title}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

