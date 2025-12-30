'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, ArrowRight, Home, CreditCard, Smartphone, Banknote, Clock, Mail, Phone } from 'lucide-react'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'

export const dynamic = 'force-dynamic'

export default function CampaignPaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const paymentMethod = searchParams?.get('method') || 'mobile'
  const paymentId = searchParams?.get('payment_id')

  const getPaymentMethodInfo = () => {
    switch (paymentMethod) {
      case 'mobile':
        return {
          title: 'Paiement Mobile Money en cours',
          icon: <Smartphone className="w-16 h-16 text-blue-500" />,
          description: 'Vous allez recevoir une notification push sur votre téléphone pour valider le paiement.',
          nextSteps: [
            'Vérifiez votre téléphone pour la notification de paiement',
            'Entrez votre code PIN pour confirmer',
            'Vous recevrez un SMS de confirmation',
            'Vos campagnes seront activées après validation par notre équipe'
          ],
          estimatedTime: '5-10 minutes'
        }
      case 'card':
        return {
          title: 'Paiement par Carte en cours',
          icon: <CreditCard className="w-16 h-16 text-green-500" />,
          description: 'Votre paiement est en cours de traitement sécurisé.',
          nextSteps: [
            'Traitement du paiement par notre partenaire sécurisé',
            'Vous recevrez un email de confirmation',
            'Vos campagnes seront activées après validation',
            'Suivi disponible dans votre tableau de bord'
          ],
          estimatedTime: '2-5 minutes'
        }
      case 'cash':
        return {
          title: 'Paiement en Espèces - À Finaliser',
          icon: <Banknote className="w-16 h-16 text-yellow-500" />,
          description: 'Votre commande a été enregistrée. Veuillez vous rendre à nos bureaux pour finaliser le paiement.',
          nextSteps: [
            'Rendez-vous à l\'adresse indiquée dans votre email',
            'Apportez ce numéro de commande: ' + (paymentId || 'XXX'),
            'Effectuez le paiement en espèces',
            'Vos campagnes seront activées immédiatement'
          ],
          estimatedTime: '24-48 heures',
          isAsync: true
        }
      default:
        return {
          title: 'Commande Enregistrée',
          icon: <CheckCircle className="w-16 h-16 text-green-500" />,
          description: 'Votre commande a été enregistrée avec succès.',
          nextSteps: [
            'Nous traitons votre commande',
            'Vous recevrez un email de confirmation',
            'Vos campagnes seront activées sous peu'
          ],
          estimatedTime: '1 heure'
        }
    }
  }

  const info = getPaymentMethodInfo()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      <div className="flex min-h-screen w-full">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64 p-6 lg:p-8">
          <div className="max-w-3xl mx-auto">
            {/* Success Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 text-center mb-8">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                {info.icon}
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {info.title}
              </h1>

              {/* Description */}
              <p className="text-lg text-gray-600 mb-6">
                {info.description}
              </p>

              {/* Payment ID */}
              {paymentId && (
                <div className="bg-gray-100 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-600 mb-1">Numéro de transaction</p>
                  <p className="text-lg font-mono font-bold text-gray-900">{paymentId}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Conservez ce numéro pour référence
                  </p>
                </div>
              )}

              {/* Estimated Time */}
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full mb-6">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-semibold">Délai estimé: {info.estimatedTime}</span>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Prochaines étapes</h2>
              <div className="space-y-3">
                {info.nextSteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <p className="text-gray-700 flex-1">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl border border-orange-200 p-6 mb-8">
              <h3 className="font-bold text-gray-900 mb-4">Besoin d'aide?</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-semibold text-gray-900">support@gabon-insight.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-600">Téléphone</p>
                    <p className="font-semibold text-gray-900">+241 XX XX XX XX</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => router.push('/marketing/publicite')}
                className="flex-1 bg-white border-2 border-gray-300 text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-50 font-semibold transition-all flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-5 h-5" />
                Créer une autre campagne
              </button>
              
              <button
                onClick={() => router.push('/')}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Home className="w-5 h-5" />
                Retour à l'accueil
              </button>
            </div>

            {/* Additional Info for Cash */}
            {info.isAsync && (
              <div className="mt-8 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
                <h3 className="font-bold text-yellow-900 mb-3">💵 Informations importantes</h3>
                <ul className="space-y-2 text-sm text-yellow-800">
                  <li>• Vos campagnes ne seront PAS activées tant que le paiement n'est pas reçu</li>
                  <li>• Apportez une pièce d'identité lors de votre visite</li>
                  <li>• Horaires: Lundi-Vendredi, 9h-17h</li>
                  <li>• Vous recevrez un reçu après paiement</li>
                </ul>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
