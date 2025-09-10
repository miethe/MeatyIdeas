import { z } from 'zod'

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  status: z.string(),
  color: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Project = z.infer<typeof ProjectSchema>

export const FileSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  path: z.string(),
  title: z.string(),
  content_md: z.string(),
  rendered_html: z.string(),
  tags: z.array(z.string()),
  updated_at: z.string(),
})
export type FileItem = z.infer<typeof FileSchema>

export const SearchResultSchema = z.object({
  type: z.enum(['project', 'file', 'artifact']).or(z.string()),
  id: z.string(),
  title: z.string().optional(),
  name: z.string().optional(),
  slug: z.string().optional(),
  project_id: z.string().optional(),
  path: z.string().optional(),
})
export type SearchResult = z.infer<typeof SearchResultSchema>

