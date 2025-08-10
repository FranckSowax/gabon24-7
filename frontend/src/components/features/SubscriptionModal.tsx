import React, { useState } from 'react'

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubscribe: (plan: string) => void
}

export default function SubscriptionModal({ isOpen, onClose, onSubscribe }: SubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState('premium')

  const plans = [
    {
      id: 'free',
      name: 'Gratuit',
      price: '0 XAF',
      period: '/mois',
      features: [
        'Accès au canal WhatsApp public',
        'Résumés d\'actualités quotidiens',
        'Notifications de base',
        'Accès limité aux archives'
      ],
      color: 'gray',
      popular: false
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '2,500 XAF',
      period: '/mois',
      features: [
        'Messages WhatsApp personnalisés',
        'Résumés détaillés et analyses',
        'Notifications en temps réel',
        'Accès complet aux archives',
        'Filtrage par mots-clés',
        'Support prioritaire'
      ],
      color: 'orange',
      popular: true
    },
    {
      id: 'journalist',
      name: 'Journaliste',
      price: '5,000 XAF',
      period: '/mois',
      features: [
        'Tout du plan Premium',
        'Accès aux sources primaires',
        'Outils d\'analyse avancés',
        'API pour intégrations',
        'Alertes personnalisées',
        'Support dédié 24/7'
      ],
      color: 'blue',
      popular: false
    }
  ]

  const handleSubscribe = () => {
    onSubscribe(selectedPlan)
    onClose()
  }

  const handleWhatsAppContact = () => {
    const plan = plans.find(p => p.id === selectedPlan)
    const message = `Bonjour! Je souhaite m'abonner au plan ${plan?.name} (${plan?.price}${plan?.period}) de GabonNews.`
    window.open(`https://wa.me/24177123456?text=${encodeURIComponent(message)}`, '_blank')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Choisissez votre abonnement</h2>
              <p className="text-gray-600 mt-1">Accédez aux meilleures actualités gabonaises</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all ${
                  selectedPlan === plan.id
                    ? `border-${plan.color}-500 bg-${plan.color}-50`
                    : 'border-gray-200 hover:border-gray-300'
                } ${plan.popular ? 'ring-2 ring-orange-500 ring-opacity-50' : ''}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Plus Populaire
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500 ml-1">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-600 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-center">
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    selectedPlan === plan.id
                      ? `bg-${plan.color}-500 border-${plan.color}-500`
                      : 'border-gray-300'
                  }`}>
                    {selectedPlan === plan.id && (
                      <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleWhatsAppContact}
              className="flex items-center justify-center px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.700"/>
              </svg>
              Contacter via WhatsApp
            </button>
            
            <button
              onClick={handleSubscribe}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              S'abonner Maintenant
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Paiement sécurisé via Airtel Money et Moov Money
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Annulation possible à tout moment • Support client 24/7
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
