import { z } from 'zod'

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  status: z.string(),
  color: z.string().nullable().optional(),
  is_starred: z.boolean().optional().default(false),
  is_archived: z.boolean().optional().default(false),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Project = z.infer<typeof ProjectSchema>

export const ProjectCardLanguageStatSchema = z.object({
  language: z.string(),
  count: z.number(),
})
export type ProjectCardLanguageStat = z.infer<typeof ProjectCardLanguageStatSchema>

export const ProjectCardTagSchema = z.object({
  label: z.string(),
  slug: z.string(),
  color: z.string().nullable().optional(),
  usage_count: z.number().nullable().optional(),
})
export type ProjectCardTag = z.infer<typeof ProjectCardTagSchema>

export const ProjectCardOwnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar_url: z.string().nullable().optional(),
})
export type ProjectCardOwner = z.infer<typeof ProjectCardOwnerSchema>

export const ProjectCardHighlightSchema = z.object({
  title: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
})
export type ProjectCardHighlight = z.infer<typeof ProjectCardHighlightSchema>

export const ProjectCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  status: z.string(),
  color: z.string().nullable().optional(),
  tags: z.array(z.string()),
  tag_details: z.array(ProjectCardTagSchema).default([]),
  is_starred: z.boolean().default(false),
  is_archived: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
  file_count: z.number().default(0),
  language_mix: z.array(ProjectCardLanguageStatSchema).default([]),
  owners: z.array(ProjectCardOwnerSchema).default([]),
  highlight: ProjectCardHighlightSchema.nullable(),
  activity_sparkline: z.array(z.number()).default([]),
})
export type ProjectCard = z.infer<typeof ProjectCardSchema>

export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectCardSchema),
  next_cursor: z.string().nullable().optional(),
  total: z.number(),
  limit: z.number(),
  view: z.string(),
  filters: z.record(z.any()),
})
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>

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

// Git Repos (Phase 2)
export const RepoSchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: z.string(),
  project_id: z.string().nullable().optional(),
  provider: z.string(),
  repo_url: z.string().nullable().optional(),
  default_branch: z.string(),
  visibility: z.string(),
  last_synced_at: z.string().nullable().optional(),
})
export type RepoItem = z.infer<typeof RepoSchema>

export const RepoStatusSchema = z.object({
  branch: z.string().nullable(),
  ahead: z.number(),
  behind: z.number(),
  dirty: z.boolean(),
})
export type RepoStatus = z.infer<typeof RepoStatusSchema>

// Phase 5 — Groups
export const ProjectGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable().optional(),
  sort_order: z.number(),
})
export type ProjectGroup = z.infer<typeof ProjectGroupSchema>

export const ProjectGroupWithProjectsSchema = ProjectGroupSchema.extend({
  projects: z.array(ProjectSchema),
})
export type ProjectGroupWithProjects = z.infer<typeof ProjectGroupWithProjectsSchema>
