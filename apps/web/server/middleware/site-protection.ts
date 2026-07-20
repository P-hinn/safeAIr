import {
  defineEventHandler,
  getRequestHeader,
  getRequestPath,
  sendRedirect,
  setResponseHeader,
  setResponseStatus
} from 'h3'
import {
  hasValidSession,
  protectionConfigured,
  protectionRequired
} from '../utils/site-auth'

const PUBLIC_PATHS = new Set([
  '/login',
  '/auth/login',
  '/auth/logout',
  '/__health',
  '/robots.txt'
])

const robotsDirective = 'noindex, nofollow, noarchive, nosnippet, noimageindex'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'X-Robots-Tag', robotsDirective)
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(self), geolocation=()')

  const path = getRequestPath(event).split('?')[0]
  if (PUBLIC_PATHS.has(path)) return
  if (!protectionRequired()) return

  setResponseHeader(event, 'Cache-Control', 'no-store, private')

  if (!protectionConfigured()) {
    setResponseStatus(event, 503)
    return 'Der Zugangsschutz ist noch nicht konfiguriert. Bitte SITE_PASSWORD als verschlüsselte Runtime-Variable setzen.'
  }

  if (hasValidSession(event)) return

  const acceptsHtml = getRequestHeader(event, 'accept')?.includes('text/html')
  if (acceptsHtml) {
    const next = encodeURIComponent(path)
    return sendRedirect(event, `/login?next=${next}`, 302)
  }

  setResponseStatus(event, 401)
  return { error: 'authentication_required' }
})
