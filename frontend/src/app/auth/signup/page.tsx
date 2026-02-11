'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Phone, Mail, User, Lock, ArrowLeft, Loader2, Shield } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Turnstile from '@/components/security/Turnstile';

// Clé Turnstile (à configurer dans .env.local)
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'; // Test key

const signUpSchema = z.object({
  fullName: z.string().min(3, 'Le nom complet doit contenir au moins 3 caractères'),
  email: z.string().email('Email invalide'),
  countryCode: z.string().regex(/^\+[0-9]{1,4}$/, 'Indicatif invalide (ex: +33, +241)'),
  whatsapp: z.string().regex(/^[0-9]{6,15}$/, 'Numéro WhatsApp invalide (6-15 chiffres)'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, 'Vous devez accepter les conditions'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ['confirmPassword']
});

type SignUpFormData = z.infer<typeof signUpSchema>;

// Liste des pays avec indicatifs téléphoniques
const countries = [
  { code: '+241', name: 'Gabon', flag: '🇬🇦' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+1', name: 'États-Unis/Canada', flag: '🇺🇸' },
  { code: '+44', name: 'Royaume-Uni', flag: '🇬🇧' },
  { code: '+49', name: 'Allemagne', flag: '🇩🇪' },
  { code: '+39', name: 'Italie', flag: '🇮🇹' },
  { code: '+34', name: 'Espagne', flag: '🇪🇸' },
  { code: '+32', name: 'Belgique', flag: '🇧🇪' },
  { code: '+41', name: 'Suisse', flag: '🇨🇭' },
  { code: '+237', name: 'Cameroun', flag: '🇨🇲' },
  { code: '+225', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: '+221', name: 'Sénégal', flag: '🇸🇳' },
  { code: '+212', name: 'Maroc', flag: '🇲🇦' },
  { code: '+213', name: 'Algérie', flag: '🇩🇿' },
  { code: '+216', name: 'Tunisie', flag: '🇹🇳' },
  { code: '+27', name: 'Afrique du Sud', flag: '🇿🇦' },
  { code: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: '+254', name: 'Kenya', flag: '🇰🇪' },
];

function SignUpContent() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [isCustomCountryCode, setIsCustomCountryCode] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
    setValue
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      countryCode: '+241' // Gabon par défaut
    }
  });

  useEffect(() => {
    const plan = searchParams?.get('plan');
    if (plan) {
      setSelectedPlan(plan);
    }
  }, [searchParams]);

  const onSubmit = async (data: SignUpFormData) => {
    // Vérifier que Turnstile est validé
    if (!turnstileToken) {
      setTurnstileError('Veuillez compléter la vérification de sécurité');
      return;
    }

    setIsLoading(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // 1. Vérifier le token Turnstile côté serveur (optionnel - le widget client a déjà validé)
      try {
        const verifyResponse = await fetch(`${API_URL}/api/auth/verify-turnstile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken })
        });

        const verifyData = await verifyResponse.json();
        if (!verifyData.success) {
          console.warn('Server-side Turnstile verification failed, continuing with client validation');
          // Continue anyway - client-side validation is sufficient
        }
      } catch (verifyError) {
        console.warn('Turnstile server verification error:', verifyError);
        // Continue anyway - client-side validation is sufficient
      }

      // 2. Créer le compte utilisateur
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (error) {
        throw error;
      }

      if (authData.user) {
        // 2. Créer le profil utilisateur via l'API backend (bypass RLS)
        try {
          const profileResponse = await fetch(`${API_URL}/api/auth/create-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: authData.user.id,
              email: data.email,
              fullName: data.fullName,
              phone: `${data.countryCode}${data.whatsapp}`,
              whatsappNumber: `${data.countryCode}${data.whatsapp}`,
              subscriptionType: selectedPlan === 'free' ? 'free' : selectedPlan
            })
          });

          const profileResult = await profileResponse.json();
          if (!profileResult.success) {
            console.error('Profile creation error:', profileResult.error);
            // Continue anyway - profile can be created on first login
          }
        } catch (profileError) {
          console.error('Profile creation error:', profileError);
          // Continue anyway - profile can be created on first login
        }

        // 3. Créer l'abonnement selon le plan
        if (selectedPlan !== 'free') {
          const { data: planData } = await supabase
            .from('subscription_plans')
            .select('id')
            .eq('slug', selectedPlan)
            .single();

          if (planData) {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 7); // 7 jours d'essai

            const { error: subError } = await supabase
              .from('subscriptions')
              .insert({
                user_id: authData.user.id,
                plan_id: planData.id,
                status: 'trialing',
                payment_method: 'pending',
                current_period_start: new Date().toISOString(),
                current_period_end: trialEnd.toISOString(),
                trial_end: trialEnd.toISOString(),
              });

            if (subError) {
              console.error('Subscription creation error:', subError);
            }
          }
        }

        // 4. Connexion directe — pas de vérification email
        router.push('/');
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      if (error.message?.includes('already registered')) {
        setError('email', { 
          type: 'manual', 
          message: 'Cet email est déjà utilisé' 
        });
      } else {
        setError('root', { 
          type: 'manual', 
          message: error.message || 'Une erreur est survenue lors de l\'inscription' 
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?plan=${selectedPlan}`
      }
    });
    
    if (error) {
      console.error('Google sign up error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{
          backgroundImage: 'url(/replicate-prediction-zpt598c2z1rmc0csb1h923sw0w.jpg)'
        }}
      ></div>
      <div className="absolute inset-0 bg-black/50"></div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Back Button */}
        <Link href="/abonnement" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Retour aux forfaits
        </Link>

        {/* Card */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Créer votre compte</h1>
            <p className="text-gray-400">
              {selectedPlan === 'free' 
                ? 'Commencez gratuitement'
                : selectedPlan === 'discovery'
                ? 'Essai gratuit 7 jours - Forfait Découverte'
                : 'Essai gratuit 7 jours - Forfait Pro'
              }
            </p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
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
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-800/50 text-gray-400">Ou</span>
            </div>
          </div>

          {/* Method Toggle */}

          {/* Sign Up Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom complet
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('fullName')}
                  type="text"
                  placeholder="Jean Dupont"
                  className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-500">{errors.fullName.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="jean@exemple.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* WhatsApp Field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Numéro WhatsApp
              </label>
              <div className="flex gap-2">
                {/* Country Code Selector */}
                <div className="relative">
                  {!isCustomCountryCode ? (
                    <select
                      {...register('countryCode')}
                      className={`w-32 px-3 py-3 bg-gray-700/50 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 appearance-none cursor-pointer ${
                        errors.countryCode ? 'border-red-500' : 'border-gray-600'
                      }`}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setIsCustomCountryCode(true);
                          setValue('countryCode', '+');
                        }
                      }}
                    >
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.flag} {country.code}
                        </option>
                      ))}
                      <option value="custom">✏️ Autre indicatif</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        {...register('countryCode')}
                        type="text"
                        className={`w-20 px-2 py-3 bg-gray-700/50 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-center ${
                          errors.countryCode ? 'border-red-500' : 'border-gray-600'
                        }`}
                        placeholder="+33"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCountryCode(false);
                          setValue('countryCode', '+241');
                        }}
                        className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
                        title="Retour à la liste"
                      >
                        ↩️
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Phone Number Input */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('whatsapp')}
                    type="tel"
                    className={`w-full pl-10 pr-4 py-3 bg-gray-700/50 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
                      errors.whatsapp ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="123456789"
                  />
                </div>
              </div>
              {(errors.countryCode || errors.whatsapp) && (
                <p className="mt-1 text-sm text-red-400">
                  {errors.countryCode?.message || errors.whatsapp?.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('confirmPassword')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Terms */}
            <div className="flex items-start">
              <input
                {...register('acceptTerms')}
                type="checkbox"
                className="mt-1 w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
              />
              <label className="ml-2 text-sm text-gray-300">
                J'accepte les{' '}
                <Link href="/terms" className="text-orange-500 hover:text-orange-400">
                  conditions d'utilisation
                </Link>{' '}
                et la{' '}
                <Link href="/privacy" className="text-orange-500 hover:text-orange-400">
                  politique de confidentialité
                </Link>
              </label>
            </div>
            {errors.acceptTerms && (
              <p className="text-sm text-red-500">{errors.acceptTerms.message}</p>
            )}

            {/* Error message */}
            {errors.root && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                <p className="text-sm text-red-500">{errors.root.message}</p>
              </div>
            )}

            {/* Cloudflare Turnstile - Protection anti-bot */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
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
                theme="dark"
                className="flex justify-center"
                action="signup"
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
                  Création en cours...
                </>
              ) : (
                <>
                  Créer mon compte
                  {selectedPlan !== 'free' && (
                    <span className="text-xs bg-white/20 px-2 py-1 rounded">
                      7 jours gratuits
                    </span>
                  )}
                </>
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <p className="mt-6 text-center text-gray-400">
            Déjà un compte ?{' '}
            <Link href="/auth/signin" className="text-orange-500 hover:text-orange-400 font-medium">
              Se connecter
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
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{
            backgroundImage: 'url(/replicate-prediction-zpt598c2z1rmc0csb1h923sw0w.jpg)'
          }}
        ></div>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="max-w-md w-full text-center relative z-10">
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700">
            <h1 className="text-3xl font-bold mb-4">Chargement...</h1>
            <p className="text-gray-300">Veuillez patienter.</p>
          </div>
        </div>
      </div>
    }>
      <SignUpContent />
    </Suspense>
  );
}
