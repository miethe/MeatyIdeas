"use client"
import React, { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiJson } from '@/lib/apiClient'
import { span } from '@/lib/telemetry'
import { getConfig } from '@/lib/config'
import { toast } from 'sonner'

export function ProjectCreateSheet({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('idea')
  const [tags, setTags] = useState('')
  const [templateKey, setTemplateKey] = useState('blank')
  const qc = useQueryClient()
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: 60_000 })
  const statusOptions = config?.PROJECT_STATUS_OPTIONS ?? [
    { key: 'idea', label: 'Idea' },
    { key: 'discovery', label: 'Discovery' },
    { key: 'draft', label: 'Draft' },
    { key: 'live', label: 'Live' },
    { key: 'archived', label: 'Archived' },
  ]
  const templateOptions = config?.PROJECT_TEMPLATES ?? [
    { key: 'blank', label: 'Blank', description: 'Start from scratch' },
  ]
  const selectedTemplate = templateOptions.find((tpl) => tpl.key === templateKey) || templateOptions[0]

  useEffect(() => {
    if (statusOptions.length > 0 && !statusOptions.find((opt) => opt.key === status)) {
      setStatus(statusOptions[0].key)
    }
  }, [statusOptions, status])

  useEffect(() => {
    if (templateOptions.length > 0 && !templateOptions.find((opt) => opt.key === templateKey)) {
      setTemplateKey(templateOptions[0].key)
    }
  }, [templateKey, templateOptions])

  const create = useMutation({
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
    onSuccess: () => {
      span('ui.create.project')
      toast.success('Project created')
      qc.invalidateQueries({ queryKey: ['projects-nav'] })
      qc.invalidateQueries({ queryKey: ['dashboard-projects'] })
      setOpen(false)
      setName('')
      setDescription('')
      setTags('')
      if (templateOptions.length > 0) setTemplateKey(templateOptions[0].key)
    },
    onError: () => toast.error('Failed to create project'),
  })

  useEffect(() => {
    function open() {
      setOpen(true)
    }
    window.addEventListener('open-new-project', open as any)
    return () => window.removeEventListener('open-new-project', open as any)
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New Project</SheetTitle>
          <SheetDescription>Give your project a name and details.</SheetDescription>
        </SheetHeader>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate()
          }}
        >
          <div className="space-y-1">
            <label className="text-sm">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="My project" className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
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
              <label className="text-sm">Tags (comma separated)</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2" className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm">Template</label>
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
            >
              {templateOptions.map((tpl) => (
                <option key={tpl.key} value={tpl.key}>
                  {tpl.label}
                </option>
              ))}
            </select>
            {selectedTemplate?.description && (
              <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
