"use client"

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiJson } from '@/lib/apiClient'
import { span } from '@/lib/telemetry'

export type ProjectStatusOption = {
  key: string
  label: string
  color?: string | null
}

export type ProjectTemplateOption = {
  key: string
  label: string
  description?: string | null
}

type ProjectInlineCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  statusOptions: ProjectStatusOption[]
  templateOptions: ProjectTemplateOption[]
  onCreated: (project: { id: string; name: string; slug: string }) => void
}

export function ProjectInlineCreateDialog({ open, onOpenChange, statusOptions, templateOptions, onCreated }: ProjectInlineCreateDialogProps) {
  const qc = useQueryClient()
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [status, setStatus] = React.useState<string>(() => statusOptions[0]?.key ?? 'idea')
  const [tags, setTags] = React.useState('')
  const [templateKey, setTemplateKey] = React.useState<string>(() => templateOptions[0]?.key ?? 'blank')

  React.useEffect(() => {
    if (statusOptions.length > 0 && !statusOptions.find((opt) => opt.key === status)) {
      setStatus(statusOptions[0].key)
    }
  }, [statusOptions, status])

  React.useEffect(() => {
    if (templateOptions.length > 0 && !templateOptions.find((opt) => opt.key === templateKey)) {
      setTemplateKey(templateOptions[0].key)
    }
  }, [templateKey, templateOptions])

  const resetState = React.useCallback(() => {
    setName('')
    setDescription('')
    setTags('')
    if (statusOptions[0]) setStatus(statusOptions[0].key)
    if (templateOptions[0]) setTemplateKey(templateOptions[0].key)
  }, [statusOptions, templateOptions])

  const createMutation = useMutation({
    mutationFn: async () =>
      apiJson('POST', '/projects', {
        name,
        description,
        status,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        template_id: templateKey,
      }),
    onSuccess: (project: any) => {
      toast.success('Project created')
      span('ui.create.project', { source: 'inline' })
      resetState()
      onCreated({ id: project.id, name: project.name, slug: project.slug })
      qc.invalidateQueries({ queryKey: ['projects-nav'] })
      onOpenChange(false)
    },
    onError: () => toast.error('Unable to create project'),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetState()
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Create a project without leaving the flow.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim()) {
              toast.error('Project name is required')
              return
            }
            createMutation.mutate()
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
              placeholder="North Star Initiative"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
              placeholder="Short summary"
              rows={3}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="focus-ring block w-full rounded-md border bg-background px-3 py-2 capitalize"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.key} value={opt.key} className="capitalize">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Tags</label>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
                placeholder="tag-one, tag-two"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Template</label>
            <select
              value={templateKey}
              onChange={(event) => setTemplateKey(event.target.value)}
              className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
            >
              {templateOptions.map((tpl) => (
                <option key={tpl.key} value={tpl.key}>
                  {tpl.label}
                </option>
              ))}
            </select>
            {templateOptions.find((tpl) => tpl.key === templateKey)?.description && (
              <p className="text-xs text-muted-foreground">
                {templateOptions.find((tpl) => tpl.key === templateKey)?.description}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
