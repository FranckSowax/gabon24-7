// Next 16 (Turbopack) ne charge plus `sentry.client.config.ts` tout seul : le
// code exécuté au démarrage du navigateur doit être dans ce fichier.
// Sans lui, la capture d'erreurs côté navigateur s'arrête sans aucun message.
import * as Sentry from '@sentry/nextjs'
import '../sentry.client.config'

// Suivi des changements de page (navigation côté client).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
