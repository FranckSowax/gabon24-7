'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Briefcase } from 'lucide-react';

/**
 * Error Boundary pour la section Business
 */
export default function BusinessError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erreur Business:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Erreur Business
            </h1>
            <p className="text-sm text-gray-500">
              Un problème est survenu avec votre projet
            </p>
          </div>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-mono text-red-700 break-all">
              {error.message}
            </p>
          </div>
        )}

        <p className="text-gray-600 mb-6">
          Vos données de projet sont en sécurité. Essayez de rafraîchir la page
          ou revenez à la liste de vos projets.
        </p>

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>

          <a
            href="/business/mes-projets"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Mes Projets
          </a>
        </div>
      </div>
    </div>
  );
}
