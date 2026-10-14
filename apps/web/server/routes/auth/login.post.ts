import {
  defineEventHandler,
  getRequestHeader,
  getRequestIP,
  readFormData,
  sendRedirect,
  setResponseHeader,
  setResponseStatus,
  type H3Event
} from 'h3'
import {
  passwordMatches,
  protectionConfigured,
  safeNextPath,
  setSession
} from '../../utils/site-auth'

const attemptWindowMs = 10 * 60 * 1000
const maximumAttempts = 8
const maximumTrackedClients = 10_000
// X-Forwarded-For ist vom Client fälschbar. Hinter einem vertrauenswürdigen
// Reverse Proxy zählt deshalb nur der letzte, vom Proxy angehängte Eintrag.
const trustProxy = process.env.TRUST_PROXY === 'true'

function clientAddress(event: H3Event) {
  if (trustProxy) {
    const forwarded = getRequestHeader(event, 'x-forwarded-for')?.split(',').at(-1)?.trim()
    if (forwarded) return forwarded
  }
  return getRequestIP(event) ?? 'unknown'
}
const attempts = new Map<string, { count: number; resetAt: number }>()

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (!protectionConfigured()) {
    setResponseStatus(event, 503)
    return { error: 'protection_not_configured' }
  }

  const form = await readFormData(event)
  const password = String(form.get('password') ?? '')
  const next = safeNextPath(form.get('next'))
  const client = clientAddress(event)
  const now = Date.now()
  for (const [key, value] of attempts) {
    if (value.resetAt <= now) attempts.delete(key)
  }
  const previous = attempts.get(client)
  const current = !previous || previous.resetAt <= now
    ? { count: 0, resetAt: now + attemptWindowMs }
    : previous

  if (current.count >= maximumAttempts) {
    return sendRedirect(event, `/login?error=locked&next=${encodeURIComponent(next)}`, 303)
  }

  if (!passwordMatches(password)) {
    if (!attempts.has(client) && attempts.size >= maximumTrackedClients) {
      return sendRedirect(event, `/login?error=locked&next=${encodeURIComponent(next)}`, 303)
    }
    attempts.set(client, { ...current, count: current.count + 1 })
    return sendRedirect(event, `/login?error=invalid&next=${encodeURIComponent(next)}`, 303)
  }

  attempts.delete(client)
  setSession(event)
  return sendRedirect(event, next, 303)
})
