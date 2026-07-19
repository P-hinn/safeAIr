import {
  defineEventHandler,
  getQuery,
  sendRedirect,
  setResponseHeader,
  setResponseStatus
} from 'h3'
import {
  hasValidSession,
  protectionConfigured,
  safeNextPath
} from '../utils/site-auth'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const next = safeNextPath(query.next)
  if (hasValidSession(event)) return sendRedirect(event, next, 302)

  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-store, private')
  setResponseHeader(event, 'Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
  setResponseHeader(event, 'X-Frame-Options', 'DENY')

  if (!protectionConfigured()) setResponseStatus(event, 503)

  const error = query.error === 'locked'
    ? 'Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.'
    : query.error
      ? 'Das Passwort ist nicht korrekt.'
      : ''
  const configurationError = !protectionConfigured()
    ? 'Der Schutz ist noch nicht konfiguriert. Setze SITE_PASSWORD mit mindestens 12 Zeichen.'
    : ''

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex">
  <title>Zugang · safAIr</title>
  <style>
    :root{color-scheme:light;--ink:#171714;--soft:#575750;--paper:#f1efe8;--line:rgba(23,23,20,.2);--blue:#5c76ff;--acid:#d8ff55;font-family:"Helvetica Neue",Arial,sans-serif;background:var(--paper);color:var(--ink)}*{box-sizing:border-box}body{min-height:100vh;margin:0;background:radial-gradient(circle at 72% 32%,rgba(92,118,255,.13),transparent 30%),var(--paper);-webkit-font-smoothing:antialiased}body:after{content:"";position:fixed;inset:0;pointer-events:none;opacity:.14;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.14'/%3E%3C/svg%3E");mix-blend-mode:multiply}.site-header{height:78px;padding:0 clamp(18px,3vw,46px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:12px}.mark{width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--ink);background:var(--ink);color:var(--acid);font-size:12px;font-weight:800}.brand strong{display:block;font-size:19px;line-height:.95;letter-spacing:-.8px}.brand strong span{color:var(--blue)}.brand small{display:block;margin-top:5px;color:var(--soft);font-size:8px;font-weight:700;letter-spacing:1.25px;text-transform:uppercase}.header-status{display:flex;align-items:center;gap:8px;color:var(--soft);font-size:9px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.header-status i,.security i{width:7px;height:7px;border:1px solid var(--ink);border-radius:50%;background:var(--acid)}main{min-height:calc(100vh - 78px);padding:clamp(36px,6vw,90px) clamp(18px,3vw,46px) 30px;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(340px,.6fr);gap:clamp(42px,8vw,130px);align-items:center}.intro{align-self:stretch;display:flex;justify-content:center;flex-direction:column;border-bottom:1px solid var(--line)}.eyebrow{margin:0 0 22px;color:var(--blue);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.intro h1{max-width:8ch;margin:0;font-size:clamp(62px,8.2vw,132px);font-weight:500;letter-spacing:-.075em;line-height:.78}.intro-copy{max-width:580px;margin:44px 0 0;color:var(--soft);font-size:clamp(16px,1.5vw,21px);line-height:1.55}.login-panel{padding:clamp(26px,3vw,42px);border:1px solid var(--ink);border-top:4px solid var(--blue);background:rgba(248,246,239,.9)}.panel-code{display:flex;justify-content:space-between;color:var(--blue);font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.login-panel h2{max-width:9ch;margin:60px 0 14px;font-size:clamp(36px,4vw,58px);font-weight:500;letter-spacing:-.065em;line-height:.9}.login-panel>p{margin:0;color:var(--soft);font-size:13px;line-height:1.6}.field{margin-top:32px;display:grid;gap:8px}.field span{color:var(--soft);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}input{width:100%;height:52px;padding:0 2px;border:0;border-bottom:1px solid var(--ink);border-radius:0;background:transparent;color:var(--ink);font:inherit;outline:none}input:focus{border-color:var(--blue);box-shadow:0 3px 0 rgba(92,118,255,.15)}button{width:100%;height:52px;margin-top:18px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;border:1px solid var(--ink);border-radius:999px;background:var(--ink);color:var(--paper);font:inherit;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:180ms}button:hover{background:var(--acid);color:var(--ink)}.message{margin-top:18px;padding:12px;border:1px solid #b83434;background:rgba(184,52,52,.06);color:#a62f2f;font-size:11px;line-height:1.5}.security{margin-top:28px;padding-top:18px;border-top:1px solid var(--line);display:flex;align-items:center;gap:9px;color:var(--soft);font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}@media(max-width:900px){main{grid-template-columns:1fr;align-items:start}.intro{min-height:42vh;padding-bottom:36px}.login-panel{width:min(560px,100%)}.intro h1{font-size:clamp(58px,14vw,96px)}}@media(max-width:520px){.header-status{display:none}.site-header{height:68px}main{min-height:calc(100vh - 68px);padding-top:32px;gap:32px}.intro{min-height:0}.intro h1{font-size:52px}.intro-copy{margin-top:26px;font-size:14px}.login-panel h2{margin-top:42px;font-size:38px}}
  </style>
  <style>
    body{overflow-x:hidden}main,.intro,.login-panel{min-width:0;max-width:100%}.intro-copy{max-width:100%;overflow-wrap:anywhere}@media(max-width:900px){main{grid-template-columns:minmax(0,1fr)}.login-panel{width:100%}}
  </style>
</head>
<body>
  <header class="site-header">
    <div class="brand"><span class="mark">sA</span><span><strong>saf<span>AI</span>r</strong><small>AI Governance</small></span></div>
    <span class="header-status"><i></i> Private Management Platform</span>
  </header>
  <main>
    <section class="intro">
      <p class="eyebrow">AI Governance · Process Intelligence · Operations</p>
      <h1>KI unter Kontrolle.</h1>
      <p class="intro-copy">Ein gemeinsames Systembild für Prozesse, KI-Tools, Risiken und den operativen Zustand der gesamten Plattform.</p>
    </section>
    <section class="login-panel">
      <div class="panel-code"><span>Secure Access</span><span>01 / 01</span></div>
      <h2>Workspace öffnen.</h2>
      <p>Bitte gib das zentrale Zugangspasswort ein.</p>
      ${error || configurationError ? `<div class="message">${escapeHtml(error || configurationError)}</div>` : ''}
      ${protectionConfigured() ? `<form method="post" action="/auth/login">
        <input type="hidden" name="next" value="${escapeHtml(next)}">
        <label class="field"><span>Passwort</span><input name="password" type="password" autocomplete="current-password" required autofocus></label>
        <button type="submit"><span>Einloggen</span><span aria-hidden="true">↗</span></button>
      </form>` : ''}
      <div class="security"><i></i> Geschützte Session · 12 Stunden</div>
    </section>
  </main>
</body>
</html>`
})
