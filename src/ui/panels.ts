import { fetchComments, fetchEndpoints, fetchMetrics, fetchPost, fetchPosts, summarizeMetrics, type MetricsSummary } from '../api'
import { API_URL, GRAFANA_DASHBOARD_URL, PROMETHEUS_URL, SWAGGER_URL } from '../config'
import { contacts, profile, projects } from '../content'

export type PanelId = 'sobre' | 'projetos' | 'blog' | 'observatorio' | 'api' | 'contato' | 'ajuda'

// Cada painel desenha seu conteúdo no body e pode devolver uma função de limpeza
type Renderer = (body: HTMLElement) => void | (() => void)

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const offline = (what: string) => `
  <div class="notice">
    <strong>Não consegui falar com a API.</strong>
    <p>${esc(what)} vem de <code>${esc(API_URL)}</code>. Suba o back-end com <code>npm run start:dev</code> no <code>portfolio-back</code> (e o banco com <code>docker compose up -d postgres</code>).</p>
  </div>`

const loading = '<div class="loading"><span></span><span></span><span></span></div>'

const sobre: Renderer = (body) => {
  body.innerHTML = `
    <div class="profile">
      <div class="avatar">${esc(profile.name.split(' ').map((p) => p[0]).slice(0, 2).join(''))}</div>
      <div>
        <h3>${esc(profile.name)}</h3>
        <p class="muted">${esc(profile.role)}</p>
      </div>
    </div>
    ${profile.bio.map((p) => `<p>${esc(p)}</p>`).join('')}
    <h4>Habilidades</h4>
    <div class="chips">${profile.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>
    <h4>Pela vila</h4>
    <p class="muted">Siga os feixes de luz: cada um marca um setor. Aperte <kbd>M</kbd> para abrir o mapa e viajar direto.</p>`
}

const projetos: Renderer = (body) => {
  body.innerHTML = `<div class="cards">${projects
    .map(
      (p) => `
      <article class="card">
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.description)}</p>
        ${p.highlights ? `<ul>${p.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
        <div class="chips">${p.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
        <div class="actions">
          ${p.repo ? `<a class="btn" href="${esc(p.repo)}" target="_blank" rel="noopener">Repositório</a>` : ''}
          ${p.url ? `<a class="btn ghost" href="${esc(p.url)}" target="_blank" rel="noopener">Ver online</a>` : ''}
        </div>
      </article>`,
    )
    .join('')}</div>`
}

const blog: Renderer = (body) => {
  let alive = true

  const list = async () => {
    body.innerHTML = loading
    try {
      const posts = await fetchPosts(1)
      if (!alive) return
      if (posts.length === 0) {
        body.innerHTML = `<p class="muted">Ainda não há posts. Crie um com <code>POST /posts</code> (autenticado) e volte aqui.</p>`
        return
      }
      body.innerHTML = `<div class="post-list">${posts
        .map(
          (p) => `
          <button class="post-item" data-id="${esc(p.id)}">
            <span class="date">${fmtDate(p.createdAt)}</span>
            <strong>${esc(p.title)}</strong>
            <span class="muted">${esc(p.excerpt)}</span>
          </button>`,
        )
        .join('')}</div>`
      body.querySelectorAll<HTMLButtonElement>('.post-item').forEach((b) => b.addEventListener('click', () => open(b.dataset.id!)))
    } catch {
      if (alive) body.innerHTML = offline('O blog')
    }
  }

  const open = async (id: string) => {
    body.innerHTML = loading
    try {
      const [post, comments] = await Promise.all([fetchPost(id), fetchComments(id).catch(() => [])])
      if (!alive) return
      body.innerHTML = `
        <button class="btn ghost back">← Voltar</button>
        <article class="post">
          <span class="date">${fmtDate(post.createdAt)}</span>
          <h3>${esc(post.title)}</h3>
          ${post.content
            .split(/\n{2,}/)
            .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
            .join('')}
        </article>
        <h4>Comentários (${comments.length})</h4>
        ${
          comments.length
            ? comments.map((c) => `<div class="comment"><span class="date">${fmtDate(c.createdAt)}</span><p>${esc(c.content)}</p></div>`).join('')
            : '<p class="muted">Nenhum comentário ainda.</p>'
        }`
      body.querySelector('.back')!.addEventListener('click', list)
    } catch {
      if (alive) body.innerHTML = offline('Este post')
    }
  }

  list()
  return () => {
    alive = false
  }
}

const fmtUptime = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min ${Math.floor(s % 60)}s`
}

