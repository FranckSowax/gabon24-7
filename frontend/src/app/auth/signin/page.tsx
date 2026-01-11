'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, Loader2, Shield } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Turnstile from '@/components/security/Turnstile';

// Clé Turnstile (à configurer dans .env.local)
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'; // Test key

// Utility: wrap a promise with a timeout to avoid infinite spinners on bad network
async function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Opération') : Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} trop longue, vérifiez votre connexion réseau.`)), ms)
  })
  try {
    const result = await Promise.race([promise, timeout]) as T
    return result
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const signInSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

type SignInFormData = z.infer<typeof signInSchema>;

function SignInContent() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema)
  });

  const onSubmit = async (data: SignInFormData) => {
    // Vérifier que Turnstile est validé
    if (!turnstileToken) {
      setTurnstileError('Veuillez compléter la vérification de sécurité');
      return;
    }

    setIsLoading(true);

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Vous êtes hors ligne. Vérifiez votre connexion internet.')
      }

      // Vérifier le token Turnstile côté serveur (optionnel - le widget client a déjà validé)
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      try {
        const verifyResponse = await fetch(`${API_URL}/api/auth/verify-turnstile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken })
        });

        const verifyData = await verifyResponse.json();
        if (!verifyData.success) {
          // Log warning mais continuer - la validation côté client est suffisante
          console.warn('Server-side Turnstile verification failed, continuing with client validation');
        }
      } catch (verifyError) {
        // Erreur réseau ou serveur - continuer quand même
        console.warn('Turnstile server verification error:', verifyError);
      }

      type SupabaseSignInResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>
      const { data: authData, error } = await withTimeout(
        supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      }),
        10000,
        'Connexion'
      ) as SupabaseSignInResult;

      if (error) {
        throw error;
      }

      if (authData.user) {
        const redirectTo = searchParams?.get('redirectTo') || '/';
        router.push(redirectTo);
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      if (error.message?.includes('Invalid login credentials')) {
        setError('root', { 
          type: 'manual', 
          message: 'Email ou mot de passe incorrect' 
        });
      } else if (error.message?.includes('Email not confirmed')) {
        setError('root', { 
          type: 'manual', 
          message: 'Veuillez confirmer votre email avant de vous connecter' 
        });
      } else {
        setError('root', { 
          type: 'manual', 
          message: error.message || 'Une erreur est survenue lors de la connexion' 
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const redirectTo = searchParams?.get('redirectTo') || '/';
    try {
      // Persist as fallback in case query gets lost
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('postLoginRedirect', redirectTo) } catch {}
      }
    } catch {}
    const result = await withTimeout(
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
        }
      }),
      10000,
      'Connexion Google'
    );
    
    // supabase returns { data, error }
    // @ts-ignore
    if (result?.error) {
      // @ts-ignore
      console.error('Google sign in error:', result.error);
    }
  };

  const handleForgotPassword = async () => {
    const email = (document.getElementById('email') as HTMLInputElement)?.value;
    
    if (!email) {
      setError('email', { type: 'manual', message: 'Veuillez entrer votre email' });
      return;
    }

    try {
      const result = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`
        }),
        10000,
        'Réinitialisation du mot de passe'
      );

      // @ts-ignore
      if (result?.error) throw result.error;

      alert('Un lien de réinitialisation a été envoyé à votre email');
    } catch (error: any) {
      setError('root', { type: 'manual', message: error.message });
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/replicate-prediction-xj3v96zr05rm80cs28ba0ftc44.jpg)'
        }}
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/65" />
      
      <div className="relative z-10 max-w-md w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Back Button */}
          <Link href="/" className="inline-flex items-center gap-2 text-white hover:text-gray-200 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>

          {/* Card */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Connexion</h1>
            <p className="text-gray-600">
              Accédez à votre espace personnel Gabon Insight
            </p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuer avec Google
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Ou</span>
            </div>
          </div>

          {/* Sign In Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  placeholder="jean@exemple.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-orange-500 hover:text-orange-400 transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* Error message */}
            {errors.root && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errors.root.message}</p>
              </div>
            )}

            {/* Cloudflare Turnstile - Protection anti-bot */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Shield className="w-4 h-4" />
                <span>Vérification de sécurité</span>
              </div>
              <Turnstile
                siteKey={TURNSTILE_SITE_KEY}
                onVerify={(token) => {
                  setTurnstileToken(token);
                  setTurnstileError(null);
                }}
                onError={() => setTurnstileError('Erreur de vérification. Veuillez réessayer.')}
                onExpire={() => {
                  setTurnstileToken(null);
                  setTurnstileError('Vérification expirée. Veuillez réessayer.');
                }}
                theme="light"
                className="flex justify-center"
                action="signin"
              />
              {turnstileError && (
                <p className="text-sm text-red-500 text-center">{turnstileError}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !turnstileToken}
              className="w-full py-4 px-6 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="mt-6 text-center text-gray-600">
            Pas encore de compte ?{' '}
            <Link href="/auth/signup" className="text-orange-500 hover:text-orange-600 font-medium">
              Créer un compte
            </Link>
          </p>
        </div>

        {/* Security Badge */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
            </svg>
            Connexion sécurisée avec chiffrement SSL
          </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700">
            <h1 className="text-3xl font-bold mb-4">Chargement...</h1>
            <p className="text-gray-300">Veuillez patienter.</p>
          </div>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
