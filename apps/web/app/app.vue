<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const mobileNavOpen = ref(false)
const sidebarCollapsed = ref(false)
const onboardingTour = ref<{ start: () => void }>()
let collapsedBeforeTour = false

const apiDocsUrl = computed(() => {
  const apiBase = String(config.public.apiBase || '').replace(/\/+$/, '')
  return apiBase ? `${apiBase}/docs/` : '/docs/'
})

const navigation = [
  {
    label: 'Übersicht',
    items: [
      { to: '/', label: 'Management Dashboard', icon: 'dashboard' },
      { to: '/process-map', label: 'Prozesslandkarte', icon: 'process' },
      { to: '/monitoring', label: 'Monitoring', icon: 'monitoring' }
    ]
  },
  {
    label: 'Governance',
    items: [
      { to: '/policies', label: 'Policies', icon: 'policy' },
      { to: '/tools', label: 'AI-Tool-Katalog', icon: 'tools' }
    ]
  },
  {
    label: 'Kontrollen & Tests',
    items: [
      { to: '/playground', label: 'Playground', icon: 'play' },
      { to: '/pii', label: 'Datenschutz (PII)', icon: 'shield' },
      { to: '/guardrails', label: 'Guardrails', icon: 'guardrail' },
      { to: '/moderation', label: 'Moderation', icon: 'moderation' },
      { to: '/redteam', label: 'Red Teaming', icon: 'redteam' }
    ]
  }
]

const pageTitle = computed(() => {
  for (const group of navigation) {
    const match = group.items.find((item) => item.to === route.path)
    if (match) return match.label
  }
  return 'safAIr'
})

watch(() => route.path, () => { mobileNavOpen.value = false })

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function handleTourNavigation(visible: boolean) {
  if (visible) {
    collapsedBeforeTour = sidebarCollapsed.value
    sidebarCollapsed.value = false
    if (window.innerWidth <= 980) mobileNavOpen.value = true
  } else {
    mobileNavOpen.value = false
    sidebarCollapsed.value = collapsedBeforeTour
  }
}

onMounted(() => {
  try { sidebarCollapsed.value = localStorage.getItem('safair:sidebar-collapsed') === 'true' } catch { /* optional preference */ }
})

