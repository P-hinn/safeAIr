export default defineNuxtConfig({
  compatibilityDate: '2026-07-17',
  devtools: { enabled: true },
  app: {
    head: {
      meta: [
        { name: 'robots', content: 'noindex, nofollow, noarchive, nosnippet, noimageindex' },
        { name: 'googlebot', content: 'noindex, nofollow, noarchive, nosnippet, noimageindex' }
      ]
    }
  },
  routeRules: {
    '/**': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff'
      }
    }
  },
  runtimeConfig: {
    public: {
      // Überschreibbar via NUXT_PUBLIC_API_BASE
      apiBase: 'http://localhost:8080',
      sitePassword: ''
    }
  }
})