// Assinatura salva pelo site (src/stores/premium.store.ts, chave PREMIUM_STORAGE_KEY)
const isPremium = (): boolean => {
  try {
    return JSON.parse(localStorage.getItem('portfolio:premium') ?? '{}')?.state?.isPremium === true
  } catch {
    return false
  }
}

const statTile = (label: string, value: string) => `<div class="stat"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`

const observatorio: Renderer = (body) => {
  const premium = isPremium()
  const grafana = premium
    ? `<div class="actions">
      <a class="btn" href="${esc(GRAFANA_DASHBOARD_URL)}" target="_blank" rel="noopener">Abrir dashboard no Grafana</a>
      <a class="btn ghost" href="${esc(PROMETHEUS_URL)}" target="_blank" rel="noopener">Prometheus</a>
      <a class="btn ghost" href="${esc(API_URL)}/metrics" target="_blank" rel="noopener">/metrics cru</a>
      <button class="btn ghost embed">Mostrar o painel aqui</button>
    </div>
    <div class="embed-slot"></div>
    <h4>Como ver o Grafana</h4>
    <ol class="steps">
      <li>No <code>portfolio-back</code>, suba o monitoramento: <code>docker compose up -d prometheus grafana</code></li>
      <li>Rode a API: <code>npm run start:dev</code> (porta 3333). O Prometheus raspa <code>host.docker.internal:3333/metrics</code>.</li>
      <li>Abra <a href="${esc(GRAFANA_DASHBOARD_URL)}" target="_blank" rel="noopener">o dashboard "Portfolio API"</a>. Login: <code>admin</code> / <code>admin</code> (ou acesso anônimo de leitura).</li>
      <li>Ande pela vila e abra o blog: cada requisição aparece nos gráficos em alguns segundos.</li>
    </ol>`
    : `
    <div class="notice">
      <strong>🔒 O dashboard Grafana é exclusivo para assinantes.</strong>
      <p>Latência p50/p95, taxa de erro e tráfego por rota, ao vivo. Assine o Acesso Observatório no site e volte aqui: a torre libera o painel.</p>
    </div>
    <div class="actions"><a class="btn" href="/home#observatorio">Assinar no site</a></div>`

  body.innerHTML = `
    <p>Da torre de vigia dá pra ver tudo que acontece na API. A API expõe métricas no formato Prometheus em <code>/metrics</code>; o Prometheus coleta a cada poucos segundos e o Grafana desenha os gráficos.</p>
    <h4>Agora, ao vivo <span class="live-dot"></span></h4>
    <div class="live">${loading}</div>
    ${grafana}`

  const live = body.querySelector<HTMLElement>('.live')!
  const render = (m: MetricsSummary) => {
    live.innerHTML = `
      <div class="stats">
        ${statTile('requisições', m.requests.toLocaleString('pt-BR'))}
        ${statTile('erros 5xx', m.errors5xx.toLocaleString('pt-BR'))}
        ${statTile('latência média', m.avgLatencyMs !== null ? `${m.avgLatencyMs.toFixed(1)} ms` : '–')}
        ${statTile('memória (RSS)', m.memoryMb !== null ? `${m.memoryMb.toFixed(0)} MB` : '–')}
        ${statTile('heap usado', m.heapMb !== null ? `${m.heapMb.toFixed(0)} MB` : '–')}
        ${statTile('event loop lag', m.eventLoopLagMs !== null ? `${m.eventLoopLagMs.toFixed(1)} ms` : '–')}
        ${statTile('no ar há', m.uptimeSec !== null ? fmtUptime(m.uptimeSec) : '–')}
        ${statTile('mensagens publicadas', m.messages.toLocaleString('pt-BR'))}
      </div>
      ${
        m.topRoutes.length
          ? `<h4>Rotas mais chamadas</h4><div class="bars">${m.topRoutes
              .map(
                (r) => `<div class="bar-row"><code>${esc(r.route)}</code><div class="bar"><div style="width:${(r.count / m.topRoutes[0].count) * 100}%"></div></div><span>${r.count}</span></div>`,
              )
              .join('')}</div>`
          : ''
      }`
  }

  let alive = true
  const tick = async () => {
    try {
      const m = summarizeMetrics(await fetchMetrics())
      if (alive) render(m)
    } catch (err) {
      if (!alive) return
      live.innerHTML = String(err).includes('HTTP 401')
        ? `<div class="notice"><strong>/metrics está protegido.</strong><p>A API tem <code>METRICS_TOKEN</code> definido; as métricas ao vivo ficam só no Grafana.</p></div>`
        : offline('As métricas')
    }
  }
  tick()
  const timer = window.setInterval(tick, 5000)

  body.querySelector('.embed')?.addEventListener('click', (e) => {
    ;(e.currentTarget as HTMLElement).remove()
    body.querySelector('.embed-slot')!.innerHTML = `
      <iframe class="grafana" src="${esc(GRAFANA_DASHBOARD_URL)}?orgId=1&kiosk&theme=dark&refresh=5s" title="Dashboard Grafana"></iframe>
      <p class="muted small">Se ficar em branco, o Grafana não está rodando ou não permite ser embutido (veja <code>GF_SECURITY_ALLOW_EMBEDDING</code> no docker-compose).</p>`
  })

  return () => {
    alive = false
    window.clearInterval(timer)
  }
}

