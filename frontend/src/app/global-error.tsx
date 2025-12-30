'use client';

import { useEffect } from 'react';

/**
 * Global Error Boundary pour les erreurs au niveau root layout
 * Ce composant capture les erreurs qui se produisent dans le layout racine
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erreur globale critique:', error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          padding: '1rem',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '1rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '2rem',
            textAlign: 'center'
          }}>
            {/* Icône */}
            <div style={{
              width: '4rem',
              height: '4rem',
              backgroundColor: '#fee2e2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>

            {/* Titre */}
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '0.5rem'
            }}>
              Erreur critique
            </h1>

            {/* Description */}
            <p style={{
              color: '#6b7280',
              marginBottom: '1.5rem'
            }}>
              L&apos;application a rencontré une erreur inattendue.
              Veuillez rafraîchir la page ou revenir plus tard.
            </p>

            {/* Bouton */}
            <button
              onClick={reset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#ea580c',
                color: 'white',
                fontWeight: '500',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Rafraîchir la page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
