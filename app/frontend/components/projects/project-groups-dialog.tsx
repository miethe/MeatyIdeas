"use client"

import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiGet, apiJson } from '@/lib/apiClient'
import { ProjectGroupSchema } from '@/lib/types'
import { z } from 'zod'

const ProjectGroupListSchema = z.array(ProjectGroupSchema)

type ProjectGroupsDialogProps = {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  currentGroupIds: string[]
  onSaved?: () => void
}

export function ProjectGroupsDialog({ projectId, open, onOpenChange, currentGroupIds, onSaved }: ProjectGroupsDialogProps) {
  const qc = useQueryClient()
  const [selection, setSelection] = React.useState<string | null>(currentGroupIds[0] || null)

  React.useEffect(() => {
    if (open) {
      setSelection(currentGroupIds[0] || null)
    }
  }, [open, currentGroupIds])

  const groupsQuery = useQuery({
    queryKey: ['project-groups', 'chooser'],
    enabled: open,
    queryFn: async () => {
      try {
        const res = await apiGet('/project-groups')
        return ProjectGroupListSchema.parse(res)
      } catch (error) {
        console.error('Failed to load groups', error)
        throw error
      }
    },
    staleTime: 120_000,
  })

  const assignMutation = useMutation({
    mutationFn: async (groupId: string | null) => {
      if (!groupId) {
        await apiJson('DELETE', `/project-groups/assign/${projectId}`, null)
        return
      }
      await apiJson('POST', `/project-groups/${groupId}/assign`, { project_id: projectId })
    },
    onSuccess: () => {
      toast.success('Project groups updated')
      qc.invalidateQueries({ queryKey: ['dashboard-projects'] })
      qc.invalidateQueries({ queryKey: ['projects-nav'] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: ['project-modal-summary', projectId] })
      qc.invalidateQueries({ queryKey: ['project-groups'] })
      if (onSaved) onSaved()
      onOpenChange(false)
    },
    onError: (error) => {
      console.error('Failed to update project groups', error)
      toast.error('Unable to update groups right now.')
    },
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    assignMutation.mutate(selection)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage groups</DialogTitle>
          <DialogDescription>Assign this project to the right group so teams know where it belongs.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded border border-border px-3 py-2 text-sm">
              <input
                type="radio"
                name="project-group"
                value="__none__"
                checked={!selection}
                onChange={() => setSelection(null)}
              />
              <span>No group</span>
            </label>
            {groupsQuery.data?.map((group) => (
              <label
                key={group.id}
                className="flex cursor-pointer items-center justify-between rounded border border-border px-3 py-2 text-sm transition hover:border-primary"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="project-group"
                    value={group.id}
                    checked={selection === group.id}
                    onChange={() => setSelection(group.id)}
                  />
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: group.color || 'var(--primary)' }}
                    />
                    {group.name}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">Order {group.sort_order + 1}</span>
              </label>
            ))}
            {groupsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading groups…</div>}
            {groupsQuery.isError && <div className="text-sm text-destructive">Unable to load groups.</div>}
            {groupsQuery.data && groupsQuery.data.length === 0 && !groupsQuery.isLoading && (
              <div className="rounded border border-dashed px-3 py-2 text-sm text-muted-foreground">
                No groups yet. Create one from the dashboard groups view.
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={assignMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={assignMutation.isPending}>
              {assignMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

