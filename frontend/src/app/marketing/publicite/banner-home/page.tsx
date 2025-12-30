'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, ArrowLeft, Check, Image as ImageIcon } from 'lucide-react'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { useAuth } from '@/contexts/AuthContext'

export default function BannerHomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // État du formulaire
  const [formData, setFormData] = useState({
    name: '',
    bannerTitle: '',
    bannerDescription: '',
    redirectUrl: '',
    startDate: '',
    durationDays: 7,
    designRequest: false,
    designNotes: ''
  })
  
  // État des fichiers
  const [desktopImage, setDesktopImage] = useState<File | null>(null)
  const [mobileImage, setMobileImage] = useState<File | null>(null)
  const [desktopPreview, setDesktopPreview] = useState<string | null>(null)
  const [mobilePreview, setMobilePreview] = useState<string | null>(null)

  const handleDesktopImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setDesktopImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setDesktopPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleMobileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setMobileImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setMobilePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeDesktopImage = () => {
    setDesktopImage(null)
    setDesktopPreview(null)
  }

  const removeMobileImage = () => {
    setMobileImage(null)
    setMobilePreview(null)
  }

  const calculateBudget = () => {
    // Prix de base selon la durée
    let baseBudget = 0
    switch(formData.durationDays) {
      case 7: baseBudget = 50000; break
      case 14: baseBudget = 90000; break
      case 21: baseBudget = 130000; break
      case 30: baseBudget = 160000; break
      default: baseBudget = 50000
    }
    
    // Ajouter le coût de création design si demandé
    const designCost = formData.designRequest ? 50000 : 0
    
    return baseBudget + designCost
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name) {
      alert('Veuillez entrer un nom de campagne')
      return
    }
    
    if (!formData.startDate) {
      alert('Veuillez sélectionner une date de démarrage')
      return
    }
    
    if (!formData.designRequest && (!desktopImage || !mobileImage)) {
      alert('Veuillez uploader les deux images (Desktop et Mobile) ou demander la création du design')
      return
    }
    
    if (!formData.bannerTitle || !formData.bannerDescription) {
      alert('Veuillez remplir le titre et la description')
      return
    }
    
    if (!formData.redirectUrl) {
      alert('Veuillez entrer l\'URL de redirection')
      return
    }

    setLoading(true)

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      
      // Upload des images vers Supabase Storage (si pas de demande design)
      let desktopImageUrl = ''
      let mobileImageUrl = ''

      if (!formData.designRequest && desktopImage && mobileImage) {
        // Upload desktop image
        const desktopFormData = new FormData()
        desktopFormData.append('file', desktopImage)
        const desktopRes = await fetch(`${API_URL}/api/upload`, { 
          method: 'POST', 
          body: desktopFormData 
        })
        const desktopData = await desktopRes.json()
        desktopImageUrl = desktopData.url || desktopPreview || ''

        // Upload mobile image
        const mobileFormData = new FormData()
        mobileFormData.append('file', mobileImage)
        const mobileRes = await fetch(`${API_URL}/api/upload`, { 
          method: 'POST', 
          body: mobileFormData 
        })
        const mobileData = await mobileRes.json()
        mobileImageUrl = mobileData.url || mobilePreview || ''
      }

      // Calculer le budget total
      const totalBudget = calculateBudget()

      // Créer la campagne
      const campaignData = {
        campaign_type: 'banner-home',
        name: formData.name,
        banner_title: formData.bannerTitle,
        banner_description: formData.bannerDescription,
        redirect_url: formData.redirectUrl,
        start_date: formData.startDate,
        duration_days: formData.durationDays,
        desktop_image_url: desktopImageUrl,
        mobile_image_url: mobileImageUrl,
        design_request: formData.designRequest,
        design_request_notes: formData.designNotes,
        budget: totalBudget,
        status: 'pending'
      }

      console.log('📤 Envoi campagne:', campaignData)

      // Envoyer au backend
      const response = await fetch(`${API_URL}/api/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(campaignData)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert(`✅ Campagne créée avec succès !\n\nBudget total: ${totalBudget.toLocaleString()} FCFA\nDémarrage: ${new Date(formData.startDate).toLocaleDateString('fr-FR')}\n\nVotre campagne sera validée sous 24h.`)
        router.push('/marketing/publicite')
      } else {
        throw new Error(result.error || 'Erreur lors de la création')
      }
    } catch (error) {
      console.error('❌ Erreur:', error)
      alert('❌ Erreur lors de la création de la campagne. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      <div className="flex min-h-screen w-full">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64 p-6 lg:p-8 max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              Retour
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🏠</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Bannière Page d'Accueil</h1>
                <p className="text-gray-600">Position premium en haut de la page - 100,000 FCFA/semaine</p>
              </div>
            </div>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Informations générales */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Informations de la campagne</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nom de la campagne *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Promotion Nouvel An 2025"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Titre de la bannière *
                  </label>
                  <input
                    type="text"
                    value={formData.bannerTitle}
                    onChange={(e) => setFormData({ ...formData, bannerTitle: e.target.value })}
                    placeholder="Titre accrocheur"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description courte *
                  </label>
                  <textarea
                    value={formData.bannerDescription}
                    onChange={(e) => setFormData({ ...formData, bannerDescription: e.target.value })}
                    placeholder="Description courte et impactante"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    URL de redirection *
                  </label>
                  <input
                    type="url"
                    value={formData.redirectUrl}
                    onChange={(e) => setFormData({ ...formData, redirectUrl: e.target.value })}
                    placeholder="https://votresite.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Date de démarrage *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Programmez la date de début de votre campagne</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Durée de la campagne
                  </label>
                  <select
                    value={formData.durationDays}
                    onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="7">1 semaine (50,000 FCFA)</option>
                    <option value="14">2 semaines (90,000 FCFA)</option>
                    <option value="21">3 semaines (130,000 FCFA)</option>
                    <option value="30">1 mois (160,000 FCFA)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Option : Créer le design pour moi */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="designRequest"
                  checked={formData.designRequest}
                  onChange={(e) => setFormData({ ...formData, designRequest: e.target.checked })}
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <label htmlFor="designRequest" className="block text-sm font-semibold text-gray-900 mb-1 cursor-pointer">
                    ✨ Créer le design pour moi (+50,000 FCFA)
                  </label>
                  <p className="text-sm text-gray-700 mb-3">
                    Notre équipe de designers créera des bannières professionnelles optimisées pour desktop et mobile
                  </p>
                  
                  {formData.designRequest && (
                    <textarea
                      value={formData.designNotes}
                      onChange={(e) => setFormData({ ...formData, designNotes: e.target.value })}
                      placeholder="Décrivez vos besoins : couleurs préférées, style, éléments à inclure..."
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Upload des images (si pas de demande de design) */}
            {!formData.designRequest && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Upload des bannières</h2>
                
                <div className="space-y-6">
                  {/* Desktop */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      🖥️ Image Desktop (1200x300px) *
                    </label>
                    
                    {desktopPreview ? (
                      <div className="relative">
                        <img src={desktopPreview} alt="Preview desktop" className="w-full rounded-lg border border-gray-300" />
                        <button
                          type="button"
                          onClick={removeDesktopImage}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                        <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600 mb-1">Cliquez ou glissez votre image ici</p>
                        <p className="text-xs text-gray-400">Format: 1200x300px (JPG, PNG, max 5MB)</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleDesktopImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Mobile */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      📱 Image Mobile (800x400px) *
                    </label>
                    
                    {mobilePreview ? (
                      <div className="relative max-w-md">
                        <img src={mobilePreview} alt="Preview mobile" className="w-full rounded-lg border border-gray-300" />
                        <button
                          type="button"
                          onClick={removeMobileImage}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer max-w-md">
                        <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600 mb-1">Cliquez ou glissez votre image ici</p>
                        <p className="text-xs text-gray-400">Format: 800x400px (JPG, PNG, max 5MB)</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleMobileImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Boutons d'action */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Soumettre pour validation
                  </>
                )}
              </button>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                ℹ️ Votre campagne sera examinée par notre équipe sous 24h. Vous recevrez une notification par email.
              </p>
            </div>
          </form>
        </main>
      </div>
    </div>
  )
}
