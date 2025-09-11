"use client"
import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiJson } from '@/lib/apiClient'
import { Project } from '@/lib/types'
import { toast } from 'sonner'

export function ProjectEditDialog({ project, children }: { project: Project; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(project.name)
  const [description, setDescription] = React.useState(project.description || '')
  const [status, setStatus] = React.useState(project.status || 'idea')
  const [tags, setTags] = React.useState((project.tags || []).join(', '))
  const qc = useQueryClient()
  const update = useMutation({
    mutationFn: async () =>
      apiJson('PUT', `/projects/${project.id}`, {
        name,
        description,
        status,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('Project updated')
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['project', project.id] })
      setOpen(false)
    },
    onError: () => toast.error('Failed to update project'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update the project details.</DialogDescription>
        </DialogHeader>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            update.mutate()
          }}
        >
          <div className="space-y-1">
            <label className="text-sm">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="focus-ring block w-full rounded-md border bg-background px-3 py-2">
                <option value="idea">Idea</option>
                <option value="discovery">Discovery</option>
                <option value="draft">Draft</option>
                <option value="live">Live</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Tags (comma separated)</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={update.isPending}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

