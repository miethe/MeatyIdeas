import { useEffect } from 'react'

import { getApiBase, getToken } from '@/lib/apiClient'

export type ProjectEventMessage = {
  type: string
  project_id: string
  payload?: Record<string, unknown>
}

type Subscriber = (event: ProjectEventMessage) => void

type SourceEntry = {
  source: EventSource | null
  subscribers: Set<Subscriber>
  retryTimer: number | null
}

const sourceRegistry = new Map<string, SourceEntry>()

function createSource(projectId: string, entry: SourceEntry) {
  if (typeof window === 'undefined') return
  const url = `${getApiBase()}/events/stream?project_id=${encodeURIComponent(projectId)}&token=${encodeURIComponent(getToken())}`
  const es = new EventSource(url, { withCredentials: false })
  entry.source = es

  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data) as ProjectEventMessage
      entry.subscribers.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error('Project event subscriber error', error)
        }
      })
    } catch (error) {
      console.warn('Failed to parse project event payload', error)
    }
  }

  es.onerror = () => {
    es.close()
    entry.source = null
    if (entry.retryTimer == null && entry.subscribers.size > 0) {
      entry.retryTimer = window.setTimeout(() => {
        entry.retryTimer = null
        createSource(projectId, entry)
      }, 1500)
    }
  }
}

export function subscribeToProjectEvents(projectId: string, subscriber: Subscriber): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  let entry = sourceRegistry.get(projectId)
  if (!entry) {
    entry = { source: null, subscribers: new Set(), retryTimer: null }
    sourceRegistry.set(projectId, entry)
  }
  entry.subscribers.add(subscriber)
  if (!entry.source) {
    createSource(projectId, entry)
  }

  return () => {
    const existing = sourceRegistry.get(projectId)
    if (!existing) return
    existing.subscribers.delete(subscriber)
    if (existing.subscribers.size === 0) {
      if (existing.source) {
        existing.source.close()
      }
      if (existing.retryTimer != null) {
        window.clearTimeout(existing.retryTimer)
      }
      sourceRegistry.delete(projectId)
    }
  }
}

export function useProjectEvents(projectId: string | null, handler: Subscriber | null) {
  useEffect(() => {
    if (!projectId || !handler) return undefined
    return subscribeToProjectEvents(projectId, handler)
  }, [projectId, handler])
}
