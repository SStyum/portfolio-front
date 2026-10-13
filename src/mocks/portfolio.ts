// Dados de exemplo usados quando a API (portfolio-back) não responde.
// Assim o site fica completo mesmo sem back-end rodando.

import type { Endpoint, MetricsSummary, Post, PostComment, PostSummary } from '../api'

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

export const mockPosts: Post[] = [
  {
    id: 'mock-ddd-na-pratica',
    authorId: 'eric',
    title: 'DDD na prática: quando um Either vale mais que mil exceptions',
    createdAt: daysAgo(3),
    content: `Exceptions são ótimas para o inesperado. O problema é usar exception para o esperado: "e-mail já cadastrado" não é uma surpresa, é uma regra de negócio.

Neste post mostro como os casos de uso da Portfolio API devolvem Either<Erro, Resultado>, o que isso muda nos controllers e por que os testes ficaram mais simples.

Spoiler: o compilador passa a lembrar você de tratar cada caminho.`,
  },
  {
    id: 'mock-webhook-idempotente',
    authorId: 'eric',
    title: 'Webhook idempotente com Stripe sem perder o sono',
    createdAt: daysAgo(11),
    content: `A Stripe pode mandar o mesmo evento duas vezes, fora de ordem, e às vezes depois de um timeout seu.

A receita: gravar o id do evento numa tabela com chave única antes de processar, processar dentro da mesma transação e responder 200 rápido. O resto vira fila.`,
  },
  {
    id: 'mock-metricas-red',
    authorId: 'eric',
    title: 'Métricas RED: as três perguntas que todo dashboard deve responder',
    createdAt: daysAgo(24),
    content: `Quantas requisições? Quantas falharam? Quanto tempo levaram? Rate, Errors, Duration.

Com prom-client e um interceptor no NestJS dá pra ter as três por rota em menos de cinquenta linhas. Depois é só deixar o Grafana desenhar.`,
  },
  {
    id: 'mock-vila-3d',
    authorId: 'eric',
    title: 'Como fiz um portfólio que é um jogo (sem nenhum modelo 3D)',
    createdAt: daysAgo(40),
    content: `Todo o personagem é feito de cápsulas, caixas e cones. As animações são senos bem escolhidos.

Conto aqui como montei o personagem com pivôs, o terreno procedural e o combo de espada que para exatamente quando encosta no chão.`,
  },
]

export const mockPostSummaries: PostSummary[] = mockPosts.map((p) => ({
  id: p.id,
  authorId: p.authorId,
  title: p.title,
  createdAt: p.createdAt,
  excerpt: p.content.split('\n')[0].slice(0, 160),
}))

export const mockComments: Record<string, PostComment[]> = {
  'mock-ddd-na-pratica': [
    { id: 'c1', authorId: 'ana', content: 'Mudei um projeto inteiro pra Either depois disso. Os testes agradeceram.', createdAt: daysAgo(2) },
    { id: 'c2', authorId: 'leo', content: 'E como fica a tipagem quando o caso de uso tem vários erros possíveis?', createdAt: daysAgo(1) },
  ],
}

export const mockEndpoints: Endpoint[] = [
  { method: 'POST', path: '/accounts', summary: 'Cria uma conta', tag: 'Contas' },
  { method: 'POST', path: '/sessions', summary: 'Autentica e devolve um JWT', tag: 'Contas' },
  { method: 'GET', path: '/me', summary: 'Perfil do usuário logado', tag: 'Contas' },
  { method: 'GET', path: '/posts', summary: 'Lista posts paginados', tag: 'Blog' },
  { method: 'GET', path: '/posts/{id}', summary: 'Detalhe de um post', tag: 'Blog' },
  { method: 'POST', path: '/posts', summary: 'Publica um post', tag: 'Blog' },
  { method: 'PUT', path: '/posts/{id}', summary: 'Edita um post', tag: 'Blog' },
  { method: 'DELETE', path: '/posts/{id}', summary: 'Remove um post', tag: 'Blog' },
  { method: 'GET', path: '/posts/{id}/comments', summary: 'Comentários de um post', tag: 'Blog' },
  { method: 'POST', path: '/posts/{id}/comments', summary: 'Comenta num post', tag: 'Blog' },
  { method: 'POST', path: '/chat', summary: 'Pergunta ao assistente com IA', tag: 'Chat' },
  { method: 'POST', path: '/billing/checkout', summary: 'Abre o checkout da assinatura', tag: 'Pagamentos' },
  { method: 'POST', path: '/billing/portal', summary: 'Abre o portal do assinante', tag: 'Pagamentos' },
  { method: 'POST', path: '/billing/webhook', summary: 'Recebe eventos da Stripe', tag: 'Pagamentos' },
  { method: 'GET', path: '/metrics', summary: 'Métricas no formato Prometheus', tag: 'Observabilidade' },
  { method: 'GET', path: '/health', summary: 'Checagem de saúde', tag: 'Observabilidade' },
]

// Métricas "ao vivo" de mentira: variam um pouco a cada chamada
let mockRequests = 18_420
export function mockMetricsSummary(): MetricsSummary {
  mockRequests += Math.round(20 + Math.random() * 60)
  return {
    requests: mockRequests,
    errors5xx: 7,
    avgLatencyMs: 38 + Math.random() * 12,
    memoryMb: 112 + Math.random() * 6,
    heapMb: 54 + Math.random() * 4,
    uptimeSec: 3 * 86_400 + 5 * 3600 + ((Date.now() / 1000) % 3600),
    eventLoopLagMs: 1.2 + Math.random() * 0.8,
    messages: Math.round(mockRequests * 0.18),
    topRoutes: [
      { route: 'GET /posts', count: 6_210 },
      { route: 'GET /posts/{id}', count: 4_870 },
      { route: 'GET /metrics', count: 3_330 },
      { route: 'POST /sessions', count: 1_204 },
      { route: 'GET /me', count: 1_102 },
      { route: 'POST /chat', count: 640 },
    ],
  }
}

// ---------- séries do dashboard (Grafana de mentira) ----------

export interface SeriesPoint {
  t: number // epoch ms
  v: number
}

export interface DashboardData {
  requestsPerMin: SeriesPoint[]
  latencyP50: SeriesPoint[]
  latencyP95: SeriesPoint[]
  errorRate: SeriesPoint[] // % de 5xx
}

// ruído suave e determinístico (mesma curva pra mesma hora)
const wave = (i: number, seed: number) =>
  Math.sin(i * 0.21 + seed) * 0.5 + Math.sin(i * 0.057 + seed * 2.3) * 0.35 + Math.sin(i * 0.9 + seed * 5.1) * 0.15

export function mockDashboard(minutes = 60, at = Date.now()): DashboardData {
  const now = Math.floor(at / 60_000) * 60_000
  const out: DashboardData = { requestsPerMin: [], latencyP50: [], latencyP95: [], errorRate: [] }
  for (let i = minutes - 1; i >= 0; i--) {
    const t = now - i * 60_000
    const k = t / 60_000
    const load = 320 + wave(k, 1) * 140
    out.requestsPerMin.push({ t, v: Math.max(40, Math.round(load)) })
    out.latencyP50.push({ t, v: 28 + wave(k, 4) * 6 + load * 0.01 })
    out.latencyP95.push({ t, v: 70 + wave(k, 7) * 18 + load * 0.04 })
    out.errorRate.push({ t, v: Math.max(0, 0.3 + wave(k, 9) * 0.35) })
  }
  return out
}
