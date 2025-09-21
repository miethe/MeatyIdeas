import { useQuery } from '@tanstack/react-query'

import { apiGet } from '@/lib/apiClient'
import { ProjectModalSummarySchema } from '@/lib/types'

export function useProjectSummary(projectId: string | null, open: boolean) {
  return useQuery({
    queryKey: ['project-modal-summary', projectId],
    enabled: open && Boolean(projectId),
    queryFn: async () => {
      if (!projectId) throw new Error('missing project id')
      try {
        const data = await apiGet(`/projects/${projectId}/modal`)
        return ProjectModalSummarySchema.parse(data)
      } catch (error) {
        console.error('Failed to load project modal summary:', error)
        throw error
      }
    },
    staleTime: 60_000,
  })
}
