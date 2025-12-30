'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react';

/**
 * Error Boundary pour la section Auth
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erreur Auth:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Erreur d&apos;authentification
        </h1>

        <p className="text-gray-600 mb-6">
          Un problème est survenu lors de la connexion.
          Veuillez réessayer ou retourner à la page de connexion.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-mono text-red-700 break-all">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>

          <a
            href="/auth/signin"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Retour à la connexion
          </a>
        </div>
      </div>
    </div>
  );
}
