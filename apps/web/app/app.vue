<template>
  <div class="layout">
    <header class="header">
      <NuxtLink to="/" class="brand">saf<span>AI</span>r</NuxtLink>
      <nav>
        <NuxtLink to="/">Dashboard</NuxtLink>
        <NuxtLink to="/pii">PII</NuxtLink>
        <NuxtLink to="/guardrails">Guardrails</NuxtLink>
        <NuxtLink to="/moderation">Moderation</NuxtLink>
        <NuxtLink to="/redteam">Red Teaming</NuxtLink>
        <NuxtLink to="/tools">Tools</NuxtLink>
      </nav>
    </header>
    <main class="main">
      <NuxtPage />
    </main>
  </div>
</template>

<style>
:root {
  --bg: #0f1115;
  --surface: #181b21;
  --border: #2a2e37;
  --text: #e8eaed;
  --muted: #9aa0a6;
  --accent: #4f8cff;
  --ok: #34c77b;
  --err: #e5534b;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
.layout { min-height: 100vh; }
.header {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0.9rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.brand { font-size: 1.25rem; font-weight: 700; color: var(--text); text-decoration: none; }
.brand span { color: var(--accent); }
.header nav { display: flex; gap: 1.25rem; }
.header nav a { color: var(--muted); text-decoration: none; font-size: 0.95rem; }
.header nav a.router-link-active { color: var(--text); }
.main { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem;
}
button {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1.1rem;
  font-size: 0.95rem;
  cursor: pointer;
}
button:disabled { opacity: 0.5; cursor: default; }
textarea {
  width: 100%;
  min-height: 120px;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem;
  font: inherit;
  resize: vertical;
}
pre.result {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem;
  overflow-x: auto;
  font-size: 0.85rem;
  white-space: pre-wrap;
}
</style>
