// Conteúdo estático do portfólio, compartilhado pelo jogo (vila 3D) e pelo site.
// Edite aqui seus dados, projetos e links. Itens marcados com MOCK são exemplos para substituir.

export const profile = {
  name: 'Eric Romero',
  role: 'Desenvolvedor Back-end',
  location: 'Brasil · remoto', // MOCK
  available: true, // aparece como "disponível para projetos"
  // TODO: escreva sua bio
  bio: [
    'Bem-vindo à vila! Aqui cada casa guarda uma parte do meu trabalho.',
    'Sou desenvolvedor focado em back-end com Node.js e TypeScript, arquitetura limpa e infraestrutura em nuvem.',
  ],
  // frase curta pro topo do site
  pitch: 'Construo back-ends que aguentam o mundo real: bem modelados, observáveis e prontos pra escalar.',
  skills: [
    'TypeScript', 'Node.js', 'NestJS', 'DDD', 'Clean Architecture', 'PostgreSQL', 'Prisma',
    'AWS (SQS, S3, Lambda, CDK)', 'RabbitMQ', 'Stripe', 'Prometheus', 'Grafana', 'Docker', 'Jest', 'GitHub Actions',
  ],
  // as mesmas habilidades, agrupadas pro site
  skillGroups: [
    { title: 'Linguagens & frameworks', items: ['TypeScript', 'Node.js', 'NestJS', 'Three.js', 'Next.js'] },
    { title: 'Arquitetura', items: ['DDD', 'Clean Architecture', 'Eventos de domínio', 'Mensageria'] },
    { title: 'Dados', items: ['PostgreSQL', 'Prisma', 'Redis'] },
    { title: 'Nuvem & infra', items: ['AWS (SQS, S3, Lambda, CDK)', 'RabbitMQ', 'Docker', 'GitHub Actions'] },
    { title: 'Observabilidade', items: ['Prometheus', 'Grafana', 'Logs estruturados'] },
    { title: 'Qualidade', items: ['Jest', 'Testes E2E', 'CI com Postgres real'] },
  ],
  // MOCK: números do topo do site
  stats: [
    { label: 'anos programando', value: '4+' },
    { label: 'projetos publicados', value: '6' },
    { label: 'testes automatizados', value: '480+' },
    { label: 'uptime da API', value: '99,9%' },
  ],
}

export interface Experience {
  period: string
  role: string
  company: string
  description: string
  tags: string[]
}

// MOCK: troque pela sua trajetória
export const experience: Experience[] = [
  {
    period: '2024 — hoje',
    role: 'Desenvolvedor Back-end',
    company: 'Empresa Exemplo',
    description: 'APIs em NestJS com DDD, pagamentos com Stripe e mensageria com SQS. Reduzi a latência p95 das rotas críticas pela metade.',
    tags: ['NestJS', 'AWS', 'Stripe'],
  },
  {
    period: '2022 — 2024',
    role: 'Desenvolvedor Full-stack',
    company: 'Startup Exemplo',
    description: 'Do banco ao front: modelagem em PostgreSQL, filas com RabbitMQ e painéis internos em React.',
    tags: ['Node.js', 'PostgreSQL', 'RabbitMQ'],
  },
  {
    period: '2021 — 2022',
    role: 'Estagiário de Desenvolvimento',
    company: 'Agência Exemplo',
    description: 'Primeiros sistemas em produção, CI no GitHub Actions e muita leitura de código alheio.',
    tags: ['JavaScript', 'Docker', 'CI'],
  },
]

export type ProjectStatus = 'Em produção' | 'Em desenvolvimento' | 'Concluído'
export type ProjectCategory = 'Back-end' | 'Front-end' | 'Infra' | 'Jogo'

export interface Project {
  name: string
  description: string
  tags: string[]
  highlights?: string[]
  repo?: string
  url?: string
  // campos usados pelo site
  slug: string
  year: number
  status: ProjectStatus
  category: ProjectCategory
  role: string
  featured?: boolean
  metrics?: { label: string; value: string }[]
  // seções da página do projeto
  story?: { title: string; body: string }[]
}

