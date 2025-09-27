import { useQuery } from '@tanstack/react-query'

import { apiGet } from '@/lib/apiClient'
import { normalizeFile, NormalizedFile } from '@/lib/files/normalizeFile'

export function useFileDetails(fileId: string | null, enabled: boolean) {
  return useQuery<NormalizedFile>({
    queryKey: ['file-details', fileId],
    enabled: enabled && Boolean(fileId),
    queryFn: async () => {
      if (!fileId) throw new Error('missing file id')
      const data = await apiGet(`/files/${fileId}`)
      return normalizeFile(data)
    },
    staleTime: 30_000,
  })
}
