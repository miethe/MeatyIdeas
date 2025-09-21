import { useInfiniteQuery } from '@tanstack/react-query'

import { apiGet } from '@/lib/apiClient'
import { ProjectActivityResponseSchema } from '@/lib/types'

export function useProjectActivity(projectId: string | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['project-modal-activity', projectId],
    enabled: Boolean(projectId) && enabled,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    queryFn: async ({ pageParam }) => {
      if (!projectId) throw new Error('missing project id')
      const params = new URLSearchParams({ limit: '20' })
      if (pageParam) params.set('cursor', pageParam)
      const data = await apiGet(`/projects/${projectId}/activity?${params.toString()}`)
      return ProjectActivityResponseSchema.parse(data)
    },
  })
}
