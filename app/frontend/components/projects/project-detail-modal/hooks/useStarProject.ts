import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { apiJson } from '@/lib/apiClient'

export function useStarProject(projectId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (next: boolean) => {
      if (!projectId) return
      if (next) await apiJson('POST', `/projects/${projectId}/star`, {})
      else await apiJson('DELETE', `/projects/${projectId}/star`, null)
    },
    onSuccess: () => {
      if (!projectId) return
      queryClient.invalidateQueries({ queryKey: ['project-modal-summary', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: () => toast.error('Unable to update star state'),
  })
}
