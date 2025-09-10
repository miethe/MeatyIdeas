export interface ApiClientOptions {
  baseUrl?: string
  token?: string
}

export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080/api'
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

