"use client"
import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiJson } from '@/lib/apiClient'
import { toast } from 'sonner'

export function ExportBundleDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = React.useState(false)
  const [includeAll, setIncludeAll] = React.useState(true)
  const qc = useQueryClient()
  const files = qc.getQueryData<any[]>(['files', projectId]) || []
  const exportMut = useMutation({
    mutationFn: async () => apiJson('POST', `/projects/${projectId}/export/bundle`, {
      file_ids: includeAll ? files.map((f: any) => f.id) : files.slice(0, 3).map((f: any) => f.id),
      include_checksums: true,
      push_branch: false,
    }),
    onSuccess: () => toast.success('Bundle export started'),
    onError: () => toast.error('Failed to start export'),
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Export</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Bundle</DialogTitle>
          <DialogDescription>Prepare a ZIP of selected files. This is a placeholder flow to verify the path.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeAll} onChange={(e) => setIncludeAll(e.target.checked)} />
            Include all files in project
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={() => exportMut.mutate()} disabled={exportMut.isPending}>Export</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

