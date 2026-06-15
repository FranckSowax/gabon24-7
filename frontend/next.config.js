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
// on active l'instrumentation runtime (capture d'erreurs via le DSN).
//
// IMPORTANT — résilience du build : l'upload de source maps + la création de release
// se font côté réseau pendant `next build`. Une panne transitoire de Sentry (504) a
// déjà cassé le déploiement Netlify. On DÉSACTIVE donc ces étapes réseau (sourcemaps
// + release) et on installe un errorHandler qui avale toute erreur du plugin :
// la capture d'erreurs runtime reste active, mais une indisponibilité de Sentry ne
// peut plus faire échouer le build. (Tradeoff : stack traces non symbolisées.)
let exportedConfig = nextConfig;
try {
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const { withSentryConfig } = require('@sentry/nextjs');
    exportedConfig = withSentryConfig(nextConfig, {
      silent: !process.env.CI,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      telemetry: false,
      // Pas d'étapes réseau au build → pas de build cassé sur panne Sentry.
      sourcemaps: { disable: true },
      release: { create: false, finalize: false },
      // Filet de sécurité : toute erreur résiduelle du plugin est ignorée (non bloquante).
      errorHandler: (err) => {
        console.warn('⚠️ Sentry build step ignoré (non bloquant):', err && err.message)
      },
    });
  }
} catch (_err) {
  // @sentry/nextjs non installé ou wrapping en échec — on garde la config standard.
}

module.exports = exportedConfig;
