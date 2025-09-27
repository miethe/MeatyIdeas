"use client"
import React from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import { useProjectEvents } from '@/lib/events/project-events'
import { span } from '@/lib/telemetry'

type Props = { projectId: string }

export function ProjectEvents({ projectId }: Props) {
  const qc = useQueryClient()
  const fileInvalidateRef = React.useRef<number | null>(null)
  const dirInvalidateRef = React.useRef<number | null>(null)

  const scheduleInvalidate = React.useCallback(
    (type: 'files' | 'dirs') => {
      if (!projectId) return
      const ref = type === 'files' ? fileInvalidateRef : dirInvalidateRef
      if (ref.current) return
      ref.current = window.setTimeout(() => {
        if (type === 'files') qc.invalidateQueries({ queryKey: ['files', projectId] })
        else qc.invalidateQueries({ queryKey: ['project-dirs', projectId] })
        ref.current = null
      }, 150)
    },
    [projectId, qc]
  )

  React.useEffect(() => {
    return () => {
      if (fileInvalidateRef.current) window.clearTimeout(fileInvalidateRef.current)
      if (dirInvalidateRef.current) window.clearTimeout(dirInvalidateRef.current)
    }
  }, [])

  const handleEvent = React.useCallback(
    (event: { type: string; payload?: Record<string, unknown> }) => {
      const { type, payload } = event
      if (type === 'bundle.started') {
        toast.info('Bundle started')
      } else if (type === 'bundle.completed') {
        toast.success('Bundle completed')
      } else if (type === 'bundle.branch_pushed') {
        toast.success('Bundle branch pushed')
      } else if (type === 'bundle.pr_opened') {
        toast.success('PR opened for bundle')
      } else if (type === 'commit.started') {
        toast.info('Commit started')
      } else if (type === 'commit.completed') {
        toast.success('Commit completed')
      } else if (type === 'commit.failed') {
        toast.error(`Commit failed: ${(payload?.code as string) || 'error'}`)
      }

      if (type.startsWith('file.') || type === 'files.batch_moved') {
        scheduleInvalidate('files')
        const fileId = typeof payload?.file_id === 'string' ? payload.file_id : undefined
        if (fileId) qc.invalidateQueries({ queryKey: ['file-details', fileId] })
        span('file_sync_refresh', {
          project_id: projectId,
          scope: 'files',
          reason: type,
        })
      }
      if (type.startsWith('dir.')) {
        scheduleInvalidate('dirs')
        span('file_sync_refresh', {
          project_id: projectId,
          scope: 'directories',
          reason: type,
        })
      }
    },
    [scheduleInvalidate]
  )

  useProjectEvents(projectId, handleEvent)

  return null
}
