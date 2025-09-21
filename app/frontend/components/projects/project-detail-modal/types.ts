import { ProjectTreeNode } from '@/lib/types'

type ProjectModalTab = 'overview' | 'preview' | 'activity'

export type { ProjectModalTab }

export type TreeSelection = {
  path: string
  fileId: string | null
}

export type ModalTreeState = {
  nodes: Record<string, ProjectTreeNode>
  children: Record<string, string[]>
}

export type VisibleTreeRow = {
  node: ProjectTreeNode
  depth: number
}
