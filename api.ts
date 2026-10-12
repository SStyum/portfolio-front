import { API_URL } from './config'

export interface PostSummary {
  id: string
  authorId: string
  title: string
  excerpt: string
  createdAt: string
}

export interface Post {
  id: string
  authorId: string
  title: string
  content: string
  createdAt: string
  updatedAt?: string | null
}

export interface PostComment {
  id: string
  authorId: string
  content: string
  createdAt: string
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(7000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${path}`)
  return (await res.json()) as T
}

export async function fetchPosts(page = 1): Promise<PostSummary[]> {
  const data = await get<{ posts: PostSummary[] }>(`/posts?page=${page}`)
  return data.posts
}

export async function fetchPost(id: string): Promise<Post> {
  const data = await get<{ post: Post }>(`/posts/${encodeURIComponent(id)}`)
  return data.post
}

export async function fetchComments(postId: string): Promise<PostComment[]> {
  const data = await get<{ comments: PostComment[] }>(`/posts/${encodeURIComponent(postId)}/comments`)
  return data.comments
}

// ---------- métricas Prometheus ----------

export interface MetricSample {
  name: string
  labels: Record<string, string>
  value: number
}

export async function fetchMetrics(): Promise<MetricSample[]> {
  const res = await fetch(`${API_URL}/metrics`, { signal: AbortSignal.timeout(7000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} em /metrics`)
  return parsePrometheus(await res.text())
}

// Formato texto do Prometheus: nome{rotulo="valor",...} numero
export function parsePrometheus(text: string): MetricSample[] {
  const out: MetricSample[] = []
  const line = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{(.*)\})?\s+([^\s]+)/
  const label = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g
  for (const raw of text.split('\n')) {
    if (!raw || raw.startsWith('#')) continue
    const m = line.exec(raw)
    if (!m) continue
    const labels: Record<string, string> = {}
    if (m[3]) for (const l of m[3].matchAll(label)) labels[l[1]] = l[2]
    const value = Number(m[4])
    if (!Number.isNaN(value)) out.push({ name: m[1], labels, value })
  }
  return out
}

export interface MetricsSummary {
  requests: number
  errors5xx: number
  avgLatencyMs: number | null
  memoryMb: number | null
  heapMb: number | null
  uptimeSec: number | null
  eventLoopLagMs: number | null
  messages: number
  topRoutes: { route: string; count: number }[]
}

export function summarizeMetrics(samples: MetricSample[]): MetricsSummary {
  const sum = (name: string, filter?: (l: Record<string, string>) => boolean) =>
    samples.filter((s) => s.name === name && (!filter || filter(s.labels))).reduce((a, s) => a + s.value, 0)
  const one = (name: string) => samples.find((s) => s.name === name)?.value ?? null

  const durSum = sum('http_request_duration_seconds_sum')
  const durCount = sum('http_request_duration_seconds_count')

  const byRoute = new Map<string, number>()
  for (const s of samples) {
    if (s.name !== 'http_requests_total') continue
    const key = `${s.labels.method ?? ''} ${s.labels.route ?? '?'}`.trim()
    byRoute.set(key, (byRoute.get(key) ?? 0) + s.value)
  }

  const start = one('process_start_time_seconds')
  const mem = one('process_resident_memory_bytes')
  const heap = one('nodejs_heap_size_used_bytes')
  const lag = one('nodejs_eventloop_lag_seconds')

  return {
    requests: sum('http_requests_total'),
    errors5xx: sum('http_requests_total', (l) => (l.status ?? '').startsWith('5')),
    avgLatencyMs: durCount > 0 ? (durSum / durCount) * 1000 : null,
    memoryMb: mem !== null ? mem / 1024 / 1024 : null,
    heapMb: heap !== null ? heap / 1024 / 1024 : null,
    uptimeSec: start !== null ? Date.now() / 1000 - start : null,
    eventLoopLagMs: lag !== null ? lag * 1000 : null,
    messages: sum('messages_published_total'),
    topRoutes: [...byRoute.entries()]
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  }
}

// ---------- OpenAPI (Swagger) ----------

export interface Endpoint {
  method: string
  path: string
  summary: string
  tag: string
}

export async function fetchEndpoints(): Promise<Endpoint[]> {
  const doc = await get<{ paths: Record<string, Record<string, { summary?: string; tags?: string[] }>> }>('/docs-json')
  const out: Endpoint[] = []
  for (const [path, ops] of Object.entries(doc.paths ?? {})) {
    for (const [method, op] of Object.entries(ops)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
      out.push({ method: method.toUpperCase(), path, summary: op.summary ?? '', tag: op.tags?.[0] ?? 'Outros' })
    }
  }
  return out
}
