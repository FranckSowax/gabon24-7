'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ArrowLeft, Check, Image as ImageIcon, Loader2 } from 'lucide-react'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import axios from '@/lib/axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function BannerFeedPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // État du formulaire
  const [formData, setFormData] = useState({
    name: '',
    redirectUrl: '',
    durationDays: 7,
    designRequest: false,
    designNotes: ''
  })
  
  // État des 2 images (mobile + desktop)
  const [mobileImage, setMobileImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [desktopImage, setDesktopImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })

  const handleMobileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setMobileImage({ file, preview: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDesktopImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setDesktopImage({ file, preview: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name) {
      alert('Veuillez entrer un nom de campagne')
      return
    }
    
    if (!formData.designRequest) {
      if (!mobileImage.file || !desktopImage.file) {
        alert('Veuillez uploader les 2 images (mobile et desktop) ou demander la création du design')
        return
      }
    }
    
    if (!formData.redirectUrl) {
      alert('Veuillez entrer l\'URL de redirection')
      return
    }

    if (!user) {
      alert('Vous devez être connecté pour créer une campagne')
      return
    }

    setLoading(true)

    try {
      // Calculer le budget basé sur la durée
      const weeklyPrice = 85000 // Prix spécial
      const weeks = Math.ceil(formData.durationDays / 7)
      const totalBudget = weeklyPrice * weeks

      let mobileImageUrl = ''
      let desktopImageUrl = ''

      // Upload des images vers Supabase Storage si non design request
      if (!formData.designRequest) {
        // Upload image mobile
        if (mobileImage.file) {
          console.log('📤 Upload image mobile...')
          const mobileFormData = new FormData()
          mobileFormData.append('image', mobileImage.file)
          mobileFormData.append('imageType', 'feed-mobile')

          const mobileUploadResponse = await axios.post(`${API_URL}/api/admin/upload-image`, mobileFormData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })

          if (mobileUploadResponse.data.success) {
            mobileImageUrl = mobileUploadResponse.data.image_url
            console.log(`✅ Image mobile uploadée: ${mobileImageUrl}`)
          } else {
            throw new Error('Erreur upload image mobile')
          }
        }

        // Upload image desktop
        if (desktopImage.file) {
          console.log('📤 Upload image desktop...')
          const desktopFormData = new FormData()
          desktopFormData.append('image', desktopImage.file)
          desktopFormData.append('imageType', 'feed-desktop')

          const desktopUploadResponse = await axios.post(`${API_URL}/api/admin/upload-image`, desktopFormData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })

          if (desktopUploadResponse.data.success) {
            desktopImageUrl = desktopUploadResponse.data.image_url
            console.log(`✅ Image desktop uploadée: ${desktopImageUrl}`)
          } else {
            throw new Error('Erreur upload image desktop')
          }
        }
      }

      // Créer la campagne dans Supabase
      const campaignData = {
        user_id: user.id,
        campaign_type: 'banner-feed',
        name: formData.name,
        redirect_url: formData.redirectUrl,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + formData.durationDays * 24 * 60 * 60 * 1000).toISOString(),
        banner_image_url: desktopImageUrl || null, // Image desktop (1200x400)
        mobile_image_url: mobileImageUrl || null, // Image mobile (800x500)
        budget: totalBudget,
        status: 'pending',
        views: 0,
        clicks: 0,
        feed_position_frequency: 7, // Tous les 7 articles
        feed_images_count: 2, // 2 visuels (mobile + desktop)
        design_request: formData.designRequest,
        design_request_notes: formData.designRequest ? formData.designNotes : null
      }

      const { data, error } = await supabase
        .from('campaigns')
        .insert([campaignData])
        .select()

      if (error) {
        console.error('❌ Erreur Supabase:', error)
        throw error
      }

      console.log('✅ Campagne créée:', data)

      alert('✅ Campagne créée avec succès ! Elle sera examinée sous 24h.')
      router.push('/marketing/publicite')

    } catch (error) {
      console.error('❌ Erreur:', error)
      alert('❌ Erreur lors de la création de la campagne')
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
                <span className="text-2xl">📰</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Bannière Feed Articles</h1>
                <p className="text-gray-600">3 visuels rotatifs - Offre spéciale: 85,000 FCFA/semaine</p>
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
                    placeholder="Ex: Promotion Produits Tech"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Durée de la campagne
                  </label>
                  <select
                    value={formData.durationDays}
                    onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="7">1 semaine - 85,000 FCFA (au lieu de 150,000)</option>
                    <option value="14">2 semaines - 162,000 FCFA (au lieu de 300,000)</option>
                    <option value="21">3 semaines - 229,500 FCFA (au lieu de 450,000)</option>
                    <option value="30">1 mois - 306,000 FCFA (au lieu de 600,000)</option>
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
                    ✨ Créer le design pour moi (Inclus dans l'offre!)
                  </label>
                  <p className="text-sm text-gray-700 mb-3">
                    Notre équipe créera 2 bannières optimisées : 📱 Mobile (800x500px) et 🖥️ Desktop (1200x400px)
                  </p>
                  
                  {formData.designRequest && (
                    <textarea
                      value={formData.designNotes}
                      onChange={(e) => setFormData({ ...formData, designNotes: e.target.value })}
                      placeholder="Décrivez vos besoins : couleurs, style, message à transmettre..."
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Upload des 2 images (mobile + desktop) */}
            {!formData.designRequest && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Upload des bannières</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Uploadez 2 images optimisées pour chaque type d&apos;écran
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Image Mobile */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">📱</span>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700">
                          Image Mobile *
                        </label>
                        <p className="text-xs text-gray-500">800 x 500 px (ratio 16:10)</p>
                      </div>
                    </div>
                    
                    {mobileImage.preview ? (
                      <div className="relative">
                        <img src={mobileImage.preview} alt="Preview Mobile" className="w-full rounded-lg border border-gray-300" />
                        <button
                          type="button"
                          onClick={() => setMobileImage({ file: null, preview: null })}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="block border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer">
                        <ImageIcon className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-700 font-medium mb-1">Cliquez pour uploader</p>
                        <p className="text-xs text-blue-600 font-semibold">800 x 500 px</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleMobileImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Image Desktop */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">🖥️</span>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700">
                          Image Desktop *
                        </label>
                        <p className="text-xs text-gray-500">1200 x 400 px (ratio 3:1)</p>
                      </div>
                    </div>
                    
                    {desktopImage.preview ? (
                      <div className="relative">
                        <img src={desktopImage.preview} alt="Preview Desktop" className="w-full rounded-lg border border-gray-300" />
                        <button
                          type="button"
                          onClick={() => setDesktopImage({ file: null, preview: null })}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="block border-2 border-dashed border-orange-300 rounded-lg p-8 text-center hover:border-orange-500 hover:bg-orange-50 transition-colors cursor-pointer">
                        <ImageIcon className="w-12 h-12 text-orange-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-700 font-medium mb-1">Cliquez pour uploader</p>
                        <p className="text-xs text-orange-600 font-semibold">1200 x 400 px</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleDesktopImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Info dimensions */}
                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    💡 <strong>Conseil :</strong> Utilisez des images de haute qualité. L&apos;image mobile s&apos;affichera sur smartphones, 
                    l&apos;image desktop sur ordinateurs avec un effet parallaxe élégant.
                  </p>
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
