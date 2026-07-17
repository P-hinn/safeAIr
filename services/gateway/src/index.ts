import Fastify from 'fastify'
import cors from '@fastify/cors'
import proxy from '@fastify/http-proxy'
import { config } from './config.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: config.corsOrigins })

// Proxy-Routen: /api/<service>/* -> <service-url>/*
for (const svc of config.services) {
  await app.register(proxy, {
    upstream: svc.url,
    prefix: svc.prefix,
    rewritePrefix: ''
  })
}

// Aggregierter Health-Check
app.get('/health', async () => {
  const services: Record<string, { status: string }> = {}

  await Promise.all(
    config.services.map(async (svc) => {
      try {
        const res = await fetch(`${svc.url}/health`, {
          signal: AbortSignal.timeout(3000)
        })
        services[svc.name] = { status: res.ok ? 'ok' : 'degraded' }
      } catch {
        services[svc.name] = { status: 'down' }
      }
    })
  )

  const allOk = Object.values(services).every((s) => s.status === 'ok')
  return { status: allOk ? 'ok' : 'degraded', service: 'gateway', services }
})

try {
  await app.listen({ port: config.port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
