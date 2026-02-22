'use client'

import { useState, useEffect } from 'react'
import axios from '@/lib/axios'

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

interface SlideData {
  title: string
  description: string
  image_url: string
  link_url: string
  cta_text: string
  display_order: number
}

export default function AdvertisePage() {
  const [packages, setPackages] = useState<AdPackage[]>([])
  const [selectedPackage, setSelectedPackage] = useState<AdPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'packages' | 'company' | 'slides' | 'payment' | 'confirmation'>('packages')
  
  // Données de l'entreprise
  const [companyData, setCompanyData] = useState({
    company_name: '',
    contact_email: '',
    contact_phone: '',
    start_date: ''
  })

  // Données des slides
  const [slides, setSlides] = useState<SlideData[]>([])

  // État du formulaire
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [submitting, setSubmitting] = useState(false)

  // Récupérer les forfaits disponibles
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

  // Valider les données de l'entreprise
  const validateCompanyData = () => {
    const newErrors: {[key: string]: string} = {}
    
    if (!companyData.company_name.trim()) {
      newErrors.company_name = 'Le nom de l\'entreprise est requis'
    }
    
    if (!companyData.contact_email.trim()) {
      newErrors.contact_email = 'L\'email de contact est requis'
    } else if (!/\S+@\S+\.\S+/.test(companyData.contact_email)) {
      newErrors.contact_email = 'Format d\'email invalide'
    }
    
    if (!companyData.contact_phone.trim()) {
      newErrors.contact_phone = 'Le téléphone de contact est requis'
    }
    
    if (!companyData.start_date) {
      newErrors.start_date = 'La date de début est requise'
    } else {
      const startDate = new Date(companyData.start_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (startDate < today) {
        newErrors.start_date = 'La date de début doit être aujourd\'hui ou dans le futur'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Valider les slides
  const validateSlides = () => {
    const newErrors: {[key: string]: string} = {}
    
    if (slides.length === 0) {
      newErrors.slides = 'Au moins un slide est requis'
    }

    slides.forEach((slide, index) => {
      if (!slide.title.trim()) {
        newErrors[`slide_${index}_title`] = 'Le titre est requis'
      }
      if (!slide.cta_text.trim()) {
        newErrors[`slide_${index}_cta`] = 'Le texte du bouton est requis'
      }
      if (slide.link_url && !/^https?:\/\/.+/.test(slide.link_url)) {
        newErrors[`slide_${index}_url`] = 'URL invalide (doit commencer par http:// ou https://)'
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Ajouter un slide
  const addSlide = () => {
    if (selectedPackage && slides.length < selectedPackage.max_slides) {
      setSlides([...slides, {
        title: '',
        description: '',
        image_url: '',
        link_url: '',
        cta_text: 'En savoir plus',
        display_order: slides.length + 1
      }])
    }
  }

  // Supprimer un slide
  const removeSlide = (index: number) => {
    const newSlides = slides.filter((_, i) => i !== index)
    setSlides(newSlides.map((slide, i) => ({ ...slide, display_order: i + 1 })))
  }

  // Mettre à jour un slide
  const updateSlide = (index: number, field: keyof SlideData, value: string | number) => {
    const newSlides = [...slides]
    newSlides[index] = { ...newSlides[index], [field]: value }
    setSlides(newSlides)
  }

  // Soumettre la campagne
  const submitCampaign = async () => {
    if (!selectedPackage) return

    setSubmitting(true)
    try {
      const campaignData = {
        package_id: selectedPackage.id,
        company_name: companyData.company_name,
        contact_email: companyData.contact_email,
        contact_phone: companyData.contact_phone,
        start_date: companyData.start_date,
        slides: slides
      }

      const response = await axios.post(`${API_URL}/api/campaigns`, campaignData)
      
      if (response.data.success) {
        setStep('confirmation')
      } else {
        alert('Erreur lors de la création de la campagne')
      }
    } catch (error) {
      console.error('Erreur soumission:', error)
      alert('Erreur lors de la soumission')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des forfaits...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Publicité sur Gabon Insight
          </h1>
          <p className="text-gray-600">
            Faites connaître votre entreprise auprès de milliers de lecteurs
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {[
              { id: 'packages', label: 'Forfait', icon: '📦' },
              { id: 'company', label: 'Entreprise', icon: '🏢' },
              { id: 'slides', label: 'Slides', icon: '🖼️' },
              { id: 'payment', label: 'Paiement', icon: '💳' },
              { id: 'confirmation', label: 'Confirmation', icon: '✅' }
            ].map((stepItem, index) => (
              <div key={stepItem.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  step === stepItem.id 
                    ? 'bg-orange-500 text-white' 
                    : index < ['packages', 'company', 'slides', 'payment', 'confirmation'].indexOf(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  <span className="text-sm">{stepItem.icon}</span>
                </div>
                <span className="ml-2 text-sm font-medium">{stepItem.label}</span>
                {index < 4 && <div className="w-8 h-px bg-gray-300 mx-4"></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Étape 1: Sélection du forfait */}
        {step === 'packages' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-center mb-6">Choisissez votre forfait</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`bg-white rounded-lg shadow-sm border-2 p-6 cursor-pointer transition-all ${
                    selectedPackage?.id === pkg.id 
                      ? 'border-orange-500 ring-2 ring-orange-200' 
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                  onClick={() => setSelectedPackage(pkg)}
                >
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{pkg.name}</h3>
                    <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span>Durée:</span>
                        <span className="font-medium">{pkg.duration_days} jours</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Max slides:</span>
                        <span className="font-medium">{pkg.max_slides}</span>
                      </div>
                    </div>
                    
                    <div className="text-3xl font-bold text-orange-600 mb-4">
                      {pkg.price.toLocaleString()} FCFA
                    </div>
                    
                    {selectedPackage?.id === pkg.id && (
                      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                        ✓ Sélectionné
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {selectedPackage && (
              <div className="text-center">
                <button
                  onClick={() => setStep('company')}
                  className="bg-orange-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  Continuer
                </button>
              </div>
            )}
          </div>
        )}

        {/* Étape 2: Informations entreprise */}
        {step === 'company' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold mb-6">Informations de votre entreprise</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'entreprise *
                </label>
                <input
                  type="text"
                  value={companyData.company_name}
                  onChange={(e) => setCompanyData({...companyData, company_name: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500 ${
                    errors.company_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Mon Entreprise SARL"
                />
                {errors.company_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.company_name}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email de contact *
                </label>
                <input
                  type="email"
                  value={companyData.contact_email}
                  onChange={(e) => setCompanyData({...companyData, contact_email: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500 ${
                    errors.contact_email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="contact@monentreprise.com"
                />
                {errors.contact_email && (
                  <p className="text-red-500 text-sm mt-1">{errors.contact_email}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone de contact *
                </label>
                <input
                  type="tel"
                  value={companyData.contact_phone}
                  onChange={(e) => setCompanyData({...companyData, contact_phone: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500 ${
                    errors.contact_phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="+241 XX XX XX XX"
                />
                {errors.contact_phone && (
                  <p className="text-red-500 text-sm mt-1">{errors.contact_phone}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de début souhaitée *
                </label>
                <input
                  type="date"
                  value={companyData.start_date}
                  onChange={(e) => setCompanyData({...companyData, start_date: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500 ${
                    errors.start_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                  min={new Date().toISOString().split('T')[0]}
                />
                {errors.start_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.start_date}</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep('packages')}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
              >
                Retour
              </button>
              <button
                onClick={() => {
                  if (validateCompanyData()) {
                    setStep('slides')
                  }
                }}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* Étape 3: Création des slides */}
        {step === 'slides' && selectedPackage && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">Créez vos slides publicitaires</h2>
                <div className="text-sm text-gray-600">
                  {slides.length} / {selectedPackage.max_slides} slides
                </div>
              </div>
              
              {errors.slides && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-red-600">{errors.slides}</p>
                </div>
              )}
              
              {slides.map((slide, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Slide {index + 1}</h3>
                    <button
                      onClick={() => removeSlide(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Supprimer
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Titre *
                      </label>
                      <input
                        type="text"
                        value={slide.title}
                        onChange={(e) => updateSlide(index, 'title', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500 ${
                          errors[`slide_${index}_title`] ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Titre accrocheur de votre publicité"
                      />
                      {errors[`slide_${index}_title`] && (
                        <p className="text-red-500 text-sm mt-1">{errors[`slide_${index}_title`]}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Texte du bouton *
                      </label>
                      <input
                        type="text"
                        value={slide.cta_text}
                        onChange={(e) => updateSlide(index, 'cta_text', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500 ${
                          errors[`slide_${index}_cta`] ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Ex: Découvrir, Acheter maintenant"
                      />
                      {errors[`slide_${index}_cta`] && (
                        <p className="text-red-500 text-sm mt-1">{errors[`slide_${index}_cta`]}</p>
                      )}
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={slide.description}
                        onChange={(e) => updateSlide(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                        rows={2}
                        placeholder="Description courte de votre offre"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL de l'image
                      </label>
                      <input
                        type="url"
                        value={slide.image_url}
                        onChange={(e) => updateSlide(index, 'image_url', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                        placeholder="https://exemple.com/image.jpg"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL de destination
                      </label>
                      <input
                        type="url"
                        value={slide.link_url}
                        onChange={(e) => updateSlide(index, 'link_url', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500 ${
                          errors[`slide_${index}_url`] ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="https://votre-site.com"
                      />
                      {errors[`slide_${index}_url`] && (
                        <p className="text-red-500 text-sm mt-1">{errors[`slide_${index}_url`]}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {slides.length < selectedPackage.max_slides && (
                <button
                  onClick={addSlide}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-orange-300 hover:text-orange-500 transition-colors"
                >
                  + Ajouter un slide
                </button>
              )}
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setStep('company')}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
              >
                Retour
              </button>
              <button
                onClick={() => {
                  if (validateSlides()) {
                    setStep('payment')
                  }
                }}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* Étape 4: Récapitulatif et paiement */}
        {step === 'payment' && selectedPackage && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold mb-6">Récapitulatif de votre commande</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-medium mb-4">Détails de la campagne</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Forfait:</span>
                    <span className="font-medium">{selectedPackage.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Durée:</span>
                    <span className="font-medium">{selectedPackage.duration_days} jours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nombre de slides:</span>
                    <span className="font-medium">{slides.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Entreprise:</span>
                    <span className="font-medium">{companyData.company_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date de début:</span>
                    <span className="font-medium">
                      {new Date(companyData.start_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total:</span>
                    <span className="text-orange-600">{selectedPackage.price.toLocaleString()} FCFA</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-4">Aperçu des slides</h3>
                <div className="space-y-3">
                  {slides.map((slide, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <h4 className="font-medium text-sm">{slide.title}</h4>
                      {slide.description && (
                        <p className="text-xs text-gray-600 mt-1">{slide.description}</p>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          {slide.cta_text}
                        </span>
                        {slide.image_url && (
                          <span className="text-xs text-gray-500">🖼️ Image incluse</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <span className="text-yellow-600 mr-2">ℹ️</span>
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Processus de validation</p>
                  <p>
                    Votre campagne sera soumise pour approbation après paiement. 
                    Elle sera active dans un délai de 24-48h après validation par notre équipe.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep('slides')}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
              >
                Retour
              </button>
              <button
                onClick={submitCampaign}
                disabled={submitting}
                className="bg-orange-500 text-white px-8 py-3 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Création en cours...' : 'Créer la campagne'}
              </button>
            </div>
          </div>
        )}

        {/* Étape 5: Confirmation */}
        {step === 'confirmation' && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✅</span>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Campagne créée avec succès !
              </h2>
              <p className="text-gray-600">
                Votre campagne publicitaire a été soumise pour validation.
              </p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-900 mb-2">Prochaines étapes</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p>1. Notre équipe va examiner votre campagne</p>
                <p>2. Vous recevrez un email de confirmation dans les 24h</p>
                <p>3. Après approbation, votre campagne sera activée</p>
                <p>4. Vous recevrez des rapports de performance réguliers</p>
              </div>
            </div>
            
            <div className="text-sm text-gray-600 mb-6">
              <p>Un email de confirmation a été envoyé à <strong>{companyData.contact_email}</strong></p>
            </div>
            
            <button
              onClick={() => {
                // Reset form
                setStep('packages')
                setSelectedPackage(null)
                setCompanyData({
                  company_name: '',
                  contact_email: '',
                  contact_phone: '',
                  start_date: ''
                })
                setSlides([])
                setErrors({})
              }}
              className="bg-orange-500 text-white px-8 py-3 rounded-lg hover:bg-orange-600"
            >
              Créer une nouvelle campagne
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
