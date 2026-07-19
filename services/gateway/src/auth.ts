import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const sessionCookie = 'safair_session'

function sitePassword() {
  return process.env.SITE_PASSWORD ?? ''
}

export function protectionConfigured() {
  return sitePassword().length >= 12
}

function safeEqual(left: string, right: string) {
  const leftHash = createHash('sha256').update(left).digest()
  const rightHash = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftHash, rightHash)
}

function signature(payload: string) {
  return createHmac('sha256', `safair-session:${sitePassword()}`)
    .update(payload)
    .digest('base64url')
}

function sessionToken(cookieHeader?: string) {
  if (!cookieHeader) return undefined
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=')
    if (separator < 0) continue
    const name = cookie.slice(0, separator).trim()
    if (name !== sessionCookie) continue
    return decodeURIComponent(cookie.slice(separator + 1).trim())
  }
  return undefined
}

export function hasValidSession(cookieHeader?: string) {
  const token = sessionToken(cookieHeader)
  if (!token || !protectionConfigured()) return false

  const [payload, suppliedSignature, extra] = token.split('.')
  if (!payload || !suppliedSignature || extra || !safeEqual(signature(payload), suppliedSignature)) return false

  try {
    const expiresAt = Number(Buffer.from(payload, 'base64url').toString('utf8'))
    return Number.isFinite(expiresAt) && expiresAt > Date.now()
  } catch {
    return false
  }
}
