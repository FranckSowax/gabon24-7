'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Global Error Boundary pour l'application
 * Capture les erreurs non gérées et affiche une UI de fallback
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log l'erreur pour le monitoring (en production, envoyer vers un service de logging)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Envoyer vers Sentry, LogRocket, etc.
      console.error('Erreur application:', error);
    } else {
      console.error('Erreur application:', error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Icône d'erreur */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>

        {/* Titre */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Oups ! Une erreur est survenue
        </h1>

        {/* Description */}
        <p className="text-gray-600 mb-6">
          Nous sommes désolés, quelque chose s&apos;est mal passé.
          Notre équipe a été notifiée et travaille à résoudre le problème.
        </p>

        {/* Message d'erreur (dev seulement) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-mono text-red-700 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-500 mt-2">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            Retour à l&apos;accueil
          </a>
        </div>

        {/* Lien de contact */}
        <p className="mt-8 text-sm text-gray-500">
          Le problème persiste ?{' '}
          <a
            href="/feedback"
            className="text-orange-600 hover:underline"
          >
            Contactez notre support
          </a>
        </p>
      </div>
    </div>
  );
}
