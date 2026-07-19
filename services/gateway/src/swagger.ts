import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'
import { openApiDocument, swaggerTheme } from './openapi.js'

const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#171714"/>
  <path d="M16 20h32v24H16z" fill="none" stroke="#d8ff55" stroke-width="3"/>
  <path d="M24 32h16M32 24v16" stroke="#5c76ff" stroke-width="3"/>
</svg>`

export async function registerApiDocumentation(app: FastifyInstance) {
  // Swagger must be registered before application routes. The visible document
  // is intentionally curated because most public routes are reverse proxies.
  await app.register(swagger, {
    openapi: {
      info: {
        title: openApiDocument.info.title,
        version: openApiDocument.info.version
      }
    }
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    staticCSP: true,
    validatorUrl: false,
    uiConfig: {
      deepLinking: true,
      displayOperationId: false,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      operationsSorter: 'method',
      tagsSorter: 'alpha',
      tryItOutEnabled: true,
      defaultModelsExpandDepth: 1,
      syntaxHighlight: { activate: true, theme: 'monokai' }
    },
    transformSpecification: () => openApiDocument,
    transformSpecificationClone: false,
    theme: {
      title: 'safAIr API Reference',
      css: [{ filename: 'safair-theme.css', content: swaggerTheme }]
    },
    logo: {
      type: 'image/svg+xml',
      content: Buffer.from(logo),
      href: '/docs/',
      target: '_self'
    }
  })

  app.get('/openapi.json', { schema: { hide: true } }, async (_request, reply) => {
    return reply.type('application/json; charset=utf-8').send(openApiDocument)
  })
}
