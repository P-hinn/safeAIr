export interface UpstreamService {
  /** Name im aggregierten Health-Report */
  name: string
  /** Prefix, unter dem der Service am Gateway erreichbar ist */
  prefix: string
  /** Basis-URL des Services */
  url: string
}

export const config = {
  port: Number(process.env.GATEWAY_PORT ?? 8080),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  services: [
    {
      name: 'pii-service',
      prefix: '/api/pii',
      url: process.env.PII_SERVICE_URL ?? 'http://localhost:8001'
    },
    {
      name: 'guardrails-service',
      prefix: '/api/guardrails',
      url: process.env.GUARDRAILS_SERVICE_URL ?? 'http://localhost:8002'
    }
    // Neue Services hier registrieren (Muster: name, prefix, url)
  ] satisfies UpstreamService[]
}
