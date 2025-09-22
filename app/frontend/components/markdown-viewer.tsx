"use client"
import React, { useRef, useEffect, useState } from 'react'

import { getApiBase, getToken } from '@/lib/apiClient'

type MarkdownViewerProps = {
  html: string
  md?: string
  projectId?: string
  filePath?: string
}

const IMAGE_PROTOCOL_RE = /^(https?:|data:|blob:)/i

export function MarkdownViewer({ html, md, projectId, filePath }: MarkdownViewerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const cacheRef = useRef<Map<string, string>>(new Map())
  const [lightboxSrc, setLightboxSrc] = useState<{ src: string; alt: string }>({ src: '', alt: '' })
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    return () => {
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url))
      cacheRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!ref.current) return
    // Syntax highlighting via Prism CSS theme if available
    // Mermaid blocks: look for <code class="language-mermaid">...</code>
    const codes = ref.current.querySelectorAll('code.language-mermaid')
    if (codes.length > 0) {
      try {
        import('mermaid').then((m) => {
          m.default.initialize({ startOnLoad: false, theme: 'dark' })
          codes.forEach((code) => {
            const pre = code.closest('pre')
            if (!pre) return
            const graph = code.textContent || ''
            const id = `mmd-${Math.random().toString(36).slice(2)}`
            const container = document.createElement('div')
            container.id = id
            pre.replaceWith(container)
            m.default
              .render(id, graph)
              .then(({ svg }) => {
                container.innerHTML = svg
              })
              .catch(() => {
                // fallback: leave code block as-is
                container.replaceWith(pre)
              })
          })
        })
      } catch {
        // ignore
      }
    }
  }, [html, md])

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const abortControllers: AbortController[] = []
    const detachHandlers: Array<() => void> = []

    const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'))

    images.forEach((img) => {
      img.setAttribute('loading', 'lazy')
      img.setAttribute('decoding', 'async')
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
      img.style.cursor = 'zoom-in'

      const handleClick = (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        const src = (img.dataset.assetSrc && cacheRef.current.get(img.dataset.assetSrc)) || img.currentSrc || img.src
        if (src) {
          setLightboxSrc({ src, alt: img.alt || '' })
          setLightboxOpen(true)
        }
      }
      img.addEventListener('click', handleClick)
      detachHandlers.push(() => img.removeEventListener('click', handleClick))

      const rawSrc = img.getAttribute('data-src') || img.getAttribute('src') || ''
      if (!rawSrc || rawSrc.startsWith('//') || IMAGE_PROTOCOL_RE.test(rawSrc) || !projectId) {
        return
      }

      const resolved = resolveAssetPath(filePath, rawSrc)
      if (!resolved) return

      if (cacheRef.current.has(resolved)) {
        img.src = cacheRef.current.get(resolved) as string
        img.dataset.assetSrc = resolved
        return
      }

      const controller = new AbortController()
      abortControllers.push(controller)
      fetchAssetBlob(projectId, resolved, controller.signal)
        .then((url) => {
          if (!url) return
          cacheRef.current.set(resolved, url)
          if (!controller.signal.aborted) {
            img.src = url
            img.dataset.assetSrc = resolved
          } else {
            URL.revokeObjectURL(url)
          }
        })
        .catch(() => {})
    })

    return () => {
      abortControllers.forEach((controller) => controller.abort())
      detachHandlers.forEach((fn) => fn())
    }
  }, [filePath, html, md, projectId])

  return (
    <>
      <div ref={ref} className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
      {lightboxOpen && lightboxSrc.src && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={lightboxSrc.src}
            alt={lightboxSrc.alt}
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

function resolveAssetPath(filePath: string | undefined, asset: string): string {
  const cleanAsset = asset.trim()
  if (!cleanAsset) return ''
  if (cleanAsset.startsWith('/')) {
    return cleanAsset.replace(/^\/+/, '')
  }
  if (!filePath) return cleanAsset
  const baseParts = filePath.split('/').slice(0, -1)
  const assetParts = cleanAsset.split('/')
  const stack: string[] = [...baseParts]
  for (const part of assetParts) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (stack.length > 0) stack.pop()
      continue
    }
    stack.push(part)
  }
  return stack.join('/')
}

async function fetchAssetBlob(projectId: string, path: string, signal: AbortSignal): Promise<string | null> {
  try {
    const base = getApiBase()
    const res = await fetch(`${base}/projects/${projectId}/files/raw?path=${encodeURIComponent(path)}`, {
      headers: { 'X-Token': getToken() },
      signal,
    })
    if (!res.ok) return null
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null
    return null
  }
}
