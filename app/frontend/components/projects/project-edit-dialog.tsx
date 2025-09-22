"use client"

import React from 'react'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { apiGet, apiJson } from '@/lib/apiClient'
import { ProjectSchema } from '@/lib/types'

const STATUS_OPTIONS = [
  { value: 'idea', label: 'Idea' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'draft', label: 'Draft' },
  { value: 'live', label: 'Live' },
]

type ProjectEditDialogProps = {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  initialDescription: string
  initialStatus: string
  initialTags: string[]
  onSaved?: (project: z.infer<typeof ProjectSchema>) => void
}

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, index) => value === sortedB[index])
}

export function ProjectEditDialog({
  projectId,
  open,
  onOpenChange,
  initialName,
  initialDescription,
  initialStatus,
  initialTags,
  onSaved,
}: ProjectEditDialogProps) {
  const qc = useQueryClient()
  const [name, setName] = React.useState(initialName)
  const [description, setDescription] = React.useState(initialDescription)
  const [status, setStatus] = React.useState(initialStatus)
  const [tags, setTags] = React.useState(() => initialTags.map(normalizeTag))
  const [tagInput, setTagInput] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setName(initialName)
    setDescription(initialDescription)
    setStatus(initialStatus)
    setTags(initialTags.map(normalizeTag))
    setTagInput('')
  }, [open, initialName, initialDescription, initialStatus, initialTags])

  const tagsQuery = useQuery({
    queryKey: ['edit-tags'],
    queryFn: async () => {
      const res = await apiGet('/filters/tags?limit=200')
      if (!Array.isArray(res)) return [] as Array<{ slug: string; label: string; color?: string | null }>
      return (res as Array<any>).map((item) => ({
        slug: String(item.slug || item.name || ''),
        label: String(item.label || item.name || ''),
        color: item.color ?? null,
      }))
    },
    staleTime: 120_000,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await apiJson('PATCH', `/projects/${projectId}`, payload)
      return ProjectSchema.parse(response)
    },
    onSuccess: (project) => {
      toast.success('Project updated')
      qc.invalidateQueries({ queryKey: ['dashboard-projects'] })
      qc.invalidateQueries({ queryKey: ['projects-nav'] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: ['project-modal-summary', projectId] })
      if (onSaved) onSaved(project)
      onOpenChange(false)
    },
    onError: (error) => {
      console.error('Failed to update project', error)
      toast.error('Unable to update project. Please try again.')
    },
  })

  const normalizedInitialTags = React.useMemo(() => initialTags.map(normalizeTag), [initialTags])

  const addTag = (value: string) => {
    const next = normalizeTag(value)
    if (!next) return
    if (tags.includes(next)) return
    setTags((prev) => [...prev, next])
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((item) => item !== tag))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (mutation.isPending) return

    const payload: Record<string, unknown> = {}
    const trimmedName = name.trim()
    const trimmedDescription = description.trim()

    if (trimmedName && trimmedName !== initialName) payload.name = trimmedName
    if (trimmedDescription !== initialDescription.trim()) payload.description = trimmedDescription
    if (status !== initialStatus) payload.status = status

    const normalizedTags = tags.map(normalizeTag).filter(Boolean)
    if (!arraysEqual(normalizedTags, normalizedInitialTags)) {
      payload.tags = normalizedTags
    }

    if (Object.keys(payload).length === 0) {
      toast.info('No changes to save')
      onOpenChange(false)
      return
    }

    mutation.mutate(payload)
  }

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(tagInput)
    } else if (event.key === 'Backspace' && !tagInput && tags.length) {
      event.preventDefault()
      setTags((prev) => prev.slice(0, -1))
    }
  }

  const tagSuggestions = (tagsQuery.data || []).filter((suggestion) => !tags.includes(normalizeTag(suggestion.label)))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>Update project metadata so teammates always have fresh context.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="project-name">
              Name
            </label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="project-description">
              Description
            </label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Share current scope, goals, or notes"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="project-status">
              Status
            </label>
            <select
              id="project-status"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="project-tags">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove ${tag}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
              <Input
                id="project-tags"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag"
                className="w-32 min-w-[140px]"
              />
            </div>
            {tagSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Suggestions:</span>
                {tagSuggestions.slice(0, 6).map((suggestion) => (
                  <button
                    key={suggestion.slug}
                    type="button"
                    onClick={() => addTag(suggestion.label)}
                    className="rounded-full border border-dashed px-2 py-1 transition hover:border-primary hover:text-primary"
                    aria-label={`Add tag ${suggestion.label}`}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