// TODO: adicione seus outros projetos e os links dos repositórios (os marcados MOCK são exemplos)
export const projects: Project[] = [
  {
    slug: 'portfolio-api',
    name: 'Portfolio API',
    description: 'O back-end que alimenta esta vila: blog, contas, chat com IA, pagamentos e observabilidade.',
    tags: ['NestJS', 'DDD', 'Prisma', 'PostgreSQL', 'AWS', 'Stripe'],
    year: 2026,
    status: 'Em produção',
    category: 'Back-end',
    role: 'Autor · arquitetura, código e deploy',
    featured: true,
    highlights: [
      'Clean Architecture + DDD, com Either e eventos de domínio',
      'Pagamentos desacoplados da Stripe (assinatura, portal e webhook idempotente)',
      'Mensageria com SQS e RabbitMQ (DLX, quorum queue, confirm channel)',
      'Deploy em Lambda + API Gateway via CDK, RDS PostgreSQL',
      'Métricas Prometheus + dashboard Grafana provisionado',
      'Testes unitários e E2E com Postgres real no CI',
    ],
    metrics: [
      { label: 'latência p95', value: '84 ms' }, // MOCK
      { label: 'cobertura de testes', value: '92%' }, // MOCK
      { label: 'endpoints', value: '28' }, // MOCK
    ],
    story: [
      {
        title: 'O problema',
        body: 'Um portfólio que não fosse só vitrine: precisava de um back-end de verdade, com contas, conteúdo, pagamentos e métricas, mostrando como eu construo sistemas no dia a dia.',
      },
      {
        title: 'A solução',
        body: 'Domínio isolado em casos de uso puros, com a infraestrutura plugada por adaptadores. A Stripe fica atrás de uma porta de pagamentos, os eventos de domínio saem por SQS e RabbitMQ, e cada rota expõe métricas para o Prometheus.',
      },
      {
        title: 'O resultado',
        body: 'Uma API que roda em Lambda com custo quase zero parada, documentada automaticamente pelo Swagger e com um dashboard Grafana que mostra tudo o que acontece nela.',
      },
    ],
  },
  {
    slug: 'vila-do-portfolio',
    name: 'Vila do Portfólio',
    description: 'Este jogo: um mundo 3D explorável onde cada setor do portfólio é um lugar da vila.',
    tags: ['Three.js', 'TypeScript', 'Next.js'],
    year: 2026,
    status: 'Em desenvolvimento',
    category: 'Jogo',
    role: 'Autor · game design, 3D e código',
    featured: true,
    highlights: [
      'Personagem em terceira pessoa com pulo, corrida, colisão e combo de espada',
      'Terreno procedural, mapa com viagem rápida e minimapa',
      'Painéis que consomem a API real (blog, métricas e Swagger)',
    ],
    metrics: [
      { label: 'linhas de Three.js', value: '2,3 mil' },
      { label: 'modelos importados', value: '0' },
      { label: 'setores na vila', value: '6' },
    ],
    story: [
      {
        title: 'A ideia',
        body: 'Transformar a leitura de um portfólio num passeio: cada casa da vila é uma seção, e o visitante descobre o conteúdo andando.',
      },
      {
        title: 'Como foi feito',
        body: 'Tudo é desenhado em código com primitivas do Three.js: personagem com membros em pivôs, animações procedurais, marcas no chão que seguem o relevo e um combo de espada com detecção de contato.',
      },
    ],
  },
  {
    slug: 'ledger-pagamentos',
    name: 'Ledger de Pagamentos', // MOCK
    description: 'Serviço de cobrança recorrente com livro-razão imutável, outbox transacional e conciliação diária.',
    tags: ['Node.js', 'PostgreSQL', 'Stripe', 'Outbox'],
    year: 2025,
    status: 'Concluído',
    category: 'Back-end',
    role: 'Back-end · modelagem e integrações',
    highlights: [
      'Lançamentos em partidas dobradas, nunca atualizados, só compensados',
      'Outbox transacional garante que nenhum evento se perde',
      'Conciliação automática com os repasses da Stripe',
    ],
    metrics: [
      { label: 'transações/mês', value: '120 mil' },
      { label: 'divergências', value: '0' },
    ],
    story: [
      {
        title: 'O problema',
        body: 'Cobranças duplicadas e saldos que não batiam com os repasses do gateway.',
      },
      {
        title: 'A solução',
        body: 'Um ledger append-only em PostgreSQL, chaves de idempotência em todas as escritas e um job diário que concilia cada centavo com a Stripe.',
      },
    ],
  },
  {
    slug: 'fila-resiliente',
    name: 'Fila Resiliente', // MOCK
    description: 'Biblioteca de workers para RabbitMQ com retry exponencial, dead-letter e confirmação de publicação.',
    tags: ['TypeScript', 'RabbitMQ', 'Biblioteca'],
    year: 2025,
    status: 'Concluído',
    category: 'Infra',
    role: 'Autor · open source',
    highlights: [
      'Retry com backoff exponencial via filas de espera com TTL',
      'Dead-letter exchange com inspeção e reprocessamento',
      'Publisher confirms e quorum queues por padrão',
    ],
    metrics: [{ label: 'mensagens/s no benchmark', value: '18 mil' }],
  },
  {
    slug: 'observabilidade-em-caixa',
    name: 'Observabilidade em Caixa', // MOCK
    description: 'Template de Prometheus + Grafana + Loki pronto pra qualquer API Node, com dashboards provisionados.',
    tags: ['Prometheus', 'Grafana', 'Docker'],
    year: 2024,
    status: 'Concluído',
    category: 'Infra',
    role: 'Autor',
    highlights: [
      'Um docker compose sobe tudo com dashboards e alertas prontos',
      'Métricas RED (rate, errors, duration) por rota',
      'Painel de event loop, heap e GC para Node.js',
    ],
  },
  {
    slug: 'encurtador-serverless',
    name: 'Encurtador Serverless', // MOCK
    description: 'Encurtador de links em Lambda + DynamoDB com analytics de cliques em tempo real.',
    tags: ['AWS Lambda', 'DynamoDB', 'CDK'],
    year: 2024,
    status: 'Em produção',
    category: 'Back-end',
    role: 'Autor',
    highlights: [
      'Infra 100% em CDK, deploy por pull request',
      'Redirecionamento em menos de 20 ms na borda',
      'Contagem de cliques agregada por stream do DynamoDB',
    ],
    metrics: [{ label: 'custo mensal', value: 'US$ 0,40' }],
  },
]

// TODO: preencha seus links (deixe vazio para esconder)
export const contacts: { label: string; value: string; href: string }[] = [
  { label: 'GitHub', value: 'github.com/seu-usuario', href: 'https://github.com/' },
  { label: 'LinkedIn', value: 'linkedin.com/in/seu-perfil', href: 'https://www.linkedin.com/' },
  { label: 'E-mail', value: 'voce@exemplo.com', href: 'mailto:voce@exemplo.com' }, // MOCK
]
