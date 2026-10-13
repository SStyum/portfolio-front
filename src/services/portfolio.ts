// Dados do site: tenta a API real e, se ela não responder, usa os mocks.
// Defina NEXT_PUBLIC_USE_MOCKS=true para pular a API de vez.

import {
  fetchComments,
  fetchEndpoints,
  fetchMetrics,
  fetchPost,
  fetchPosts,
  summarizeMetrics,
  type Endpoint,
  type MetricsSummary,
  type Post,
  type PostComment,
  type PostSummary,
} from '../api'
import {
  mockComments,
  mockDashboard,
  mockEndpoints,
  mockMetricsSummary,
  mockPostSummaries,
  mockPosts,
  type DashboardData,
} from '../mocks/portfolio'

export type Source = 'api' | 'mock'

export interface Sourced<T> {
  data: T
  source: Source
}

const FORCE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true'

async function withFallback<T>(real: () => Promise<T>, mock: () => T): Promise<Sourced<T>> {
  if (FORCE_MOCKS) return { data: mock(), source: 'mock' }
  try {
    return { data: await real(), source: 'api' }
  } catch {
    return { data: mock(), source: 'mock' }
  }
}

export function getPosts(): Promise<Sourced<PostSummary[]>> {
  return withFallback(
    async () => {
      const posts = await fetchPosts(1)
      // API no ar mas sem posts: mostra os exemplos pra seção não ficar vazia
      if (posts.length === 0) throw new Error('sem posts')
      return posts
    },
    () => mockPostSummaries,
  )
}

export async function getPost(id: string): Promise<Sourced<{ post: Post; comments: PostComment[] }>> {
  const mock = mockPosts.find((p) => p.id === id)
  if (mock) return { data: { post: mock, comments: mockComments[id] ?? [] }, source: 'mock' }
  const [post, comments] = await Promise.all([fetchPost(id), fetchComments(id).catch(() => [])])
  return { data: { post, comments }, source: 'api' }
}

export function getMetrics(): Promise<Sourced<MetricsSummary>> {
  return withFallback(async () => summarizeMetrics(await fetchMetrics()), mockMetricsSummary)
}

export function getEndpoints(): Promise<Sourced<Endpoint[]>> {
  return withFallback(fetchEndpoints, () => mockEndpoints)
}

// TODO: trocar por consultas reais ao Prometheus (query_range) feitas pelo back-end,
// liberadas só para assinantes. Por enquanto é sempre mock.
export async function getDashboard(): Promise<Sourced<DashboardData>> {
  return { data: mockDashboard(60), source: 'mock' }
}
