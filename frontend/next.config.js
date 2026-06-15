/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  skipTrailingSlashRedirect: true,

  // Compression Next.js (gzip à la sortie)
  compress: true,

  // Pas de source maps en prod (réduit taille build, évite leak code)
  productionBrowserSourceMaps: false,

  // Header X-Powered-By désactivé (réduit fingerprinting)
  poweredByHeader: false,

  experimental: {
    outputFileTracingRoot: process.cwd(),
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

// Wrapping conditionnel Sentry : si @sentry/nextjs est installé ET SENTRY_DSN défini,
// on active l'instrumentation (source maps upload, edge/server/client runtimes).
// Sinon, on exporte la config inchangée — pas de hard dependency, pas de crash build.
let exportedConfig = nextConfig;
try {
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const { withSentryConfig } = require('@sentry/nextjs');
    exportedConfig = withSentryConfig(nextConfig, {
      silent: !process.env.CI,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      tunnelRoute: '/monitoring-tunnel', // contourne les ad-blockers (optionnel)
      hideSourceMaps: true,
      disableLogger: true,
    });
  }
} catch (_err) {
  // @sentry/nextjs non installé — on garde la config standard.
}

module.exports = exportedConfig;
