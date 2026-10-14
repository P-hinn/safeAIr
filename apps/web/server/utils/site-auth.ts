import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  setCookie,
  type H3Event
} from 'h3'

export const SESSION_COOKIE = 'safair_session'
export const SESSION_DURATION_SECONDS = 12 * 60 * 60

export function sitePassword() {
  return process.env.SITE_PASSWORD ?? ''
}

// Separater, zufälliger Schlüssel: Würde das Passwort selbst signieren, ließe es
// sich aus einem einzigen Session-Cookie offline per Brute Force ermitteln.
function sessionSecret() {
  return process.env.SESSION_SECRET ?? ''
}

export function protectionRequired() {
  return process.env.NODE_ENV === 'production' || Boolean(sitePassword())
}

export function protectionConfigured() {
  return sitePassword().length >= 12 && sessionSecret().length >= 32
}

function signature(payload: string) {
  return createHmac('sha256', sessionSecret())
    .update(payload)
    .digest('base64url')
}

function safeEqual(left: string, right: string) {
  const leftHash = createHash('sha256').update(left).digest()
  const rightHash = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftHash, rightHash)
}

export function passwordMatches(candidate: string) {
  return protectionConfigured() && safeEqual(candidate, sitePassword())
}

export function createSessionToken(now = Date.now()) {
  const payload = Buffer.from(String(now + SESSION_DURATION_SECONDS * 1000)).toString('base64url')
  return `${payload}.${signature(payload)}`
}

export function verifySessionToken(token?: string) {
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

export function hasValidSession(event: H3Event) {
  return verifySessionToken(getCookie(event, SESSION_COOKIE))
}

function requestUsesHttps(event: H3Event) {
  if (process.env.COOKIE_SECURE === 'true') return true
  const forwardedProtocol = getRequestHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim()
  return forwardedProtocol === 'https'
}

export function setSession(event: H3Event) {
  setCookie(event, SESSION_COOKIE, createSessionToken(), {
    path: '/',
    httpOnly: true,
    secure: requestUsesHttps(event),
    sameSite: 'strict',
    maxAge: SESSION_DURATION_SECONDS
  })
}

export function clearSiteSession(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: requestUsesHttps(event),
    sameSite: 'strict'
  })
}

export function safeNextPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/'
  if (value.startsWith('/login') || value.startsWith('/auth/')) return '/'
  return value
}
