'use client'

import { useState } from 'react'
import axios from 'axios'

interface Package {
  id: string
  name: string
  duration_days: number
  max_slides: number
  price_fcfa: number
  description: string
}

export default function CampaignRequestPage() {
  const [formData, setFormData] = useState({
    company_name: '',
    contact_email: '',
    contact_phone: '',
    start_date: '',
    end_date: '',
    package_id: '',
    visual_creation_service: false,
    message: ''
  })

  const [packages] = useState<Package[]>([
    {
      id: '1',
      name: 'Basic',
      duration_days: 7,
      max_slides: 1,
      price_fcfa: 25000,
      description: '1 bannière pendant 7 jours'
    },
    {
      id: '2', 
      name: 'Premium',
      duration_days: 15,
      max_slides: 3,
      price_fcfa: 90000,
      description: '3 bannières pendant 15 jours'
    },
    {
      id: '3',
      name: 'Pro',
      duration_days: 30,
      max_slides: 5,
      price_fcfa: 150000,
      description: '5 bannières pendant 30 jours'
    }
  ])

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const selectedPackage = packages.find(p => p.id === formData.package_id)
  const visualServicePrice = 50000
  const totalPrice = (selectedPackage?.price_fcfa || 0) + (formData.visual_creation_service ? visualServicePrice : 0)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const campaignData = {
        ...formData,
        visual_service_price: formData.visual_creation_service ? visualServicePrice : 0,
        total_price: totalPrice,
        status: 'pending',
        submission_date: new Date().toISOString()
      }

      await axios.post(`${API_URL}/api/campaigns/request`, campaignData)
      setSubmitted(true)
    } catch (error) {
      console.error('Erreur soumission:', error)
      alert('Erreur lors de la soumission de votre demande')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Demande Soumise avec Succès !
            </h1>
            <p className="text-gray-600 mb-6">
              Votre demande de campagne publicitaire a été envoyée. Notre équipe va l'examiner et vous contacter sous 24-48h.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Prochaines étapes :</h3>
              <ul className="text-sm text-blue-800 text-left space-y-1">
                <li>• Examen de votre demande par notre équipe</li>
                <li>• Validation du contenu et des visuels</li>
                <li>• Envoi des instructions de paiement</li>
                <li>• Activation de votre campagne</li>
              </ul>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Demande de Campagne Publicitaire
          </h1>
          <p className="text-gray-600 mb-8">
            Remplissez ce formulaire pour soumettre votre demande de campagne publicitaire sur Gabon Insight
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informations de l'entreprise */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Informations de l'entreprise</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom de l'entreprise *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email de contact *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.contact_email}
                    onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Sélection du forfait */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Choisissez votre forfait</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      formData.package_id === pkg.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setFormData({...formData, package_id: pkg.id})}
                  >
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-gray-900">{pkg.name}</h3>
                      <p className="text-2xl font-bold text-blue-600 my-2">
                        {pkg.price_fcfa.toLocaleString()} FCFA
                      </p>
                      <p className="text-sm text-gray-600">{pkg.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Service de création de visuels */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Service de création de visuels</h2>
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="visual_service"
                  checked={formData.visual_creation_service}
                  onChange={(e) => setFormData({...formData, visual_creation_service: e.target.checked})}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="visual_service" className="font-medium text-gray-900 cursor-pointer">
                    Demander la création de visuels par notre équipe (+50 000 FCFA)
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    Notre équipe créative peut concevoir vos bannières publicitaires selon vos spécifications. 
                    Service professionnel incluant jusqu'à 3 révisions.
                  </p>
                </div>
              </div>
            </div>

            {/* Dates de campagne */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Période de campagne</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message ou instructions particulières
              </label>
              <textarea
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Décrivez votre projet, vos attentes, ou toute information utile..."
              />
            </div>

            {/* Récapitulatif */}
            {selectedPackage && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">Récapitulatif de votre commande</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Forfait {selectedPackage.name}</span>
                    <span>{selectedPackage.price_fcfa.toLocaleString()} FCFA</span>
                  </div>
                  {formData.visual_creation_service && (
                    <div className="flex justify-between">
                      <span>Service de création de visuels</span>
                      <span>{visualServicePrice.toLocaleString()} FCFA</span>
                    </div>
                  )}
                  <div className="border-t border-blue-300 pt-2 flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>{totalPrice.toLocaleString()} FCFA</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bouton de soumission */}
            <div className="text-center">
              <button
                type="submit"
                disabled={loading || !formData.package_id}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Envoi en cours...' : 'Soumettre ma demande'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
