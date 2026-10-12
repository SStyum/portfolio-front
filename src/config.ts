// URLs externas (configuráveis por .env, ver .env.example)
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace(/\/$/, '')
export const GRAFANA_URL = (process.env.NEXT_PUBLIC_GRAFANA_URL ?? 'http://localhost:3000').replace(/\/$/, '')
export const PROMETHEUS_URL = (process.env.NEXT_PUBLIC_PROMETHEUS_URL ?? 'http://localhost:9090').replace(/\/$/, '')

// uid do dashboard provisionado em portfolio-back/monitoring/grafana/dashboards/portfolio-api.json
export const GRAFANA_DASHBOARD_URL = `${GRAFANA_URL}/d/portfolio-api`
export const SWAGGER_URL = `${API_URL}/docs`
