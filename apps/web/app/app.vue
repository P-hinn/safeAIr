<script setup lang="ts">
const route = useRoute()
const mobileNavOpen = ref(false)

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
</script>

<template>
  <div class="app-shell">
    <div v-if="mobileNavOpen" class="nav-backdrop" @click="mobileNavOpen = false" />

    <aside class="sidebar" :class="{ 'sidebar--open': mobileNavOpen }">
      <div class="brand-block">
        <NuxtLink to="/" class="brand" aria-label="safAIr Startseite">
          <span class="brand-mark">sA</span>
          <span>
            <strong>saf<span>AI</span>r</strong>
            <small>AI Governance</small>
          </span>
        </NuxtLink>
        <button class="mobile-close" aria-label="Navigation schließen" @click="mobileNavOpen = false">×</button>
      </div>

      <nav class="side-nav" aria-label="Hauptnavigation">
        <section v-for="group in navigation" :key="group.label" class="nav-group">
          <p class="nav-group-label">{{ group.label }}</p>
          <NuxtLink v-for="item in group.items" :key="item.to" :to="item.to" class="nav-item">
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
      </nav>

      <div class="sidebar-footer">
        <div class="system-indicator"><span /> Systeme betriebsbereit</div>
        <p>Governance Workspace</p>
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
          <div class="user-avatar" title="Management Workspace">MW</div>
        </div>
      </header>

      <main class="main">
        <NuxtPage />
      </main>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');

:root {
  --bg: #f4f7fb;
  --surface: #ffffff;
  --surface-soft: #f8fafc;
  --surface-raised: #ffffff;
  --border: #e3e9f1;
  --border-strong: #d4dce8;
  --text: #142238;
  --muted: #69778c;
  --muted-light: #95a1b3;
  --accent: #246bfd;
  --accent-dark: #1655d4;
  --accent-soft: #edf3ff;
  --navy: #0b1730;
  --navy-soft: #142440;
  --ok: #168a5b;
  --ok-soft: #eaf8f1;
  --warn: #d98212;
  --warn-soft: #fff5e5;
  --err: #d64242;
  --err-soft: #fff0f0;
  --purple: #7557d3;
  --purple-soft: #f1edff;
  --shadow-sm: 0 1px 2px rgba(17, 33, 58, 0.04), 0 4px 12px rgba(17, 33, 58, 0.04);
  --shadow-md: 0 12px 32px rgba(17, 33, 58, 0.09);
}

* { box-sizing: border-box; }

html { min-width: 320px; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'DM Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
}

button, input, select, textarea { font: inherit; }
button, a { -webkit-tap-highlight-color: transparent; }
a { color: inherit; }

.app-shell { min-height: 100vh; display: flex; }

.sidebar {
  position: fixed;
  z-index: 30;
  inset: 0 auto 0 0;
  width: 256px;
  display: flex;
  flex-direction: column;
  background: var(--navy);
  color: #fff;
  overflow-y: auto;
}

