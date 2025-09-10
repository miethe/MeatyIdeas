export interface ApiClientOptions {
  baseUrl?: string
  token?: string
}

export function getApiBase() {
  // 1. Use env variable if set
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
  // 2. Allow override via ?apiBase= for debugging
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('apiBase');
    if (override) return override;
    // 3. Default to same-origin when in browser (behind proxy)
    return `${window.location.origin}/api`;
  }
  // 4. Fallback for SSR/process usage
  return 'http://localhost:8081/api';
}

export function getToken() {
  return process.env.NEXT_PUBLIC_TOKEN || 'devtoken'
}

export async function apiGet<T>(path: string, opts: ApiClientOptions = {}): Promise<T> {
  const base = opts.baseUrl || getApiBase()
  const res = await fetch(`${base}${path}`, {
    headers: { 'X-Token': opts.token || getToken() },
    cache: 'no-store',
  })
  if (!res.ok) throw Object.assign(new Error(`GET ${path} failed`), { status: res.status })
  return res.json()
}

export async function apiJson<T>(method: string, path: string, body: any, opts: ApiClientOptions = {}): Promise<T> {
  const base = opts.baseUrl || getApiBase()
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Token': opts.token || getToken(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw Object.assign(new Error(`${method} ${path} failed`), { status: res.status })
  return res.json()
}
