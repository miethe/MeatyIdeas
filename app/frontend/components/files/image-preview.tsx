"use client"
import * as React from 'react'

import { Skeleton } from '@/components/skeleton'
import { getApiBase, getToken } from '@/lib/apiClient'
import { cn } from '@/lib/utils'

const REMOTE_PROTOCOL_RE = /^(https?:|data:|blob:)/i

type ImagePreviewProps = {
  src: string
  alt?: string
  className?: string
  imageClassName?: string
  objectFit?: 'contain' | 'cover'
}

export function ImagePreview({ src, alt, className, imageClassName, objectFit = 'contain' }: ImagePreviewProps) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const [lightboxOpen, setLightboxOpen] = React.useState(false)

  React.useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(false)

      if (!src) {
        setError(true)
        setLoading(false)
        return
      }

      if (REMOTE_PROTOCOL_RE.test(src)) {
        if (active) {
          setImageUrl(src)
          setLoading(false)
        }
        return
      }

      const base = getApiBase()
      const resolved = src.startsWith('/') ? `${base}${src}` : src

      try {
        const res = await fetch(resolved, {
          headers: { 'X-Token': getToken() },
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        if (active) setImageUrl(objectUrl)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(true)
        }
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        objectUrl = null
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  const handleClose = () => {
    setLightboxOpen(false)
  }

  if (loading) {
    return (
      <div className={cn('flex flex-1 items-center justify-center', className)}>
        <Skeleton className="h-72 w-72" />
      </div>
    )
  }

  if (error || !imageUrl) {
    return (
      <div className={cn('flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground', className)}>
        Unable to load image preview.
      </div>
    )
  }

  return (
    <div className={cn('relative flex flex-1 items-center justify-center overflow-auto bg-muted/10 p-6', className)}>
      <img
        src={imageUrl}
        alt={alt || ''}
        className={cn('max-h-[70vh] max-w-full rounded-md shadow transition-transform duration-200', imageClassName)}
        style={{ cursor: 'zoom-in', objectFit }}
        onClick={(event) => {
          event.stopPropagation()
          setLightboxOpen(true)
        }}
      />
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={handleClose}
        >
          <img
            src={imageUrl}
            alt={alt || ''}
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            style={{ objectFit }}
          />
        </div>
      )}
    </div>
  )
}