.brand-block {
  min-height: 82px;
  padding: 20px 20px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.brand { display: flex; align-items: center; gap: 11px; text-decoration: none; }
.brand-mark {
  width: 37px;
  height: 37px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, #4c87ff, #246bfd);
  color: #fff;
  font-family: 'Manrope', sans-serif;
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 7px 18px rgba(36,107,253,0.3);
}
.brand strong { display: block; color: #fff; font-family: 'Manrope', sans-serif; font-size: 20px; line-height: 1.05; letter-spacing: -0.5px; }
.brand strong span { color: #75a4ff; }
.brand small { display: block; margin-top: 4px; color: #8493aa; font-size: 10px; font-weight: 600; letter-spacing: 1.35px; text-transform: uppercase; }

.side-nav { padding: 15px 12px 24px; flex: 1; }
.nav-group + .nav-group { margin-top: 20px; }
.nav-group-label { margin: 0 10px 7px; color: #72819a; font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
.nav-item {
  min-height: 42px;
  padding: 0 11px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  gap: 11px;
  color: #aeb9cb;
  font-size: 13.5px;
  font-weight: 500;
  text-decoration: none;
  transition: 160ms ease;
}
.nav-item:hover { color: #fff; background: rgba(255,255,255,0.055); }
.nav-item.router-link-active { color: #fff; background: linear-gradient(90deg, rgba(51,119,255,0.26), rgba(51,119,255,0.1)); box-shadow: inset 3px 0 #4a86ff; }
.nav-icon { width: 19px; height: 19px; flex: 0 0 auto; }
.nav-item.router-link-active .nav-icon { color: #73a2ff; }

.sidebar-footer { padding: 16px 20px 20px; border-top: 1px solid rgba(255,255,255,0.07); }
.system-indicator { display: flex; align-items: center; gap: 8px; color: #b7c3d4; font-size: 11px; font-weight: 600; }
.system-indicator span { width: 7px; height: 7px; border-radius: 50%; background: #39d495; box-shadow: 0 0 0 4px rgba(57,212,149,0.1); }
.sidebar-footer p { margin: 7px 0 0 15px; color: #687994; font-size: 10px; }

.workspace { width: calc(100% - 256px); min-height: 100vh; margin-left: 256px; }
.topbar {
  position: sticky;
  z-index: 20;
  top: 0;
  height: 70px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255,255,255,0.92);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(14px);
}
.topbar-left { display: flex; align-items: center; gap: 13px; color: var(--text); font-size: 13px; }
.breadcrumb { margin-right: 5px; color: var(--muted-light); font-weight: 500; }
.topbar-actions { display: flex; align-items: center; gap: 18px; }
.topbar-link { color: var(--accent); font-size: 12px; font-weight: 700; text-decoration: none; }
.topbar-link:hover { color: var(--accent-dark); }
.topbar-monitor { display: flex; align-items: center; gap: 7px; color: var(--ok); }
.topbar-monitor span { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 4px var(--ok-soft); }
.user-avatar { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid #d7e1f0; border-radius: 10px; background: #eef3fa; color: #41516a; font-size: 11px; font-weight: 700; }
.mobile-menu, .mobile-close { display: none; }

.main { max-width: 1500px; margin: 0 auto; padding: 34px 36px 56px; }

h1, h2, h3, h4 { font-family: 'Manrope', 'DM Sans', sans-serif; letter-spacing: -0.035em; }
h1 { margin: 0; font-size: clamp(25px, 2.3vw, 34px); line-height: 1.2; }
h2 { font-size: 19px; }
h3 { font-size: 15px; }

.page-head { margin-bottom: 28px; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
.page-kicker { margin: 0 0 7px; color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; }
.page-description { max-width: 700px; margin: 9px 0 0; color: var(--muted); font-size: 14px; line-height: 1.6; }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 22px;
  box-shadow: var(--shadow-sm);
}

button, .button {
  min-height: 39px;
  padding: 0 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: var(--accent);
  color: #fff;
  border: 1px solid var(--accent);
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: 160ms ease;
}
button:hover, .button:hover { background: var(--accent-dark); border-color: var(--accent-dark); transform: translateY(-1px); }
button:disabled { opacity: 0.5; cursor: default; transform: none; }
.button-secondary { background: var(--surface); border-color: var(--border-strong); color: var(--text); }
.button-secondary:hover { background: var(--surface-soft); border-color: #bfc9d8; color: var(--text); }
.button-ghost { background: transparent; border-color: transparent; color: var(--muted); }
.button-ghost:hover { background: var(--surface-soft); border-color: transparent; color: var(--text); }
.button-danger { background: var(--err); border-color: var(--err); }

input, select, textarea {
  background: var(--surface-soft);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 9px;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
input:focus, select:focus, textarea:focus { border-color: #7aa4fa; box-shadow: 0 0 0 3px rgba(36,107,253,0.1); }
textarea { width: 100%; min-height: 120px; padding: 12px; resize: vertical; }

pre.result { background: #101b2e; color: #dfe8f7; border: 1px solid #25344c; border-radius: 9px; padding: 13px; overflow-x: auto; font-size: 12px; white-space: pre-wrap; }
code { padding: 2px 5px; border-radius: 5px; background: #eef2f7; color: #34445e; font-size: 0.9em; }

.status-pill { padding: 5px 9px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; font-size: 10.5px; font-weight: 700; white-space: nowrap; }
.status-pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.status-ok { color: var(--ok); background: var(--ok-soft); }
.status-warn { color: var(--warn); background: var(--warn-soft); }
.status-error { color: var(--err); background: var(--err-soft); }
.status-neutral { color: #64748b; background: #f0f3f7; }

.nav-backdrop { display: none; }

@media (max-width: 980px) {
  .sidebar { transform: translateX(-100%); box-shadow: 20px 0 50px rgba(7,18,39,0.25); transition: transform 200ms ease; }
  .sidebar--open { transform: translateX(0); }
  .workspace { width: 100%; margin-left: 0; }
  .nav-backdrop { position: fixed; z-index: 25; inset: 0; display: block; background: rgba(5,14,30,0.5); backdrop-filter: blur(2px); }
  .mobile-menu { width: 34px; min-height: 34px; padding: 8px; display: flex; flex-direction: column; gap: 4px; border: 0; background: transparent; }
  .mobile-menu:hover { background: var(--surface-soft); transform: none; }
  .mobile-menu span { width: 17px; height: 1.5px; background: var(--text); }
  .mobile-close { width: 30px; min-height: 30px; padding: 0; display: grid; place-items: center; border: 0; background: rgba(255,255,255,0.06); font-size: 20px; }
  .main { padding: 28px 24px 48px; }
}

@media (max-width: 640px) {
  .topbar { height: 62px; padding: 0 16px; }
  .breadcrumb, .topbar-link { display: none; }
  .main { padding: 24px 16px 40px; }
  .page-head { align-items: flex-start; flex-direction: column; margin-bottom: 22px; }
  .page-head .button, .page-head button { width: 100%; }
  .card { padding: 17px; border-radius: 12px; }
}
</style>
