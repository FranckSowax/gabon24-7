'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { XCircle, RefreshCw, ArrowLeft, HelpCircle, Phone, MessageCircle, Loader2 } from 'lucide-react'

function EchecContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams?.get('reference') || null
  const reason = searchParams?.get('reason') || null

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const getErrorMessage = () => {
    switch (reason) {
      case 'cancelled':
        return {
          title: 'Paiement annulé',
          message: 'Vous avez annulé la transaction. Aucun montant n\'a été débité de votre compte.',
          icon: '🚫'
        }
      case 'failed':
        return {
          title: 'Paiement échoué',
          message: 'Le paiement n\'a pas pu être traité. Cela peut être dû à un solde insuffisant ou un problème technique.',
          icon: '❌'
        }
      case 'timeout':
        return {
          title: 'Délai dépassé',
          message: 'Vous n\'avez pas confirmé le paiement dans le délai imparti. La transaction a été annulée.',
          icon: '⏰'
        }
      case 'insufficient_funds':
        return {
          title: 'Solde insuffisant',
          message: 'Votre compte Mobile Money ne dispose pas de fonds suffisants pour cette transaction.',
          icon: '💰'
        }
      default:
        return {
          title: 'Erreur de paiement',
          message: 'Une erreur est survenue lors du traitement de votre paiement.',
          icon: '⚠️'
        }
    }
  }

  const errorInfo = getErrorMessage()

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      <div className="flex min-h-screen w-full">
        <Sidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
          <div className="max-w-2xl mx-auto mt-8">
            {/* Carte principale */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {/* Header rouge */}
              <div className="bg-gradient-to-r from-red-500 to-orange-500 p-8 text-center text-white">
                <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center backdrop-blur-sm">
                  <XCircle className="w-12 h-12" />
                </div>
                <h1 className="text-3xl font-bold mb-2">{errorInfo.title}</h1>
                <p className="text-red-100">Ne vous inquiétez pas, vous pouvez réessayer</p>
              </div>

              {/* Contenu */}
              <div className="p-8">
                {/* Message d'erreur */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{errorInfo.icon}</span>
                    <div>
                      <p className="text-red-800">{errorInfo.message}</p>
                    </div>
                  </div>
                </div>

                {/* Référence */}
                {reference && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-500 text-center">
                      Référence: <span className="font-mono font-medium text-gray-700">{reference}</span>
                    </p>
                  </div>
                )}

                {/* Solutions suggérées */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-gray-500" />
                    Que faire ?
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      Vérifiez que votre compte Mobile Money a suffisamment de solde
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      Assurez-vous que votre numéro de téléphone est correct
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      Vérifiez votre connexion réseau
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      Réessayez dans quelques minutes si le problème persiste
                    </li>
                  </ul>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <button
                    onClick={() => router.back()}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-red-700 flex items-center justify-center gap-2 transition-all"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Réessayer le paiement
                  </button>

                  <button
                    onClick={() => router.push('/mon-profil')}
                    className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 flex items-center justify-center gap-2 transition-all"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Retour à mon profil
                  </button>
                </div>

                {/* Aide */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-center text-sm text-gray-500 mb-4">
                    Besoin d'aide ? Contactez notre support
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a
                      href="tel:+24174000247"
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      +241 74 00 02 47
                    </a>
                    <a
                      href="https://wa.me/24174000247"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Note de sécurité */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                🔒 Aucun montant n'a été débité de votre compte
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-red-500 mx-auto" />
        <p className="mt-4 text-gray-600">Chargement...</p>
      </div>
    </div>
  )
}

export default function PaiementEchecPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <EchecContent />
    </Suspense>
  )
}
