"use client"

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiJson } from '@/lib/apiClient'
import { FolderPathCombobox } from './folder-path-combobox'
import { span } from '@/lib/telemetry'

export type FolderCreateDialogProps = {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPath?: string
  onCreated?: (path: string) => void
}

export function FolderCreateDialog({ projectId, open, onOpenChange, initialPath = '', onCreated }: FolderCreateDialogProps) {
  const qc = useQueryClient()
  const [parent, setParent] = React.useState('')
  const [name, setName] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    if (!initialPath) {
      setParent('')
      setName('')
      return
    }
    const trimmed = initialPath.trim()
    const normalized = trimmed.replace(/^\/+|\/+$/g, '')
    if (!normalized) {
      setParent('')
      setName('')
      return
    }
    const segments = normalized.split('/').filter(Boolean)
    const endsWithSlash = trimmed.endsWith('/')
    if (endsWithSlash) {
      setParent(normalized)
      setName('')
      return
    }
    if (segments.length > 1) {
      const last = segments.pop() || ''
      setParent(segments.join('/'))
      setName(last)
      return
    }
    setParent('')
    setName(segments[0])
  }, [initialPath, open])

  const createMutation = useMutation({
    mutationFn: async (folderPath: string) => {
      await apiJson('POST', `/projects/${projectId}/dirs`, { path: folderPath })
      return folderPath
    },
    onSuccess: (path) => {
      toast.success('Folder created')
      qc.invalidateQueries({ queryKey: ['project-dirs', projectId] })
      span('folder_dialog_created', { project_id: projectId, path })
      onCreated?.(path)
      onOpenChange(false)
      setName('')
    },
    onError: (error: any) => {
      const message = error?.detail?.message || 'Unable to create folder'
      toast.error(message)
    },
  })

  const fullPath = React.useMemo(() => {
    const trimmedName = name.trim().replace(/^\/+|\/+$/g, '')
    if (!trimmedName) return parent
    if (!parent) return trimmedName
    return `${parent.replace(/\/+$/g, '')}/${trimmedName}`
  }, [name, parent])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const targetPath = fullPath.trim().replace(/^\/+|\/+$/g, '')
    if (!targetPath) {
      toast.error('Folder name required')
      return
    }
    createMutation.mutate(targetPath)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Folder</DialogTitle>
          <DialogDescription>Select where the folder should live and provide its name.</DialogDescription>
        </DialogHeader>
        <form className="mt-3 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Parent folder</label>
            <FolderPathCombobox
              projectId={projectId}
              value={parent}
              onChange={setParent}
              allowCreate={false}
              placeholder="Root /"
            />
            <p className="text-xs text-muted-foreground">Leave as root to create the folder at the top level.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Folder name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="specs" autoFocus />
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Full path: <span className="font-mono text-foreground">/{fullPath}</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create Folder'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
