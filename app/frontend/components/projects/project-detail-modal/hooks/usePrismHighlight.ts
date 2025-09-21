import * as React from 'react'

import { FilePreview } from '@/lib/types'

import { loadPrismLanguage, resolvePrismLanguage } from '../utils/prism'

type PrismState = {
  highlightedHtml: string | null
  isHighlighting: boolean
}

export function usePrismHighlight(preview: FilePreview | undefined): PrismState {
  const [state, setState] = React.useState<PrismState>({ highlightedHtml: null, isHighlighting: false })

  React.useEffect(() => {
    if (!preview || preview.preview_type !== 'text' || !preview.content) {
      setState({ highlightedHtml: null, isHighlighting: false })
      return
    }

    let cancelled = false

    async function run() {
      setState({ highlightedHtml: null, isHighlighting: true })
      const Prism = await import('prismjs')
      const grammarName = resolvePrismLanguage(preview.language)

      if (!Prism.languages[grammarName]) {
        try {
          await loadPrismLanguage(grammarName)
        } catch {
          // allow fallback to markup
        }
      }

      const grammar = Prism.languages[grammarName] || Prism.languages.markup
      const html = Prism.highlight(preview.content || '', grammar, grammarName)
      if (!cancelled) setState({ highlightedHtml: html, isHighlighting: false })
    }

    run()

    return () => {
      cancelled = true
    }
  }, [preview?.id, preview?.content, preview?.language, preview?.preview_type])

  return state
}
