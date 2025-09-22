import * as React from 'react'
import {
  File as FileGeneric,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
  Folder,
  FolderOpen,
} from 'lucide-react'

import { cn } from '@/lib/utils'

type FileIconDescriptor = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  className?: string
}

type FileIconProps = {
  type: 'file' | 'dir'
  hint?: string | null
  extension?: string | null
  expanded?: boolean
  className?: string
}

const CODE_EXTENSIONS = new Set([
  'py',
  'ts',
  'tsx',
  'js',
  'jsx',
  'c',
  'cpp',
  'cs',
  'java',
  'kt',
  'rs',
  'go',
  'rb',
  'swift',
  'php',
  'scala',
  'sql',
  'html',
  'css',
  'scss',
  'less',
  'sh',
  'bash',
  'yaml',
  'yml',
  'toml',
  'ini',
])

const TEXT_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'rtf'])
const DATA_EXTENSIONS = new Set(['json', 'geojson', 'ndjson'])
const SHEET_EXTENSIONS = new Set(['csv', 'tsv', 'xls', 'xlsx'])
const ARCHIVE_EXTENSIONS = new Set(['zip', 'tar', 'gz', 'tgz', 'rar', '7z'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'heic', 'ico'])

const DEFAULT_DESCRIPTOR: FileIconDescriptor = {
  Icon: FileGeneric,
  className: 'text-muted-foreground',
}

const TOKEN_MAP: Record<string, FileIconDescriptor> = {
  pdf: { Icon: FileType, className: 'text-rose-500 dark:text-rose-400' },
  presentation: { Icon: FileType, className: 'text-orange-500 dark:text-orange-400' },
  powerpoint: { Icon: FileType, className: 'text-orange-500 dark:text-orange-400' },
  keynote: { Icon: FileType, className: 'text-orange-500 dark:text-orange-400' },
}

function normalizeTokens(hint?: string | null, extension?: string | null): string[] {
  const tokens: string[] = []
  if (extension) tokens.push(extension.toLowerCase())
  if (hint) {
    const normalized = hint.toLowerCase()
    tokens.push(normalized)
    const slashParts = normalized.split('/')
    if (slashParts.length === 2) {
      tokens.push(slashParts[0], slashParts[1])
    }
  }
  return tokens
}

function resolveDescriptor(type: 'file' | 'dir', tokens: string[], expanded?: boolean): FileIconDescriptor {
  if (type === 'dir') {
    return {
      Icon: expanded ? FolderOpen : Folder,
      className: expanded ? 'text-amber-500 dark:text-amber-400' : 'text-amber-500 dark:text-amber-400',
    }
  }

  const primaryToken = tokens[0]

  if (primaryToken) {
    if (TEXT_EXTENSIONS.has(primaryToken)) {
      return { Icon: FileText, className: 'text-sky-500 dark:text-sky-400' }
    }
    if (CODE_EXTENSIONS.has(primaryToken)) {
      return { Icon: FileCode, className: 'text-indigo-500 dark:text-indigo-400' }
    }
    if (DATA_EXTENSIONS.has(primaryToken)) {
      return { Icon: FileJson, className: 'text-emerald-500 dark:text-emerald-400' }
    }
    if (SHEET_EXTENSIONS.has(primaryToken)) {
      return { Icon: FileSpreadsheet, className: 'text-emerald-500 dark:text-emerald-400' }
    }
    if (ARCHIVE_EXTENSIONS.has(primaryToken)) {
      return { Icon: FileArchive, className: 'text-amber-500 dark:text-amber-400' }
    }
    if (AUDIO_EXTENSIONS.has(primaryToken)) {
      return { Icon: FileAudio, className: 'text-purple-500 dark:text-purple-400' }
    }
    if (VIDEO_EXTENSIONS.has(primaryToken)) {
      return { Icon: FileVideo, className: 'text-purple-500 dark:text-purple-400' }
    }
    if (IMAGE_EXTENSIONS.has(primaryToken)) {
      return { Icon: FileImage, className: 'text-amber-500 dark:text-amber-400' }
    }
  }

  for (const token of tokens) {
    if (!token) continue
    if (TOKEN_MAP[token]) {
      return TOKEN_MAP[token]
    }
    if (token.includes('markdown') || token.includes('text')) {
      return { Icon: FileText, className: 'text-sky-500 dark:text-sky-400' }
    }
    if (token.includes('json') || token.includes('yaml') || token.includes('yml')) {
      return { Icon: FileJson, className: 'text-emerald-500 dark:text-emerald-400' }
    }
    if (token.includes('spreadsheet') || token.includes('excel')) {
      return { Icon: FileSpreadsheet, className: 'text-emerald-500 dark:text-emerald-400' }
    }
    if (token.includes('image')) {
      return { Icon: FileImage, className: 'text-amber-500 dark:text-amber-400' }
    }
    if (token.includes('audio')) {
      return { Icon: FileAudio, className: 'text-purple-500 dark:text-purple-400' }
    }
    if (token.includes('video')) {
      return { Icon: FileVideo, className: 'text-purple-500 dark:text-purple-400' }
    }
    if (token.includes('zip') || token.includes('archive')) {
      return { Icon: FileArchive, className: 'text-amber-500 dark:text-amber-400' }
    }
    if (token.includes('code') || token.includes('script')) {
      return { Icon: FileCode, className: 'text-indigo-500 dark:text-indigo-400' }
    }
  }

  return DEFAULT_DESCRIPTOR
}

export function FileIcon({ type, hint, extension, expanded, className }: FileIconProps) {
  const tokens = React.useMemo(() => normalizeTokens(hint, extension), [hint, extension])
  const descriptor = React.useMemo(() => resolveDescriptor(type, tokens, expanded), [tokens, type, expanded])
  const { Icon, className: colorClass } = descriptor

  return <Icon aria-hidden className={cn('h-4 w-4 flex-shrink-0 transition-colors', colorClass, className)} />
}
