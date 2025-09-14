import { apiGet } from '@/lib/apiClient'

export type AppConfig = {
  GIT_INTEGRATION: number
  SHARE_LINKS: number
  GROUPS_UI: number
  DIRS_PERSIST: number
  RESULTS_MODAL: number
}

let _config: AppConfig | null = null

export async function getConfig(): Promise<AppConfig> {
  if (_config) return _config
  try {
    _config = await apiGet<AppConfig>('/config')
    return _config
  } catch {
    // Fallback defaults
    return { GIT_INTEGRATION: 0, SHARE_LINKS: 0, GROUPS_UI: 0, DIRS_PERSIST: 0, RESULTS_MODAL: 1 }
  }
}

