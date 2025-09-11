"use client"
import React, { useRef, useEffect } from 'react'

export function MarkdownViewer({ html, md }: { html: string; md?: string }) {
  const ref = useRef<HTMLDivElement>(null)

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

  return <div ref={ref} className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
