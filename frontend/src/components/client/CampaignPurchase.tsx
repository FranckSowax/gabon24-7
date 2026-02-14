'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AdPackage {
  id: string
  name: string
  description: string
  duration_days: number
  max_slides: number
  price: number
  is_active: boolean
}

interface CampaignPurchaseProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export default function CampaignPurchase({ onSuccess, onCancel }: CampaignPurchaseProps) {
  const [packages, setPackages] = useState<AdPackage[]>([])
  const [selectedPackage, setSelectedPackage] = useState<AdPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    company_name: '',
    contact_email: '',
    contact_phone: '',
    start_date: '',
    slides: [{
      title: '',
      description: '',
      image_url: '',
      link_url: '',
      cta_text: 'En savoir plus',
      display_order: 1
    }]
  })

  const fetchPackages = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/ad-packages`)
      if (response.data.success) {
        setPackages(response.data.packages.filter((pkg: AdPackage) => pkg.is_active))
      }
    } catch (error) {
      console.error('Erreur chargement forfaits:', error)
    } finally {
      setLoading(false)
    }
  }

  const addSlide = () => {
    if (selectedPackage && formData.slides.length < selectedPackage.max_slides) {
      setFormData({
        ...formData,
        slides: [...formData.slides, {
          title: '',
          description: '',
          image_url: '',
          link_url: '',
          cta_text: 'En savoir plus',
          display_order: formData.slides.length + 1
        }]
      })
    }
  }

  const removeSlide = (index: number) => {
    const newSlides = formData.slides.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      slides: newSlides.map((slide, i) => ({ ...slide, display_order: i + 1 }))
    })
  }

  const updateSlide = (index: number, field: string, value: string) => {
    const newSlides = [...formData.slides]
    newSlides[index] = { ...newSlides[index], [field]: value }
    setFormData({ ...formData, slides: newSlides })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPackage) return

    setSubmitting(true)
    try {
      const campaignData = {
        package_id: selectedPackage.id,
        ...formData
      }

      const response = await axios.post(`${API_URL}/api/campaigns`, campaignData)
      
      if (response.data.success) {
        alert('Campagne créée avec succès ! Elle sera examinée par notre équipe.')
        onSuccess?.()
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la création de la campagne')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  if (loading) {
    return <div className="p-8 text-center">Chargement des forfaits...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Créer une campagne publicitaire
        </h2>
        <p className="text-gray-600">
          Choisissez votre forfait et créez vos slides promotionnels
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Sélection forfait */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Choisissez votre forfait</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedPackage?.id === pkg.id 
                    ? 'border-orange-500 bg-orange-50' 
                    : 'border-gray-200 hover:border-orange-300'
                }`}
                onClick={() => setSelectedPackage(pkg)}
              >
                <h4 className="font-semibold">{pkg.name}</h4>
                <p className="text-sm text-gray-600 mb-2">{pkg.description}</p>
                <div className="text-sm space-y-1">
                  <div>Durée: {pkg.duration_days} jours</div>
                  <div>Max slides: {pkg.max_slides}</div>
                  <div className="font-bold text-orange-600">
                    {pkg.price.toLocaleString()} FCFA
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedPackage && (
          <>
            {/* Informations entreprise */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Informations entreprise</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Nom de l'entreprise"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                  required
                />
                <input
                  type="email"
                  placeholder="Email de contact"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                  required
                />
                <input
                  type="tel"
                  placeholder="Téléphone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                  required
                />
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            {/* Slides */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Vos slides publicitaires</h3>
                <span className="text-sm text-gray-600">
                  {formData.slides.length} / {selectedPackage.max_slides}
                </span>
              </div>

              {formData.slides.map((slide, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">Slide {index + 1}</h4>
                    {formData.slides.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlide(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Titre du slide"
                      value={slide.title}
                      onChange={(e) => updateSlide(index, 'title', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Texte du bouton"
                      value={slide.cta_text}
                      onChange={(e) => updateSlide(index, 'cta_text', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                      required
                    />
                    <input
                      type="url"
                      placeholder="URL de l'image (optionnel)"
                      value={slide.image_url}
                      onChange={(e) => updateSlide(index, 'image_url', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                    <input
                      type="url"
                      placeholder="URL de destination"
                      value={slide.link_url}
                      onChange={(e) => updateSlide(index, 'link_url', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                    <textarea
                      placeholder="Description (optionnel)"
                      value={slide.description}
                      onChange={(e) => updateSlide(index, 'description', e.target.value)}
                      className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                      rows={2}
                    />
                  </div>
                </div>
              ))}

              {formData.slides.length < selectedPackage.max_slides && (
                <button
                  type="button"
                  onClick={addSlide}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-orange-300 hover:text-orange-500"
                >
                  + Ajouter un slide
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {submitting ? 'Création...' : `Créer la campagne (${selectedPackage.price.toLocaleString()} FCFA)`}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
