import { FileItem, FileSchema, MetadataField } from '@/lib/types'

export type NormalizedFile = FileItem & {
  metadataByKey: Record<string, MetadataField>
}

export function normalizeFile(raw: unknown): NormalizedFile {
  const parsed = FileSchema.parse(raw)
  const metadataByKey = parsed.metadata_fields.reduce<Record<string, MetadataField>>((acc, field) => {
    acc[field.key] = field
    return acc
  }, {})
  return { ...parsed, metadataByKey }
}

export function normalizeFiles(rawFiles: unknown[]): NormalizedFile[] {
  return rawFiles.map((raw) => normalizeFile(raw))
}
