// Conteúdo estático do portfólio. Edite aqui seus dados, projetos e links.

export const profile = {
  name: 'Eric Romero',
  role: 'Desenvolvedor Back-end',
  // TODO: escreva sua bio
  bio: [
    'Bem-vindo à vila! Aqui cada casa guarda uma parte do meu trabalho.',
    'Sou desenvolvedor focado em back-end com Node.js e TypeScript, arquitetura limpa e infraestrutura em nuvem.',
  ],
  skills: [
    'TypeScript', 'Node.js', 'NestJS', 'DDD', 'Clean Architecture', 'PostgreSQL', 'Prisma',
    'AWS (SQS, S3, Lambda, CDK)', 'RabbitMQ', 'Stripe', 'Prometheus', 'Grafana', 'Docker', 'Jest', 'GitHub Actions',
  ],
}

export interface Project {
  name: string
  description: string
  tags: string[]
  highlights?: string[]
  repo?: string
  url?: string
}

// TODO: adicione seus outros projetos e os links dos repositórios
export const projects: Project[] = [
  {
    name: 'Portfolio API',
    description: 'O back-end que alimenta esta vila: blog, contas, chat com IA, pagamentos e observabilidade.',
    tags: ['NestJS', 'DDD', 'Prisma', 'PostgreSQL', 'AWS', 'Stripe'],
    highlights: [
      'Clean Architecture + DDD, com Either e eventos de domínio',
      'Pagamentos desacoplados da Stripe (assinatura, portal e webhook idempotente)',
      'Mensageria com SQS e RabbitMQ (DLX, quorum queue, confirm channel)',
      'Deploy em Lambda + API Gateway via CDK, RDS PostgreSQL',
      'Métricas Prometheus + dashboard Grafana provisionado',
      'Testes unitários e E2E com Postgres real no CI',
    ],
  },
  {
    name: 'Vila do Portfólio',
    description: 'Este jogo: um mundo 3D explorável onde cada setor do portfólio é um lugar da vila.',
    tags: ['Three.js', 'TypeScript', 'Vite'],
    highlights: [
      'Personagem em terceira pessoa com pulo, corrida e colisão',
      'Terreno procedural, mapa com viagem rápida e minimapa',
      'Painéis que consomem a API real (blog, métricas e Swagger)',
    ],
  },
]

// TODO: preencha seus links (deixe vazio para esconder)
export const contacts: { label: string; value: string; href: string }[] = [
  { label: 'GitHub', value: 'github.com/seu-usuario', href: 'https://github.com/' },
  { label: 'LinkedIn', value: 'linkedin.com/in/seu-perfil', href: 'https://www.linkedin.com/' },
]
