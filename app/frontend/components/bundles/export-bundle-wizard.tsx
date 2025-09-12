"use client"
import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiJson } from '@/lib/apiClient'
import { toast } from 'sonner'

type FileRow = { id: string, path: string, title: string }

const ROLE_OPTIONS = ['Spec', 'PRD', 'RFC', 'Test Plan', 'Notes', 'Other']

export function ExportBundleWizard({ projectId }: { projectId: string }) {
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState(0)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [roles, setRoles] = React.useState<Record<string, string>>({})
  const [includeChecksums, setIncludeChecksums] = React.useState(true)
  const [pushBranch, setPushBranch] = React.useState(false)
  const [openPr, setOpenPr] = React.useState(false)

  const files = useQuery({
    queryKey: ['files', projectId],
    queryFn: async () => apiGet<any[]>(`/projects/${projectId}/files`).then(rows => rows.map(r => ({ id: r.id, path: r.path, title: r.title }) as FileRow)),
    enabled: open && !!projectId,
  })

  React.useEffect(() => {
    if (files.data && selectedIds.length === 0) setSelectedIds(files.data.map(f => f.id))
  }, [files.data])

  const startExport = useMutation({
    mutationFn: async () => apiJson('POST', `/projects/${projectId}/export/bundle`, {
      selection: { file_ids: selectedIds, roles },
      include_checksums: includeChecksums,
      push_branch: pushBranch,
      open_pr: openPr,
    }),
    onSuccess: () => { toast.success('Bundle export started'); setOpen(false) },
    onError: () => toast.error('Failed to start export'),
  })

  const toggleId = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const renderStep = () => {
    if (step === 0) {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Select files to include</div>
            <div className="space-x-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(files.data?.map(f => f.id) || [])}>All</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>None</Button>
            </div>
          </div>
          <div className="max-h-64 overflow-auto rounded border">
            {files.isLoading && <div className="p-3 text-sm text-muted-foreground">Loading files…</div>}
            {files.data?.map(f => (
              <label key={f.id} className="flex items-center gap-2 p-2 hover:bg-accent/40">
                <input type="checkbox" checked={selectedIds.includes(f.id)} onChange={() => toggleId(f.id)} />
                <span className="truncate text-sm">{f.path}</span>
              </label>
            ))}
          </div>
        </div>
      )
    }
    if (step === 1) {
      const sel = files.data?.filter(f => selectedIds.includes(f.id)) || []
      return (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Assign roles (optional)</div>
          <div className="max-h-64 overflow-auto rounded border divide-y">
            {sel.map(f => (
              <div key={f.id} className="flex items-center justify-between p-2">
                <div className="truncate text-sm">{f.path}</div>
                <select className="text-sm border rounded px-2 py-1 bg-background" value={roles[f.id] || ''} onChange={(e) => setRoles(r => ({ ...r, [f.id]: e.target.value }))}>
                  <option value="">None</option>
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (step === 2) {
      return (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeChecksums} onChange={(e) => setIncludeChecksums(e.target.checked)} />
            Include checksums
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pushBranch} onChange={(e) => setPushBranch(e.target.checked)} />
            Push bundle branch
          </label>
          <label className="flex items-center gap-2 text-sm ml-6">
            <input type="checkbox" disabled={!pushBranch} checked={openPr} onChange={(e) => setOpenPr(e.target.checked)} />
            Open PR after push
          </label>
        </div>
      )
    }
    const sel = files.data?.filter(f => selectedIds.includes(f.id)) || []
    return (
      <div className="space-y-2 text-sm">
        <div className="text-muted-foreground">Manifest preview (summary)</div>
        <pre className="max-h-64 overflow-auto rounded border bg-muted p-2 text-xs">{JSON.stringify({ project: { id: projectId }, files: sel.map(f => ({ path: `files/${f.path}`, role: roles[f.id] || '' })), include_checksums: includeChecksums, push_branch: pushBranch, open_pr: openPr }, null, 2)}</pre>
      </div>
    )
  }

  const canNext = () => {
    if (step === 0) return selectedIds.length > 0
    return true
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setStep(0) } }}>
      <DialogTrigger asChild>
        <Button variant="outline">Export</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export Bundle</DialogTitle>
          <DialogDescription>Wizard to curate and ship an Agent Bundle.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div className="font-medium">{['Select Files', 'Assign Roles', 'Options', 'Preview'][step]}</div>
            <div className="text-muted-foreground">Step {step + 1} of 4</div>
          </div>
          {renderStep()}
          <div className="flex justify-between pt-2">
            <div>
              {step > 0 && <Button variant="ghost" onClick={() => setStep(s => s - 1)}>Back</Button>}
            </div>
            <div className="space-x-2">
              {step < 3 && <Button variant="outline" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>Next</Button>}
              {step === 3 && <Button onClick={() => startExport.mutate()} disabled={startExport.isPending}>Start Export</Button>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

