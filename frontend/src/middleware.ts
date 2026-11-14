import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Adresse officielle du site. Les copies servies sur *.netlify.app y renvoient.
const CANONICAL_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || 'https://gaboninsight.com').replace(/\/$/, '');

/**
 * Le même site est aussi servi sur son adresse Netlify d'origine
 * (gabon24-7.netlify.app), que Google a indexée en double (audit SEO du
 * 5 août 2026). Renvoie l'adresse officielle correspondante, ou null.
 * Les prévisualisations Netlify (hôte contenant « -- ») ne sont pas redirigées.
 * Désactivable sans redéploiement de code : MIRROR_REDIRECT=off.
 */
function mirrorRedirectTarget(req: NextRequest): string | null {
  if (process.env.MIRROR_REDIRECT === 'off') return null
  if (req.method !== 'GET' && req.method !== 'HEAD') return null

  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase().split(':')[0]
  if (!host.endsWith('.netlify.app') || host.includes('--')) return null

  let canonical: URL
  try {
    canonical = new URL(CANONICAL_ORIGIN)
  } catch {
    return null
  }
  // Pas de boucle si l'adresse officielle configurée est elle-même sur netlify.app
  if (canonical.hostname.endsWith('.netlify.app')) return null

  return `${canonical.origin}${req.nextUrl.pathname}${req.nextUrl.search}`
}

function isNetlifyPreviewHost(req: NextRequest): boolean {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase()
  return host.includes('.netlify.app') && host.includes('--')
}

export async function middleware(req: NextRequest) {
  const mirrorTarget = mirrorRedirectTarget(req)
  if (mirrorTarget) {
    return NextResponse.redirect(mirrorTarget, 301)
  }

  const res = NextResponse.next();

  // Les prévisualisations Netlify ne doivent jamais être indexées
  if (isNetlifyPreviewHost(req)) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  // Security headers
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.railway.app wss://*.railway.app https://challenges.cloudflare.com https://www.google-analytics.com https://*.billing-easy.com https://*.billing-easy.net https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
      "frame-src 'self' blob: https://challenges.cloudflare.com https://www.google.com https://accounts.google.com https://www.youtube.com https://*.billing-easy.net https://*.billing-easy.com",
      "media-src 'self' https://*.supabase.co https://*.railway.app blob: data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; ')
  );

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
  runtime: 'nodejs',
};
