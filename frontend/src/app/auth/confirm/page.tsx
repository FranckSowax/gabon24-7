'use client';

import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, CheckCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams?.get('email') ?? '';
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const handleResendEmail = async () => {
    if (!email) return;
    
    setIsResending(true);
    setResendMessage('');
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setResendMessage('Erreur lors de l\'envoi. Veuillez réessayer.');
      } else {
        setResendMessage('Email de confirmation renvoyé avec succès !');
      }
    } catch (error) {
      setResendMessage('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsResending(false);
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
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Mail className="w-10 h-10 text-white" />
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold mb-4"
          >
            Vérifiez votre email
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-gray-300 mb-6"
          >
            Nous avons envoyé un lien de confirmation à{' '}
            <span className="font-semibold text-white break-all">{email}</span>
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-700/50 rounded-lg p-4 mb-6"
          >
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm text-gray-300 mb-2">
                  Cliquez sur le lien dans l'email pour activer votre compte et commencer votre essai gratuit.
                </p>
                <p className="text-xs text-gray-400">
                  Le lien expire dans 24 heures.
                </p>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-4"
          >
            <button 
              onClick={handleResendEmail}
              disabled={isResending}
              className="w-full py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isResending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Renvoyer l'email
                </>
              )}
            </button>
            
            {resendMessage && (
              <div className={`p-3 rounded-lg text-sm ${
                resendMessage.includes('succès') 
                  ? 'bg-green-500/10 border border-green-500/50 text-green-400'
                  : 'bg-red-500/10 border border-red-500/50 text-red-400'
              }`}>
                {resendMessage}
              </div>
            )}
            
            <Link 
              href="/auth/signin"
              className="block w-full py-3 px-6 border border-gray-600 hover:bg-gray-700/50 text-white font-medium rounded-lg transition-colors text-center"
            >
              Retour à la connexion
            </Link>
          </motion.div>
        </div>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-sm text-gray-500"
        >
          Vous n'avez pas reçu l'email ? Vérifiez votre dossier spam ou{' '}
          <Link href="/contact" className="text-orange-500 hover:text-orange-400">
            contactez le support
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700">
            <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Chargement...</h1>
            <p className="text-gray-300">Veuillez patienter.</p>
          </div>
        </motion.div>
      </div>
    }>
      <ConfirmEmailContent />
    </Suspense>
  );
}