watch(sidebarCollapsed, (value) => {
  if (!import.meta.client) return
  try { localStorage.setItem('safair:sidebar-collapsed', String(value)) } catch { /* optional preference */ }
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--collapsed': sidebarCollapsed }">
    <div v-if="mobileNavOpen" class="nav-backdrop" @click="mobileNavOpen = false" />

    <aside class="sidebar" data-onboarding="sidebar-shell" :class="{ 'sidebar--open': mobileNavOpen, 'sidebar--collapsed': sidebarCollapsed }">
      <div class="brand-block">
        <NuxtLink to="/" class="brand" aria-label="safAIr Startseite">
          <span class="brand-mark">sA</span>
          <span>
            <strong>saf<span>AI</span>r</strong>
            <small>AI Governance</small>
          </span>
        </NuxtLink>
        <button class="mobile-close" aria-label="Navigation schließen" @click="mobileNavOpen = false">×</button>
        <button class="sidebar-collapse" data-onboarding="sidebar-collapse" :aria-label="sidebarCollapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'" :title="sidebarCollapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'" @click="toggleSidebar">{{ sidebarCollapsed ? '›' : '‹' }}</button>
      </div>

      <nav class="side-nav" aria-label="Hauptnavigation">
        <section
          v-for="group in navigation"
          :key="group.label"
          class="nav-group"
          :data-onboarding="group.label === 'Governance' ? 'governance-group' : undefined"
        >
          <p class="nav-group-label">{{ group.label }}</p>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :title="sidebarCollapsed ? item.label : undefined"
            :data-onboarding="item.to === '/' ? 'dashboard-link' : item.to === '/process-map' ? 'process-map-link' : item.to === '/monitoring' ? 'monitoring-link' : undefined"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <template v-if="item.icon === 'dashboard'">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </template>
              <template v-else-if="item.icon === 'process'">
                <rect x="2" y="8" width="5" height="8" rx="1.5" /><rect x="17" y="8" width="5" height="8" rx="1.5" />
                <circle cx="12" cy="12" r="2.5" /><path d="M7 12h2.5M14.5 12H17" />
              </template>
              <template v-else-if="item.icon === 'monitoring'">
                <path d="M3 12h4l2-6 4 12 2-6h6" /><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
              </template>
              <template v-else-if="item.icon === 'policy'">
                <path d="M7 3h8l4 4v14H7z" /><path d="M15 3v5h4M10 12h6M10 16h6" />
              </template>
              <template v-else-if="item.icon === 'tools'">
                <path d="M14.5 6.5a4 4 0 0 0-5-5l2 2-3 3-2-2a4 4 0 0 0 5 5L19 17l-2 2-7.5-7.5" />
              </template>
              <template v-else-if="item.icon === 'play'">
                <path d="M8 5v14l11-7z" />
              </template>
              <template v-else-if="item.icon === 'shield'">
                <path d="M12 2 4 5v6c0 5.2 3.3 9 8 11 4.7-2 8-5.8 8-11V5z" /><path d="M9 12l2 2 4-4" />
              </template>
              <template v-else-if="item.icon === 'guardrail'">
                <path d="M4 20V7M20 20V7M4 10h16M4 15h16M8 10v5M16 10v5" />
              </template>
              <template v-else-if="item.icon === 'moderation'">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="m9 9 6 6M15 9l-6 6" />
              </template>
              <template v-else>
                <path d="M12 3v3M4.2 7.5l2.6 1.5M4.2 16.5 6.8 15M12 21v-3M19.8 16.5 17.2 15M19.8 7.5 17.2 9" />
                <circle cx="12" cy="12" r="4" />
              </template>
            </svg>
            <span>{{ item.label }}</span>
          </NuxtLink>
        </section>
        <section class="nav-group">
          <p class="nav-group-label">Entwicklung</p>
          <a :href="apiDocsUrl" class="nav-item" data-onboarding="api-docs-link">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" />
            </svg>
            <span>API-Dokumentation</span>
          </a>
        </section>
      </nav>

      <div class="sidebar-footer">
        <div class="system-indicator"><span /> Systeme betriebsbereit</div>
        <p>Governance Workspace</p>
        <button
          class="onboarding-restart"
          data-onboarding="onboarding-restart"
          @click="onboardingTour?.start()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.5 2.5 0 0 1 4.8 1c0 2-2.5 2.1-2.5 4M12 18h.01" />
          </svg>
          Einführung starten
        </button>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="topbar-left">
          <button class="mobile-menu" aria-label="Navigation öffnen" @click="mobileNavOpen = true">
            <span /><span /><span />
          </button>
          <div>
            <span class="breadcrumb">safAIr /</span>
            <strong>{{ pageTitle }}</strong>
          </div>
        </div>
        <div class="topbar-actions">
          <NuxtLink to="/monitoring" class="topbar-link topbar-monitor"><span /> Live Monitoring</NuxtLink>
          <form action="/auth/logout" method="post" class="logout-form">
            <button class="user-avatar" title="Sicher abmelden" aria-label="Abmelden"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 3v8" /><path d="M6.3 6.8a8 8 0 1 0 11.4 0" /></svg><span>Abmelden</span></button>
          </form>
        </div>
      </header>

      <main class="main">
        <NuxtPage />
      </main>
    </div>

    <OnboardingTour
      ref="onboardingTour"
      :version="2"
      @navigation-visibility="handleTourNavigation"
    />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

:root {
  --ink: #171714;
  --ink-soft: #575750;
  --paper: #f3f1ea;
  --workspace: #f5f3ed;
  --sidebar: #dedbd1;
  --acid: #d8ff55;
  --blue: #5c76ff;
  --bg: var(--workspace);
  --surface: #fcfbf6;
  --surface-soft: #e8e5dc;
  --surface-muted: #efede6;
  --surface-raised: #fffef9;
  --border: rgba(23, 23, 20, 0.22);
  --border-strong: rgba(23, 23, 20, 0.42);
  --text: var(--ink);
  --muted: #66655e;
  --muted-light: #89877f;
  --accent: var(--blue);
  --accent-dark: #4159e8;
  --accent-soft: rgba(92, 118, 255, 0.11);
  --navy: var(--ink);
  --navy-soft: #282824;
  --ok: #168a5b;
  --ok-soft: #eaf8f1;
  --warn: #d98212;
  --warn-soft: #fff5e5;
  --err: #d64242;
  --err-soft: #fff0f0;
  --purple: #7557d3;
  --purple-soft: rgba(117, 87, 211, 0.1);
  --shadow-sm: none;
  --shadow-md: 0 24px 64px rgba(23, 23, 20, 0.14);
}

* { box-sizing: border-box; }

html { min-width: 320px; background: var(--paper); }

body {
  margin: 0;
  overflow-x: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: 'DM Sans', 'Helvetica Neue', Arial, sans-serif;
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}

button, input, select, textarea { font: inherit; }
button, a { -webkit-tap-highlight-color: transparent; }
a { color: inherit; }

.app-shell { min-height: 100vh; display: flex; position: relative; isolation: isolate; }
.app-shell::before { content: ''; position: fixed; z-index: 1000; inset: 0; pointer-events: none; opacity: .13; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.14'/%3E%3C/svg%3E"); mix-blend-mode: multiply; }

.sidebar {
  position: fixed;
  z-index: 30;
  inset: 0 auto 0 0;
  width: 244px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-strong);
  background: var(--sidebar);
  color: var(--ink);
  overflow-y: auto;
  transition: width 180ms ease, transform 200ms ease;
}

.sidebar--collapsed { width: 72px; overflow-x: hidden; }
.sidebar--collapsed .brand-block { padding-inline: 16px; justify-content: center; }
.sidebar--collapsed .brand > span:last-child, .sidebar--collapsed .nav-group-label, .sidebar--collapsed .nav-item > span, .sidebar--collapsed .system-indicator, .sidebar--collapsed .sidebar-footer > p { display: none; }
.sidebar--collapsed .side-nav { padding-inline: 9px; }
.sidebar--collapsed .nav-group + .nav-group { margin-top: 12px; }
.sidebar--collapsed .nav-item { padding: 0; justify-content: center; }
.sidebar--collapsed .sidebar-footer { padding: 12px 9px; }
.sidebar--collapsed .onboarding-restart { padding: 0; justify-content: center; font-size: 0; }
.sidebar-collapse { width: 25px; min-height: 31px; padding: 0; position: absolute; z-index: 2; top: 23px; right: -1px; border-radius: 16px 0 0 16px; border-color: var(--border-strong); background: var(--paper); color: var(--ink); font-size: 20px; }
.sidebar-collapse:hover { background: var(--acid); color: var(--ink); transform: none; }

.brand-block {
  min-height: 78px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-strong);
}

.brand { display: flex; align-items: center; gap: 11px; color: var(--ink); text-decoration: none; }
.brand-mark {
  width: 38px;
  height: 38px;
  border: 1px solid var(--ink);
  border-radius: 0;
  display: grid;
  place-items: center;
  background: var(--ink);
  color: var(--acid);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}
.brand strong { display: block; color: var(--ink); font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 650; line-height: .95; letter-spacing: -.8px; }
.brand strong span { color: var(--blue); }
.brand small { display: block; margin-top: 5px; color: #53524c; font-size: 10px; font-weight: 700; letter-spacing: 1.05px; text-transform: uppercase; }

.side-nav { padding: 18px 12px 24px; flex: 1; background: rgba(255,255,255,.12); }
.nav-group + .nav-group { margin-top: 23px; }
.nav-group-label { margin: 0 10px 8px; color: #354dcc; font-size: 10.5px; font-weight: 800; letter-spacing: 1.05px; text-transform: uppercase; }
.nav-item {
  min-height: 42px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 0;
  display: flex;
  align-items: center;
  gap: 11px;
  color: var(--ink-soft);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: .025em;
  text-decoration: none;
  transition: 160ms ease;
}
.nav-item:hover { border-color: rgba(23,23,20,.32); color: var(--ink); background: rgba(255,255,255,.46); }
.nav-item.router-link-active { border-color: var(--ink); color: var(--paper); background: var(--ink); box-shadow: inset 3px 0 var(--acid); }
.nav-icon { width: 17px; height: 17px; flex: 0 0 auto; }
.nav-item.router-link-active .nav-icon { color: var(--acid); }

.sidebar-footer { padding: 16px 20px 20px; border-top: 1px solid var(--border-strong); background: rgba(23,23,20,.055); }
.system-indicator { display: flex; align-items: center; gap: 8px; color: var(--ink); font-size: 10.5px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; }
.system-indicator span { width: 7px; height: 7px; border-radius: 50%; background: var(--acid); box-shadow: 0 0 0 1px var(--ink); }
.sidebar-footer p { margin: 8px 0 0 15px; color: #5c5a54; font-size: 10.5px; }
.onboarding-restart {
  width: 100%;
  min-height: 34px;
  margin-top: 14px;
  padding: 0 10px;
  justify-content: flex-start;
  border-color: var(--border-strong);
  border-radius: 0;
  background: rgba(255,255,255,.32);
  color: var(--ink);
  font-size: 9.5px;
}
.onboarding-restart:hover { border-color: var(--ink); background: var(--acid); color: var(--ink); transform: none; }
.onboarding-restart svg { width: 15px; height: 15px; flex: 0 0 auto; }

.workspace { width: calc(100% - 244px); min-width: 0; min-height: 100vh; margin-left: 244px; background: var(--workspace); transition: width 180ms ease, margin-left 180ms ease; }
.app-shell--collapsed .workspace { width: calc(100% - 72px); margin-left: 72px; }
.topbar {
  position: sticky;
  z-index: 20;
  top: 0;
  height: 70px;
  padding: 0 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(232,229,220,.94);
  border-bottom: 1px solid var(--border-strong);
  backdrop-filter: blur(18px);
}
.topbar-left { display: flex; align-items: center; gap: 13px; color: var(--text); font-size: 12px; font-weight: 750; letter-spacing: .045em; text-transform: uppercase; }
.breadcrumb { margin-right: 5px; color: var(--blue); font-weight: 800; }
.topbar-actions { display: flex; align-items: center; gap: 18px; }
.topbar-link { color: var(--ink); font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-decoration: none; text-transform: uppercase; }
.topbar-link:hover { color: var(--blue); }
.topbar-monitor { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-strong); border-radius: 999px; padding: 8px 11px; }
.topbar-monitor span { width: 7px; height: 7px; border-radius: 50%; background: var(--acid); box-shadow: 0 0 0 1px var(--ink); }
.logout-form { margin: 0; }
.user-avatar { width: 38px; height: 38px; min-height: 38px; padding: 0; position: relative; display: grid; place-items: center; border: 1px solid var(--ink); border-radius: 50%; background: var(--acid); color: var(--ink); font-size: 11px; font-weight: 800; box-shadow: none; }
.user-avatar:hover { border-color: var(--ink); background: var(--ink); color: var(--paper); transform: none; }
.user-avatar span { min-width: 76px; padding: 8px 9px; position: absolute; top: calc(100% + 7px); right: 0; border: 1px solid var(--ink); border-radius: 0; background: var(--ink); color: var(--paper); font-size: 10.5px; font-weight: 700; box-shadow: none; opacity: 0; pointer-events: none; transform: translateY(-3px); transition: 140ms; }
.user-avatar:hover span, .user-avatar:focus-visible span { opacity: 1; transform: translateY(0); }
.mobile-menu, .mobile-close { display: none; }

.main { width: 100%; min-width: 0; max-width: 1540px; margin: 0 auto; padding: 38px 40px 64px; }

h1, h2, h3, h4 { font-family: 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif; font-weight: 560; letter-spacing: -0.052em; }
h1 { margin: 0; max-width: 100%; overflow-wrap: anywhere; font-size: clamp(34px, 3.3vw, 52px); line-height: .98; }
h2 { font-size: 19px; }
h3 { font-size: 15px; }

.page-head { min-width: 0; margin-bottom: 32px; padding: 18px 0 22px; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; border-top: 1px solid var(--border-strong); border-bottom: 1px solid var(--border); }
.page-head > * { min-width: 0; max-width: 100%; }
.page-kicker { margin: 0 0 10px; color: #354dcc; font-size: 11px; font-weight: 800; letter-spacing: 1.15px; text-transform: uppercase; }
.page-description { max-width: 760px; margin: 12px 0 0; color: #575750; font-size: 14px; line-height: 1.65; }

.card {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 0;
  padding: 22px;
  box-shadow: none;
}

button, .button {
  min-height: 39px;
  padding: 0 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: var(--ink);
  color: var(--paper);
  border: 1px solid var(--ink);
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: .045em;
  text-transform: uppercase;
  text-decoration: none;
  cursor: pointer;
  transition: 160ms ease;
}
button:hover, .button:hover { background: var(--acid); border-color: var(--ink); color: var(--ink); transform: translateY(-2px); }
button:disabled { opacity: 0.5; cursor: default; transform: none; }
.button-secondary { background: transparent; border-color: var(--ink); color: var(--ink); }
.button-secondary:hover { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.button-ghost { background: transparent; border-color: transparent; color: var(--muted); }
.button-ghost:hover { background: var(--surface-soft); border-color: transparent; color: var(--text); }
.button-danger { background: var(--err); border-color: var(--err); }

input, select, textarea {
  background: var(--surface-soft);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 0;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
input:focus, select:focus, textarea:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(92,118,255,.12); }
textarea { width: 100%; min-height: 120px; padding: 12px; resize: vertical; }

pre.result { background: var(--ink); color: var(--paper); border: 1px solid var(--ink); border-radius: 0; padding: 13px; overflow-x: auto; font-size: 12px; white-space: pre-wrap; }
code { padding: 2px 5px; border-radius: 0; background: #e5e1d7; color: var(--ink); font-size: 0.9em; }

.status-pill { padding: 5px 9px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.status-pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.status-ok { color: var(--ok); background: var(--ok-soft); }
.status-warn { color: var(--warn); background: var(--warn-soft); }
.status-error { color: var(--err); background: var(--err-soft); }
.status-neutral { color: var(--muted); background: #e5e1d7; }

a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid var(--blue); outline-offset: 3px; }
::selection { color: var(--ink); background: var(--acid); }

.nav-backdrop { display: none; }

@media (max-width: 980px) {
  .sidebar, .sidebar--collapsed { width: 244px; transform: translateX(-100%); box-shadow: 20px 0 50px rgba(23,23,20,.2); }
  .sidebar--open { transform: translateX(0); }
  .workspace, .app-shell--collapsed .workspace { width: 100%; margin-left: 0; }
  .sidebar--collapsed .brand-block { padding: 16px 18px; justify-content: space-between; }
  .sidebar--collapsed .brand > span:last-child, .sidebar--collapsed .nav-item > span { display: inline; }
  .sidebar--collapsed .nav-group-label, .sidebar--collapsed .sidebar-footer > p { display: block; }
  .sidebar--collapsed .system-indicator { display: flex; }
  .sidebar--collapsed .nav-item { padding: 0 11px; justify-content: flex-start; }
  .sidebar--collapsed .side-nav { padding: 18px 12px 24px; }
  .sidebar--collapsed .sidebar-footer { padding: 16px 20px 20px; }
  .sidebar--collapsed .onboarding-restart { padding: 0 10px; justify-content: flex-start; font-size: 9.5px; }
  .sidebar-collapse { display: none; }
  .nav-backdrop { position: fixed; z-index: 25; inset: 0; display: block; background: rgba(23,23,20,.48); backdrop-filter: blur(2px); }
  .mobile-menu { width: 34px; min-height: 34px; padding: 8px; display: flex; flex-direction: column; gap: 4px; border: 0; background: transparent; }
  .mobile-menu:hover { background: var(--surface-soft); transform: none; }
  .mobile-menu span { width: 17px; height: 1.5px; background: var(--text); }
  .mobile-close { width: 30px; min-height: 30px; padding: 0; display: grid; place-items: center; border: 1px solid var(--ink); border-radius: 50%; background: transparent; color: var(--ink); font-size: 20px; }
  .main { padding: 28px 24px 48px; }
}

@media (max-width: 640px) {
  .topbar { height: 62px; padding: 0 16px; }
  .breadcrumb, .topbar-link { display: none; }
  .main { padding: 24px 16px 40px; }
  .page-head { align-items: flex-start; flex-direction: column; margin-bottom: 22px; }
  .page-head .button, .page-head button { width: 100%; }
  .card { padding: 17px; border-radius: 0; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}
</style>
