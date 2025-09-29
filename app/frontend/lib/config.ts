import { apiGet } from '@/lib/apiClient'

export type StatusOption = {
  key: string
  label: string
  color?: string | null
}

export type FileTypeOption = {
  key: string
  label: string
  color?: string | null
  icon?: string | null
}

export type ProjectTemplateOption = {
  key: string
  label: string
  description?: string | null
}

export type AppConfig = {
  GIT_INTEGRATION: number
  SHARE_LINKS: number
  GROUPS_UI: number
  DIRS_PERSIST: number
  RESULTS_MODAL: number
  SEARCH_V2: number
  SEARCH_MODAL_V2: number
  SEARCH_FILTERS_V2: number
  TAGS_V2: number
  PROJECT_MODAL: number
  UX_CREATION_DASHBOARD_REFRESH: number
  PROJECT_STATUS_OPTIONS: StatusOption[]
  FILE_TYPE_OPTIONS: FileTypeOption[]
  PROJECT_TEMPLATES: ProjectTemplateOption[]
  CONFIG_VERSION: string
}

const defaultStatusOptions: StatusOption[] = [
  { key: 'idea', label: 'Idea' },
  { key: 'discovery', label: 'Discovery' },
  { key: 'draft', label: 'Draft' },
  { key: 'live', label: 'Live' },
  { key: 'archived', label: 'Archived' },
]

const defaultFileTypeOptions: FileTypeOption[] = [
  { key: 'prd', label: 'PRD' },
  { key: 'task', label: 'Task' },
  { key: 'idea', label: 'Idea' },
  { key: 'note', label: 'Note' },
]

const defaultProjectTemplates: ProjectTemplateOption[] = [
  { key: 'blank', label: 'Blank', description: 'Start from scratch' },
]

let _config: AppConfig | null = null

export async function getConfig(): Promise<AppConfig> {
  if (_config) return _config
  try {
    const result = await apiGet<Partial<AppConfig>>('/config')
    _config = {
      GIT_INTEGRATION: result.GIT_INTEGRATION ?? 0,
      SHARE_LINKS: result.SHARE_LINKS ?? 0,
      GROUPS_UI: result.GROUPS_UI ?? 0,
      DIRS_PERSIST: result.DIRS_PERSIST ?? 0,
      RESULTS_MODAL: result.RESULTS_MODAL ?? 1,
      SEARCH_V2: result.SEARCH_V2 ?? 1,
      SEARCH_MODAL_V2: result.SEARCH_MODAL_V2 ?? 1,
      SEARCH_FILTERS_V2: result.SEARCH_FILTERS_V2 ?? 1,
      TAGS_V2: result.TAGS_V2 ?? 1,
      PROJECT_MODAL: result.PROJECT_MODAL ?? 0,
      UX_CREATION_DASHBOARD_REFRESH: result.UX_CREATION_DASHBOARD_REFRESH ?? 0,
      PROJECT_STATUS_OPTIONS: (result.PROJECT_STATUS_OPTIONS && result.PROJECT_STATUS_OPTIONS.length > 0)
        ? result.PROJECT_STATUS_OPTIONS
        : defaultStatusOptions,
      FILE_TYPE_OPTIONS: (result.FILE_TYPE_OPTIONS && result.FILE_TYPE_OPTIONS.length > 0)
        ? result.FILE_TYPE_OPTIONS
        : defaultFileTypeOptions,
      PROJECT_TEMPLATES: (result.PROJECT_TEMPLATES && result.PROJECT_TEMPLATES.length > 0)
        ? result.PROJECT_TEMPLATES
        : defaultProjectTemplates,
      CONFIG_VERSION: result.CONFIG_VERSION ?? '2025-09-27-set2',
    }
    return _config
  } catch {
    // Fallback defaults
    return {
      GIT_INTEGRATION: 0,
      SHARE_LINKS: 0,
      GROUPS_UI: 0,
      DIRS_PERSIST: 0,
      RESULTS_MODAL: 1,
      SEARCH_V2: 1,
      SEARCH_MODAL_V2: 1,
      SEARCH_FILTERS_V2: 1,
      TAGS_V2: 1,
      PROJECT_MODAL: 0,
      UX_CREATION_DASHBOARD_REFRESH: 0,
      PROJECT_STATUS_OPTIONS: defaultStatusOptions,
      FILE_TYPE_OPTIONS: defaultFileTypeOptions,
      PROJECT_TEMPLATES: defaultProjectTemplates,
      CONFIG_VERSION: '2025-09-27-set2',
    }
  }
}

export function invalidateConfigCache(): void {
  _config = null
}
