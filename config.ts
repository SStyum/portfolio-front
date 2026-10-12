// URLs externas (configuráveis por .env, ver .env.example)
export const API_URL = (import.meta.env?.VITE_API_URL ?? 'http://localhost:3333').replace(/\/$/, '')
export const GRAFANA_URL = (import.meta.env?.VITE_GRAFANA_URL ?? 'http://localhost:3000').replace(/\/$/, '')
export const PROMETHEUS_URL = (import.meta.env?.VITE_PROMETHEUS_URL ?? 'http://localhost:9090').replace(/\/$/, '')

// uid do dashboard provisionado em portfolio-back/monitoring/grafana/dashboards/portfolio-api.json
export const GRAFANA_DASHBOARD_URL = `${GRAFANA_URL}/d/portfolio-api`
export const SWAGGER_URL = `${API_URL}/docs`
