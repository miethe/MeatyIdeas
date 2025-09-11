"use client"
import React, { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { getApiBase, getToken } from '@/lib/apiClient'

type Props = { projectId: string }

export function ProjectEvents({ projectId }: Props) {
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!projectId) return

    const connect = () => {
      const url = `${getApiBase()}/events/stream?project_id=${encodeURIComponent(projectId)}&token=${encodeURIComponent(getToken())}`
      const es = new EventSource(url, { withCredentials: false })
      esRef.current = es

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          const type = data.type as string
          if (type === 'bundle.started') {
            toast.info('Bundle started')
          } else if (type === 'bundle.completed') {
            toast.success('Bundle completed')
          } else if (type === 'commit.started') {
            toast.info('Commit started')
          } else if (type === 'commit.completed') {
            toast.success('Commit completed')
          } else if (type === 'commit.failed') {
            toast.error(`Commit failed: ${data.payload?.code || 'error'}`)
          }
        } catch {
          // ignore malformed
        }
      }

      es.onerror = () => {
        // quietly retry by recreating after delay
        es.close()
        setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }, [projectId])

  return null
}
