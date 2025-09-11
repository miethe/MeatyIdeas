"use client"
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { apiGet, apiJson } from '@/lib/apiClient'
import { FileItem, FileSchema } from '@/lib/types'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

type Props = {
  projectId: string
  fileId: string
}

const templates: Record<string, string> = {
  PRD: `# Title\n\n## Goals\n- \n\n## Non-Goals\n- \n\n## Success Metrics\n- \n\n## Scope\n- \n`,
  Checklist: `# Checklist\n\n- [ ] Task 1\n- [ ] Task 2\n`,
  Mermaid: '```mermaid\nsequenceDiagram\nA->>B: Hello\n```\n',
  KaTeX: 'Inline math: $a^2 + b^2 = c^2$\n',
}

export function RichEditor({ projectId, fileId }: Props) {
  const [file, setFile] = useState<FileItem | null>(null)
  const [title, setTitle] = useState('')
  const [path, setPath] = useState('')
  const [content, setContent] = useState('')
  const [html, setHtml] = useState('')
  const [backlinks, setBacklinks] = useState<FileItem[]>([])
  const [rewrite, setRewrite] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lastSaved, setLastSaved] = useState<{ title: string; path: string; content: string } | null>(null)

  useEffect(() => {
    async function load() {
      const f = await apiGet<any>(`/files/${fileId}`)
      const fi = FileSchema.parse(f)
      setFile(fi)
      setTitle(fi.title)
      setPath(fi.path)
      setContent(fi.content_md)
      setLastSaved({ title: fi.title, path: fi.path, content: fi.content_md })
      try {
        const r = await apiJson<any>('POST', '/render/markdown', { md: fi.content_md })
        setHtml(r.html)
      } catch {}
      try {
        const bl = await apiGet<any[]>(`/files/${fi.id}/backlinks`)
        setBacklinks(bl.map((b) => FileSchema.parse(b)))
      } catch {}
    }
    load()
  }, [fileId])

  // Debounced preview
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await apiJson<any>('POST', '/render/markdown', { md: content })
        setHtml(r.html)
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [content])

  const dirty = useMemo(() => {
    if (!lastSaved) return false
    return lastSaved.title !== title || lastSaved.path !== path || lastSaved.content !== content
  }, [lastSaved, title, path, content])

  // Shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey
      if (isMeta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!file) return
        apiJson('PUT', `/files/${file.id}`, {
          title,
          path,
          content_md: content,
          front_matter: {},
          tags: file.tags || [],
          rewrite_links: rewrite,
        }).then(() => {
          toast.success('Saved')
          setLastSaved({ title, path, content })
        })
      }
      if (isMeta && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        window.dispatchEvent(new Event('open-new-file'))
      }
      if (isMeta && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        window.dispatchEvent(new Event('open-command-palette'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [file, title, path, content, rewrite])

  function insertAtCursor(snippet: string) {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const before = content.slice(0, start)
    const after = content.slice(end)
    const next = before + snippet + after
    setContent(next)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + snippet.length
      el.focus()
    })
  }

  function wrapSelection(prefix: string, suffix?: string) {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const sel = content.slice(start, end)
    const sfx = suffix ?? prefix
    const next = content.slice(0, start) + prefix + sel + sfx + content.slice(end)
    setContent(next)
    requestAnimationFrame(() => {
      el.selectionStart = start + prefix.length
      el.selectionEnd = start + prefix.length + sel.length
      el.focus()
    })
  }

  function prefixLines(prefix: string) {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const before = content.slice(0, start)
    const sel = content.slice(start, end)
    const after = content.slice(end)
    const toPrefix = sel || content
    const lines = (sel ? toPrefix : content).split('\n')
    const selected = lines.map((l, i) => (l.length ? `${prefix}${l}` : `${prefix}`)).join('\n')
    const next = sel ? before + selected + after : selected
    setContent(next)
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file0 = e.target.files?.[0]
    if (!file0 || !file) return
    const fd = new FormData()
    fd.append('file', file0)
    try {
      const res = await fetch(`${location.origin}/api/projects/${projectId}/attachments/upload`, {
        method: 'POST',
        headers: { 'X-Token': process.env.NEXT_PUBLIC_TOKEN || 'devtoken' },
        body: fd,
      })
      if (!res.ok) throw new Error('upload failed')
      const data = await res.json()
      const mdPath = data.path.startsWith('/') ? data.path : `/${data.path}`
      insertAtCursor(`![asset](${mdPath})`)
      toast.success('Attachment uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      e.target.value = ''
    }
  }

  const [allFiles, setAllFiles] = useState<FileItem[]>([])
  useEffect(() => {
    async function load() {
      try {
        const projFiles = await apiGet<any[]>(`/projects/${projectId}/files`)
        setAllFiles(projFiles.map((r) => FileSchema.parse(r)))
      } catch {}
    }
    load()
  }, [projectId])

  function addWikiLink() {
    const title = prompt('Link title (matches file title):', allFiles[0]?.title || '')
    if (!title) return
    insertAtCursor(`[[${title}]]`)
  }

  function insertTemplate(name: string) {
    insertAtCursor(templates[name] || '')
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Left panel: Editor */}
      <section className="min-w-0 rounded border p-3">
        <div className="flex flex-col gap-2">
          {/* Toolbar 1: File / Insert */}
          <div className="flex flex-wrap items-center gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="focus-ring w-48 min-w-[9rem] rounded border bg-background px-2 py-1" />
            <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="path/notes.md" className="focus-ring w-64 min-w-[12rem] rounded border bg-background px-2 py-1" />
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              <Button variant="outline" onClick={() => insertTemplate('PRD')}>Template: PRD</Button>
              <Button variant="outline" onClick={() => insertTemplate('Mermaid')}>Mermaid</Button>
              <Button variant="outline" onClick={() => insertTemplate('KaTeX')}>KaTeX</Button>
              <Button variant="outline" onClick={addWikiLink}>Link</Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Upload</Button>
              <label className="ml-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={rewrite} onChange={(e) => setRewrite(e.target.checked)} /> Rewrite links</label>
            </div>
            {/* Compact actions for small screens */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Insert</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Insert</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => insertTemplate('PRD')}>Template: PRD</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => insertTemplate('Mermaid')}>Mermaid block</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => insertTemplate('KaTeX')}>KaTeX inline</DropdownMenuItem>
                  <DropdownMenuItem onSelect={addWikiLink}>Wiki link</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>Upload attachment</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setRewrite((v) => !v)}>{rewrite ? 'Disable' : 'Enable'} rewrite links</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" onChange={onUpload} />
          </div>

          {/* Toolbar 2: Formatting */}
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Formatting</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Inline</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => wrapSelection('**')}>Bold</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => wrapSelection('*')}>Italic</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => wrapSelection('~~')}>Strikethrough</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => wrapSelection('`')}>Inline code</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Blocks</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => insertAtCursor('\n\n```\n\n```\n')}>Code block</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => prefixLines('# ')}>H1</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => prefixLines('## ')}>H2</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => prefixLines('### ')}>H3</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => prefixLines('> ')}>Quote</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => prefixLines('- ')}>Bulleted list</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => prefixLines('1. ')}>Numbered list</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => insertAtCursor('\n\n---\n\n')}>Horizontal rule</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Editor area */}
          <div className="grid grid-rows-[auto_auto_1fr_auto] gap-2">
            <textarea
              ref={inputRef}
              className="focus-ring w-full resize-y rounded border bg-background p-3 font-mono text-sm"
              style={{ minHeight: content.trim().length === 0 ? '12rem' : '18rem' }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Start writing..."
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={async () => {
                  if (!file) return
                  try {
                    await apiJson('PUT', `/files/${file.id}`, {
                      title,
                      path,
                      content_md: content,
                      front_matter: {},
                      tags: file.tags || [],
                      rewrite_links: rewrite,
                    })
                    toast.success('Saved')
                    setLastSaved({ title, path, content })
                  } catch {
                    toast.error('Save failed')
                  }
                }}
                disabled={!dirty}
              >
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!lastSaved) return
                  setTitle(lastSaved.title)
                  setPath(lastSaved.path)
                  setContent(lastSaved.content)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Right panel: Preview */}
      <section className="min-w-0 rounded border p-3">
        <div className="mb-2 text-sm text-muted-foreground">Preview</div>
        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
        {file && (
          <div className="mt-6 border-t pt-3">
            <div className="mb-1 text-sm font-semibold">Backlinks</div>
            {backlinks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No backlinks yet.</div>
            ) : (
              <ul className="text-sm">
                {backlinks.map((b) => (
                  <li key={b.id}>
                    <a className="hover:underline" href={`#`} onClick={(e) => { e.preventDefault(); alert(`Open ${b.title}`) }}>{b.title}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