const api: Renderer = (body) => {
  body.innerHTML = `
    <p>A biblioteca guarda a documentação viva da API, gerada automaticamente dos schemas Zod e servida pelo Swagger.</p>
    <div class="actions"><a class="btn" href="${esc(SWAGGER_URL)}" target="_blank" rel="noopener">Abrir Swagger</a></div>
    <div class="endpoints">${loading}</div>`
  const slot = body.querySelector<HTMLElement>('.endpoints')!
  let alive = true
  fetchEndpoints()
    .then((eps) => {
      if (!alive) return
      const byTag = new Map<string, typeof eps>()
      for (const e of eps) byTag.set(e.tag, [...(byTag.get(e.tag) ?? []), e])
      slot.innerHTML = [...byTag.entries()]
        .map(
          ([tag, list]) => `
          <h4>${esc(tag)}</h4>
          ${list
            .map(
              (e) => `<div class="endpoint"><span class="method m-${e.method.toLowerCase()}">${e.method}</span><code>${esc(e.path)}</code><span class="muted">${esc(e.summary)}</span></div>`,
            )
            .join('')}`,
        )
        .join('')
    })
    .catch(() => {
      if (alive) slot.innerHTML = offline('A lista de endpoints')
    })
  return () => {
    alive = false
  }
}

const contato: Renderer = (body) => {
  const visible = contacts.filter((c) => c.href)
  body.innerHTML = `
    <p>Gostou do que viu na vila? Me manda uma carta.</p>
    <div class="contacts">${visible
      .map((c) => `<a class="contact" href="${esc(c.href)}" target="_blank" rel="noopener"><strong>${esc(c.label)}</strong><span>${esc(c.value)}</span></a>`)
      .join('')}</div>`
}

const ajuda: Renderer = (body) => {
  body.innerHTML = `
    <p>Bem-vindo à vila! Cada construção com um feixe de luz é uma parte do portfólio.</p>
    <div class="controls-grid">
      <kbd>W A S D</kbd><span>andar</span>
      <kbd>Shift</kbd><span>correr</span>
      <kbd>Espaço</kbd><span>pular</span>
      <kbd>F / Clique</kbd><span>combo de espada (aperte até 3x)</span>
      <kbd>Espaço + F</kbd><span>golpe aéreo: mortal e mergulho com a espada</span>
      <kbd>Mouse</kbd><span>girar a câmera (clique no jogo pra travar o cursor)</span>
      <kbd>Roda</kbd><span>zoom</span>
      <kbd>E</kbd><span>entrar / interagir</span>
      <kbd>M</kbd><span>mapa e viagem rápida</span>
      <kbd>Esc</kbd><span>fechar janela / soltar o cursor</span>
    </div>
    <p class="muted">No celular: arraste o lado esquerdo para andar e o direito para girar a câmera.</p>
    <p class="muted">A vila não tem muros: siga as placas ou saia pelos campos até as montanhas.</p>`
}

export const PANELS: Record<PanelId, Renderer> = { sobre, projetos, blog, observatorio, api, contato, ajuda }
