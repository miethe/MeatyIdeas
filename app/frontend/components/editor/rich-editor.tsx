"use client"
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Bold, Code, Code2, Heading1, Heading2, Heading3, Image as ImageIcon, Italic, Link as LinkIcon, List, ListChecks, ListOrdered, Minus, Quote, Strikethrough, Table as TableIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { apiGet, apiJson } from '@/lib/apiClient'
import { FileItem } from '@/lib/types'
import { normalizeFile } from '@/lib/files/normalizeFile'

type Props = {
  projectId: string
  fileId: string
}

const templates: Record<string, string> = {
  PRD: `# Title\n\n## Goals\n- \n\n## Non-Goals\n- \n\n## Success Metrics\n- \n\n## Scope\n- \n`,
  Checklist: `# Checklist\n\n- [ ] Task 1\n- [ ] Task 2\n`,
  Mermaid: '```mermaid\nsequenceDiagram\nA->>B: Hello\n```\n',
  KaTeX: 'Inline math: $a^2 + b^2 = c^2$\n',
  Table: `| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Row 1 | Value | Value |\n`,
}

type ToolbarButtonProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  shortcut?: string
  disabled?: boolean
}

function ToolbarButton({ icon: Icon, label, onClick, shortcut, disabled }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClick}
          aria-label={label}
          disabled={disabled}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {shortcut ? <span className="text-muted-foreground">{shortcut}</span> : null}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export function RichEditor({ projectId, fileId }: Props) {
  const [file, setFile] = useState<FileItem | null>(null)
  const [title, setTitle] = useState('')
  const [path, setPath] = useState('')
  const [content, setContent] = useState('')
  const [html, setHtml] = useState('')
  const [backlinks, setBacklinks] = useState<FileItem[]>([])
  const [outLinks, setOutLinks] = useState<{ target_title: string; target_file_id?: string | null; resolved: boolean }[]>([])
  const [rewrite, setRewrite] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lastSaved, setLastSaved] = useState<{ title: string; path: string; content: string } | null>(null)
  const metaKeyLabel = useMemo(() => {
    if (typeof window === 'undefined') return 'Ctrl+'
    return /Mac|iPhone|iPad|iPod/.test(window.navigator.platform) ? '⌘' : 'Ctrl+'
  }, [])

  useEffect(() => {
    async function load() {
      const f = await apiGet<any>(`/files/${fileId}`)
      const fi = normalizeFile(f)
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
        setBacklinks(bl.map((b) => normalizeFile(b)))
      } catch {}
      try {
        const ol = await apiGet<any[]>(`/files/${fi.id}/links`)
        setOutLinks(ol as any)
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
          // refresh links/backlinks
          apiGet<any[]>(`/files/${file.id}/backlinks`).then((bl) => setBacklinks(bl.map((b) => normalizeFile(b)))).catch(() => {})
          apiGet<any[]>(`/files/${file.id}/links`).then((ol) => setOutLinks(ol as any)).catch(() => {})
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

  function insertAtCursor(snippet: string, cursorOffset?: number) {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const before = content.slice(0, start)
    const after = content.slice(end)
    const next = before + snippet + after
    setContent(next)
    requestAnimationFrame(() => {
      const offset = typeof cursorOffset === 'number' ? cursorOffset : snippet.length
      const cursor = start + offset
      el.selectionStart = el.selectionEnd = cursor
      el.focus()
    })
  }

  function wrapSelection(prefix: string, suffix?: string) {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const sfx = suffix ?? prefix
    const value = content
    const selected = value.slice(start, end)

    const hasWrap =
      start >= prefix.length &&
      end + sfx.length <= value.length &&
      value.slice(start - prefix.length, start) === prefix &&
      value.slice(end, end + sfx.length) === sfx

    if (hasWrap) {
      const nextValue = value.slice(0, start - prefix.length) + selected + value.slice(end + sfx.length)
      setContent(nextValue)
      requestAnimationFrame(() => {
        const cursorStart = start - prefix.length
        const cursorEnd = cursorStart + selected.length
        el.selectionStart = cursorStart
        el.selectionEnd = cursorEnd
        el.focus()
      })
      return
    }

    const nextValue = value.slice(0, start) + prefix + selected + sfx + value.slice(end)
    setContent(nextValue)
    requestAnimationFrame(() => {
      const cursorStart = start + prefix.length
      const cursorEnd = cursorStart + selected.length
      el.selectionStart = cursorStart
      el.selectionEnd = cursorEnd
      el.focus()
    })
  }

  function toggleLinePrefix(prefix: string) {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const value = content
    const selectionEmpty = start === end

    const blockStart = selectionEmpty ? value.lastIndexOf('\n', start - 1) + 1 : start
    const blockEndIndex = selectionEmpty ? value.indexOf('\n', end) : end
    const blockEnd = blockEndIndex === -1 || blockEndIndex === undefined ? value.length : blockEndIndex
    const target = value.slice(blockStart, blockEnd)

    const lines = target.split('\n')
    const updated = lines
      .map((line) => {
        const leading = line.match(/^\s*/)?.[0] ?? ''
        const trimmed = line.slice(leading.length)
        if (!trimmed.length) {
          return leading + prefix
        }
        if (trimmed.startsWith(prefix)) {
          return leading + trimmed.slice(prefix.length)
        }
        return leading + prefix + trimmed
      })
      .join('\n')

    const nextValue = value.slice(0, blockStart) + updated + value.slice(blockEnd)
    setContent(nextValue)
    requestAnimationFrame(() => {
      const delta = updated.length - target.length
      el.selectionStart = blockStart
      el.selectionEnd = blockEnd + delta
      el.focus()
    })
  }

  function setHeading(level: 1 | 2 | 3) {
    const el = inputRef.current
    if (!el) return
    const value = content
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const selectionEmpty = start === end
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const lineEndIndex = value.indexOf('\n', end)
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
    const line = value.slice(lineStart, lineEnd)
    const cleaned = line.replace(/^#{1,6}\s*/, '')
    const prefix = `${'#'.repeat(level)} `
    const alreadyHeading = line.startsWith(prefix)
    const nextLine = alreadyHeading ? cleaned : cleaned.length ? `${prefix}${cleaned}` : prefix
    const nextValue = value.slice(0, lineStart) + nextLine + value.slice(lineEnd)
    setContent(nextValue)
    requestAnimationFrame(() => {
      const headingLength = nextLine.match(/^#{1,6}\s*/)?.[0]?.length ?? 0
      const textStart = lineStart + headingLength
      const textEnd = textStart + cleaned.length
      if (selectionEmpty) {
        el.selectionStart = textEnd
        el.selectionEnd = textEnd
      } else {
        el.selectionStart = textStart
        el.selectionEnd = textEnd
      }
      el.focus()
    })
  }

  function toggleList(mode: 'bullet' | 'ordered' | 'task') {
    const el = inputRef.current
    if (!el) return
    const value = content
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const selectionEmpty = start === end

    const blockStart = selectionEmpty ? value.lastIndexOf('\n', start - 1) + 1 : start
    const blockEndIndex = selectionEmpty ? value.indexOf('\n', end) : end
    const blockEnd = blockEndIndex === -1 || blockEndIndex === undefined ? value.length : blockEndIndex
    const target = value.slice(blockStart, blockEnd)
    const lines = target.split('\n')

    const updated = lines
      .map((line) => {
        if (!line.trim().length) return line
        const leading = line.match(/^\s*/)?.[0] ?? ''
        const trimmed = line.slice(leading.length)
        if (mode === 'bullet') {
          if (/^[-*+]\s+/.test(trimmed)) {
            return leading + trimmed.replace(/^[-*+]\s+/, '')
          }
          return leading + `- ${trimmed}`
        }
        if (mode === 'ordered') {
          if (/^\d+\.\s+/.test(trimmed)) {
            return leading + trimmed.replace(/^\d+\.\s+/, '')
          }
          return leading + `1. ${trimmed}`
        }
        // task list
        if (/^[-*+]\s+\[[ xX]\]\s+/.test(trimmed)) {
          return leading + trimmed.replace(/^[-*+]\s+\[[ xX]\]\s+/, '')
        }
        return leading + `- [ ] ${trimmed}`
      })
      .join('\n')

    const nextValue = value.slice(0, blockStart) + updated + value.slice(blockEnd)
    setContent(nextValue)
    requestAnimationFrame(() => {
      const delta = updated.length - target.length
      el.selectionStart = blockStart
      el.selectionEnd = blockEnd + delta
      el.focus()
    })
  }

  function insertLink() {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const value = content
    const selected = value.slice(start, end)
    const label = selected || 'link text'
    const url = prompt('Link URL:', 'https://')
    if (!url) return
    const replacement = `[${label}](${url})`
    const nextValue = value.slice(0, start) + replacement + value.slice(end)
    setContent(nextValue)
    requestAnimationFrame(() => {
      if (selected) {
        const urlStart = start + label.length + 3
        const urlEnd = urlStart + url.length
        el.selectionStart = urlStart
        el.selectionEnd = urlEnd
      } else {
        const labelStart = start + 1
        const labelEnd = labelStart + label.length
        el.selectionStart = labelStart
        el.selectionEnd = labelEnd
      }
      el.focus()
    })
  }

  function insertImage() {
    const alt = prompt('Image alt text:', '')
    if (alt === null) return
    const url = prompt('Image URL:', 'https://')
    if (!url) return
    insertAtCursor(`![${alt || 'image'}](${url})`)
  }

  function insertCodeBlock() {
    insertAtCursor('\n\n```\n\n```\n', 6)
  }

  function insertHorizontalRule() {
    insertAtCursor('\n\n---\n\n')
  }

  function insertTableSnippet() {
    insertAtCursor('\n\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Row 1 | Value | Value |\n')
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
        setAllFiles(projFiles.map((r) => normalizeFile(r)))
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
          <TooltipProvider delayDuration={120}>
            <div className="overflow-x-auto">
              <div className="flex w-max flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 shadow-sm">
                <div className="flex items-center gap-1">
                  <ToolbarButton icon={Bold} label="Bold" onClick={() => wrapSelection('**')} shortcut={`${metaKeyLabel}B`} />
                  <ToolbarButton icon={Italic} label="Italic" onClick={() => wrapSelection('*')} shortcut={`${metaKeyLabel}I`} />
                  <ToolbarButton icon={Strikethrough} label="Strikethrough" onClick={() => wrapSelection('~~')} />
                  <ToolbarButton icon={Code} label="Inline code" onClick={() => wrapSelection('`')} />
                </div>
                <Separator orientation="vertical" className="hidden h-6 sm:block" />
                <div className="flex items-center gap-1">
                  <ToolbarButton icon={Heading1} label="Heading 1" onClick={() => setHeading(1)} />
                  <ToolbarButton icon={Heading2} label="Heading 2" onClick={() => setHeading(2)} />
                  <ToolbarButton icon={Heading3} label="Heading 3" onClick={() => setHeading(3)} />
                </div>
                <Separator orientation="vertical" className="hidden h-6 sm:block" />
                <div className="flex items-center gap-1">
                  <ToolbarButton icon={Quote} label="Quote" onClick={() => toggleLinePrefix('> ')} />
                  <ToolbarButton icon={List} label="Bulleted list" onClick={() => toggleList('bullet')} />
                  <ToolbarButton icon={ListOrdered} label="Numbered list" onClick={() => toggleList('ordered')} />
                  <ToolbarButton icon={ListChecks} label="Task list" onClick={() => toggleList('task')} />
                </div>
                <Separator orientation="vertical" className="hidden h-6 sm:block" />
                <div className="flex items-center gap-1">
                  <ToolbarButton icon={Code2} label="Code block" onClick={insertCodeBlock} />
                  <ToolbarButton icon={Minus} label="Divider" onClick={insertHorizontalRule} />
                  <ToolbarButton icon={TableIcon} label="Table" onClick={insertTableSnippet} />
                  <ToolbarButton icon={LinkIcon} label="Link" onClick={insertLink} />
                  <ToolbarButton icon={ImageIcon} label="Image" onClick={insertImage} />
                </div>
              </div>
            </div>
          </TooltipProvider>

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
            <div className="mb-1 text-sm font-semibold">Outgoing Links</div>
            {outLinks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No links.</div>
            ) : (
              <ul className="text-sm">
                {outLinks.map((l, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <span>
                      {l.resolved ? (
                        <span className="text-emerald-400">●</span>
                      ) : (
                        <span className="text-yellow-400">●</span>
                      )}{' '}
                      {l.target_title}
                    </span>
                    {!l.resolved && (
                      <button
                        className="text-xs underline-offset-2 hover:underline"
                        onClick={async () => {
                          try {
                            await apiJson('POST', `/files/project/${projectId}`, {
                              title: l.target_title,
                              path: `${l.target_title.toLowerCase().replace(/\s+/g, '-')}.md`,
                              content_md: `# ${l.target_title}`,
                              front_matter: {},
                            })
                            toast.success('Created file for link')
                            const ol = await apiGet<any[]>(`/files/${file!.id}/links`)
                            setOutLinks(ol as any)
                          } catch {
                            toast.error('Create failed')
                          }
                        }}
                      >
                        Create
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {file && (
          <div className="mt-6 border-t pt-3">
            <div className="mb-1 text-sm font-semibold">Backlinks</div>
            {backlinks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No backlinks yet.</div>
            ) : (
              <ul className="text-sm">
                {backlinks.map((b) => (
                  <li key={b.id}>
                    <a className="hover:underline" href={`/projects/${projectId}/edit/${b.id}`}>{b.title}</a>
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
