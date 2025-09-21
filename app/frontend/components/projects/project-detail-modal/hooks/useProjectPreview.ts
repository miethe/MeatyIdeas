import { useQuery } from '@tanstack/react-query'

import { apiGet } from '@/lib/apiClient'
import { FilePreviewSchema } from '@/lib/types'
import { span } from '@/lib/telemetry'

export function useProjectPreview(projectId: string | null, fileId: string | null, open: boolean) {
  return useQuery({
    queryKey: ['project-modal-preview', fileId],
    enabled: open && Boolean(projectId) && Boolean(fileId),
    queryFn: async () => {
      if (!fileId) throw new Error('missing file id')
      const data = await apiGet(`/files/${fileId}/preview`)
      const parsed = FilePreviewSchema.parse(data)
      if (projectId) {
        span('project_modal_file_previewed', {
          project_id: projectId,
          file_id: parsed.id,
          path: parsed.path,
          extension: parsed.path.split('.').pop(),
          truncated: parsed.is_truncated,
        })
      }
      return parsed
    },
    staleTime: 0,
  })
}
