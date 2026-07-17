export default defineNuxtConfig({
  compatibilityDate: '2026-07-17',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      // Überschreibbar via NUXT_PUBLIC_API_BASE
      apiBase: 'http://localhost:8080'
    }
  }
})
