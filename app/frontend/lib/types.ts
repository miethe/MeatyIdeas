import { z } from 'zod'

export const ProjectGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable().optional(),
  sort_order: z.number(),
})
export type ProjectGroup = z.infer<typeof ProjectGroupSchema>

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
  groups: z.array(ProjectGroupSchema).default([]),
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

export const FileTagSchema = z.object({
  label: z.string(),
  slug: z.string(),
  color: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
})
export type FileTag = z.infer<typeof FileTagSchema>

export const FileLinkSchema = z.object({
  url: z.string(),
  label: z.string(),
})
export type FileLink = z.infer<typeof FileLinkSchema>

export const MetadataFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  kind: z.string().nullable().optional(),
})
export type MetadataField = z.infer<typeof MetadataFieldSchema>

export const DirectoryListItemSchema = z.object({
  path: z.string(),
  name: z.string(),
  depth: z.number(),
  updated_at: z.string().nullable().optional(),
  source: z.string().default('derived'),
})
export type DirectoryListItem = z.infer<typeof DirectoryListItemSchema>

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
  groups: z.array(ProjectGroupSchema).default([]),
})
export type ProjectCard = z.infer<typeof ProjectCardSchema>

export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectCardSchema),
  next_cursor: z.string().nullable().optional(),
  total: z.number(),
  limit: z.number(),
  view: z.string(),
  filters: z.record(z.string(), z.unknown()).catch({}).default({}),
})
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>

export const ProjectModalQuickStatSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  subvalue: z.string().nullable().optional(),
  timestamp: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})
export type ProjectModalQuickStat = z.infer<typeof ProjectModalQuickStatSchema>

export const ProjectModalSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  status: z.string(),
  updated_at: z.string().nullable().optional(),
  is_starred: z.boolean().default(false),
  tags: z.array(ProjectCardTagSchema).default([]),
  owners: z.array(ProjectCardOwnerSchema).default([]),
  file_count: z.number().default(0),
  directory_count: z.number().default(0),
  language_mix: z.array(ProjectCardLanguageStatSchema).default([]),
  readme_path: z.string().nullable().optional(),
  highlight: ProjectCardHighlightSchema.nullable().optional(),
  quick_stats: z.array(ProjectModalQuickStatSchema).default([]),
  groups: z.array(ProjectGroupSchema).default([]),
})
export type ProjectModalSummary = z.infer<typeof ProjectModalSummarySchema>

export const ProjectTreeNodeSchema = z.object({
  type: z.enum(['dir', 'file']),
  name: z.string(),
  path: z.string(),
  depth: z.number().default(0),
  parent_path: z.string().nullable().optional(),
  file_id: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  size: z.number().nullable().optional(),
  has_children: z.boolean().nullable().optional(),
  children_count: z.number().nullable().optional(),
  preview_eligible: z.boolean().nullable().optional(),
  badges: z.array(z.string()).default([]),
  language: z.string().nullable().optional(),
  extension: z.string().nullable().optional(),
  icon_hint: z.string().nullable().optional(),
  tags: z.array(FileTagSchema).default([]),
})
export type ProjectTreeNode = z.infer<typeof ProjectTreeNodeSchema>

export const ProjectTreeResponseSchema = z.object({
  items: z.array(ProjectTreeNodeSchema),
  next_cursor: z.string().nullable().optional(),
  total: z.number().default(0),
})
export type ProjectTreeResponse = z.infer<typeof ProjectTreeResponseSchema>

export const ProjectActivityEntrySchema = z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
  timestamp: z.string(),
  actor: z.string().nullable().optional(),
  context: z.record(z.string(), z.unknown()).default({}),
})
export type ProjectActivityEntry = z.infer<typeof ProjectActivityEntrySchema>

export const ProjectActivityResponseSchema = z.object({
  items: z.array(ProjectActivityEntrySchema),
  next_cursor: z.string().nullable().optional(),
  sources: z.array(z.string()).default([]),
})
export type ProjectActivityResponse = z.infer<typeof ProjectActivityResponseSchema>

export const FilePreviewSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  path: z.string(),
  title: z.string(),
  size: z.number(),
  mime_type: z.string().nullable().optional(),
  encoding: z.string().default('utf-8'),
  content: z.string().nullable().optional(),
  rendered_html: z.string().nullable().optional(),
  is_truncated: z.boolean().default(false),
  preview_type: z.string().default('text'),
  preview_url: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  updated_at: z.string(),
})
export type FilePreview = z.infer<typeof FilePreviewSchema>

export const FileSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  path: z.string(),
  title: z.string(),
  content_md: z.string(),
  rendered_html: z.string(),
  tags: z.array(z.string()),
  front_matter: z.record(z.unknown()).default({}),
  description: z.string().nullable().optional(),
  links: z.array(FileLinkSchema).default([]),
  icon_hint: z.string().nullable().optional(),
  tag_details: z.array(FileTagSchema).default([]),
  summary: z.string().nullable().optional(),
  updated_at: z.string(),
  metadata_fields: z.array(MetadataFieldSchema).default([]),
  metadata_signature: z.string().nullable().optional(),
})
export type FileItem = z.infer<typeof FileSchema>

export const SearchResultSchema = z.object({
  type: z.enum(['project', 'file']),
  id: z.string(),
  name: z.string(),
  path: z.string().nullable().optional(),
  project: z
    .object({
      id: z.string().nullable().optional(),
      slug: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  tags: z.array(z.string()).default([]),
  language: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  score: z.number().optional(),
})
export type SearchResult = z.infer<typeof SearchResultSchema>

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  next_cursor: z.string().nullable().optional(),
  facets: z
    .object({
      tags: z
        .array(
          z.object({
            label: z.string(),
            slug: z.string(),
            color: z.string().nullable().optional(),
            count: z.number().optional(),
          })
        )
        .optional(),
      languages: z
        .array(
          z.object({
            label: z.string(),
            slug: z.string(),
            count: z.number().optional(),
          })
        )
        .optional(),
    })
    .partial()
    .optional(),
})
export type SearchResponse = z.infer<typeof SearchResponseSchema>

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

export const ProjectGroupWithProjectsSchema = ProjectGroupSchema.extend({
  projects: z.array(ProjectSchema),
})
export type ProjectGroupWithProjects = z.infer<typeof ProjectGroupWithProjectsSchema>
