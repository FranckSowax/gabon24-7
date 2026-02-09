'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { subscriptionHelpers } from '@/lib/supabase-subscription';

function isSafeRedirect(url: string): boolean {
  if (!url || url === '/') return true;
  if (!url.startsWith('/')) return false;
  if (url.startsWith('//')) return false;
  return true;
}

function AuthCallbackContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      // 1) PKCE: échanger le code d'auth pour une session si présent
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const errorDesc = url.searchParams.get('error_description')
        if (errorDesc) {
          throw new Error(decodeURIComponent(errorDesc))
        }
        if (code) {
          // Support des différentes signatures via any-cast
          const authAny: any = (supabase as any).auth
          try {
            const res = await authAny.exchangeCodeForSession(code)
            if (res?.error) throw res.error
          } catch (e1) {
            try {
              const res2 = await authAny.exchangeCodeForSession({ code })
              if (res2?.error) throw res2.error
            } catch (e2) {
              throw e2
            }
          }
          // Nettoyer l'URL des paramètres sensibles
          try { window.history.replaceState({}, document.title, '/auth/callback') } catch {}
        }
      }

      // 2) Récupérer la session actualisée
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (!data.session) throw new Error('Aucune session trouvée');

      const user = data.session.user;
      const plan = searchParams?.get('plan');
      // 3) Créer l'abonnement si demandé
      if (plan && plan !== 'free') {
        const plans = await subscriptionHelpers.getSubscriptionPlans();
        const selectedPlan = plans.find((p: any) => p.slug === plan);
        if (selectedPlan) {
          await subscriptionHelpers.createSubscription(user.id, selectedPlan.id);
        }
      }

      setStatus('success');
      setMessage('Compte activé avec succès !');
      // 4) Redirection rapide vers la page d'origine si fournie
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          const sp = new URLSearchParams(window.location.search)
          let target = sp.get('redirectTo') || '/'
          if (!sp.get('redirectTo')) {
            try { target = localStorage.getItem('postLoginRedirect') || '/' } catch {}
          }
          try { localStorage.removeItem('postLoginRedirect') } catch {}
          // Validate redirect to prevent open redirect attacks
          const safeTarget = isSafeRedirect(target) ? target : '/'
          window.location.replace(safeTarget)
        } else {
          router.replace('/')
        }
      }, 800);
    } catch (error: any) {
      console.error('Auth callback error:', error);
      setStatus('error');
      setMessage(error.message || 'Erreur lors de l\'activation du compte');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700">
          {status === 'loading' && (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 mx-auto mb-6"
              >
                <Loader2 className="w-16 h-16 text-orange-500" />
              </motion.div>
              <h1 className="text-2xl font-bold mb-4">Activation en cours...</h1>
              <p className="text-gray-300">Veuillez patienter pendant que nous activons votre compte.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-10 h-10 text-white" />
              </motion.div>
              <h1 className="text-2xl font-bold mb-4 text-green-400">Compte activé !</h1>
              <p className="text-gray-300 mb-4">{message}</p>
              <p className="text-sm text-gray-400">Redirection vers votre espace personnel...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <AlertCircle className="w-10 h-10 text-white" />
              </motion.div>
              <h1 className="text-2xl font-bold mb-4 text-red-400">Erreur d'activation</h1>
              <p className="text-gray-300 mb-6">{message}</p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/auth/signup')}
                  className="w-full py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
                >
                  Réessayer l'inscription
                </button>
                <button
                  onClick={() => router.push('/auth/signin')}
                  className="w-full py-3 px-6 border border-gray-600 hover:bg-gray-700/50 text-white font-medium rounded-lg transition-colors"
                >
                  Se connecter
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 mx-auto mb-6"
            >
              <Loader2 className="w-16 h-16 text-orange-500" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-4">Chargement...</h1>
            <p className="text-gray-300">Veuillez patienter.</p>
          </div>
        </motion.div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
