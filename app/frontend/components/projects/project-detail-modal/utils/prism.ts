const SUPPORTED_PRISM_LANGS: Record<string, string> = {
  markdown: 'markdown',
  javascript: 'javascript',
  typescript: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  json: 'json',
  yaml: 'yaml',
  shell: 'bash',
  bash: 'bash',
  css: 'css',
  html: 'markup',
  python: 'python',
  go: 'go',
  rust: 'rust',
  java: 'java',
  kotlin: 'kotlin',
  swift: 'swift',
  c: 'c',
  'c++': 'cpp',
  cpp: 'cpp',
  sql: 'sql',
}

export function resolvePrismLanguage(language: string | null | undefined) {
  const key = (language || '').toLowerCase()
  return SUPPORTED_PRISM_LANGS[key] || 'markup'
}

export async function loadPrismLanguage(name: string) {
  switch (name) {
    case 'typescript':
      await import('prismjs/components/prism-typescript')
      await import('prismjs/components/prism-tsx')
      break
    case 'tsx':
      await import('prismjs/components/prism-tsx')
      break
    case 'jsx':
      await import('prismjs/components/prism-jsx')
      break
    case 'javascript':
      await import('prismjs/components/prism-javascript')
      break
    case 'json':
      await import('prismjs/components/prism-json')
      break
    case 'yaml':
      await import('prismjs/components/prism-yaml')
      break
    case 'bash':
      await import('prismjs/components/prism-bash')
      break
    case 'css':
      await import('prismjs/components/prism-css')
      break
    case 'markup':
      await import('prismjs/components/prism-markup')
      break
    case 'python':
      await import('prismjs/components/prism-python')
      break
    case 'go':
      await import('prismjs/components/prism-go')
      break
    case 'rust':
      await import('prismjs/components/prism-rust')
      break
    case 'java':
      await import('prismjs/components/prism-java')
      break
    case 'kotlin':
      await import('prismjs/components/prism-kotlin')
      break
    case 'swift':
      await import('prismjs/components/prism-swift')
      break
    case 'c':
      await import('prismjs/components/prism-c')
      break
    case 'cpp':
      await import('prismjs/components/prism-cpp')
      break
    case 'sql':
      await import('prismjs/components/prism-sql')
      break
    case 'markdown':
      await import('prismjs/components/prism-markdown')
      break
    default:
      await import('prismjs/components/prism-markup')
  }
}
