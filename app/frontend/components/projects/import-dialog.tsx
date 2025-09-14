"use client"
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getApiBase, getToken } from '@/lib/apiClient'
import { useState } from 'react'
import { toast } from 'sonner'

export function ImportDialog({ projectId, children }: { projectId?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'zip' | 'files' | 'json' | 'git'>('zip')
  const [targetPath, setTargetPath] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [busy, setBusy] = useState(false)

  async function enqueueImport() {
    try {
      setBusy(true)
      const base = getApiBase()
      const token = getToken()
      const url = `${base}/projects/import`
      const fd = new FormData()
      fd.append('mode', mode)
      if (projectId) fd.append('project_id', projectId)
      if (targetPath) fd.append('target_path', targetPath)
      if (mode === 'git') {
        fd.append('body', JSON.stringify({ repo_url: repoUrl }))
      } else if (mode === 'zip' || mode === 'json') {
        if (!files || files.length === 0) throw new Error('Select a file')
        fd.append('file', files[0])
      } else if (mode === 'files') {
        if (!files || files.length === 0) throw new Error('Select files')
        Array.from(files).forEach((f) => fd.append('files', f))
      }
      const res = await fetch(url, { method: 'POST', headers: { 'X-Token': token }, body: fd })
      if (!res.ok) throw new Error('Import enqueue failed')
      const data = await res.json()
      toast('Import enqueued', { description: `Job ${data.job_id}` })
      setOpen(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to enqueue import')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import into project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="text-sm">
            <span className="mr-2">Mode:</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="rounded border px-2 py-1">
              <option value="zip">Zip</option>
              <option value="files">Files</option>
              <option value="json">JSON</option>
              <option value="git">Git Repo</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mr-2">Target path (optional):</span>
            <input value={targetPath} onChange={(e) => setTargetPath(e.target.value)} className="rounded border px-2 py-1" placeholder="folder/subfolder" />
          </label>
          {mode === 'git' ? (
            <label className="text-sm">
              <span className="mr-2">Repo URL:</span>
              <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="https://..." />
            </label>
          ) : (
            <label className="text-sm">
              <span className="mr-2">{mode === 'files' ? 'Files:' : 'File:'}</span>
              <input type="file" multiple={mode === 'files'} onChange={(e) => setFiles(e.target.files)} />
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={enqueueImport} disabled={busy}>{busy ? 'Enqueuing…' : 'Import'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

