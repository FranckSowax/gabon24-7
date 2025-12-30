'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ArrowLeft, Check, Video as VideoIcon, ShoppingCart } from 'lucide-react'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import AvailabilityChecker from '@/components/campaigns/AvailabilityChecker'
import { addToCart } from '@/lib/cart'

export default function VideoHomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isAvailable, setIsAvailable] = useState(true)
  
  // État du formulaire
  const [formData, setFormData] = useState({
    name: '',
    videoTitle: '',
    videoDescription: '',
    redirectUrl: '',
    durationDays: 7,
    startDate: '',
    designRequest: false,
    designNotes: ''
  })
  
  // État de la vidéo
  const [video, setVideo] = useState<{
    file: File | null
    preview: string | null
  }>({
    file: null,
    preview: null
  })

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Vérifier la taille (max 10MB pour optimisation)
      if (file.size > 10 * 1024 * 1024) {
        alert('La vidéo ne doit pas dépasser 10 MB pour un chargement rapide du modal')
        return
      }

      // Vérifier le format
      if (!file.type.startsWith('video/')) {
        alert('Veuillez sélectionner un fichier vidéo valide')
        return
      }

      const url = URL.createObjectURL(file)
      setVideo({
        file: file,
        preview: url
      })
    }
  }

  const removeVideo = () => {
    if (video.preview) {
      URL.revokeObjectURL(video.preview)
    }
    setVideo({ file: null, preview: null })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name) {
      alert('Veuillez entrer un nom de campagne')
      return
    }
    
    if (!formData.designRequest && !video.file) {
      alert('Veuillez uploader une vidéo ou demander la création')
      return
    }
    
    if (!formData.videoTitle || !formData.videoDescription) {
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
      let videoUrl = ''

      // Upload vidéo si pas de demande de design
      if (!formData.designRequest && video.file) {
        const videoFormData = new FormData()
        videoFormData.append('video', video.file)

        console.log('📤 Upload de la vidéo...')
        const uploadResponse = await fetch(`${API_URL}/api/admin/upload-video`, {
          method: 'POST',
          body: videoFormData
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.message || 'Erreur lors de l\'upload vidéo')
        }

        const uploadData = await uploadResponse.json()
        videoUrl = uploadData.video_url
        console.log('✅ Vidéo uploadée:', videoUrl)
      }

      // Calculer le budget (inclure création vidéo si demandée)
      const baseBudget = 450000
      const designCost = formData.designRequest ? 300000 : 0
      const totalBudget = baseBudget + designCost

      // Ajouter au panier
      const cartItem = addToCart({
        campaign_type: 'video-home',
        name: formData.name,
        budget: totalBudget,
        duration_days: formData.durationDays,
        start_date: formData.startDate,
        details: {
          video_title: formData.videoTitle,
          video_description: formData.videoDescription,
          redirect_url: formData.redirectUrl,
          video_url: videoUrl,
          design_request: formData.designRequest,
          design_request_notes: formData.designNotes
        }
      })

      console.log('✅ Campagne ajoutée au panier:', cartItem)
      
      // Afficher confirmation
      const goToCheckout = confirm(
        `✅ Campagne ajoutée au panier!\n\nMontant: ${totalBudget.toLocaleString()} FCFA\n\nVoulez-vous procéder au paiement maintenant?`
      )

      if (goToCheckout) {
        router.push('/checkout-campaigns')
      } else {
        router.push('/marketing/publicite')
      }
    } catch (error: any) {
      console.error('Erreur:', error)
      alert(`❌ Erreur: ${error.message || 'Erreur lors de la création de la campagne'}`)
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
                <span className="text-2xl">🎬</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Vidéo Home</h1>
                <p className="text-gray-600">Vidéo publicitaire pop-up au lancement - 450,000 FCFA/semaine</p>
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
                    placeholder="Ex: Lancement Nouveau Produit"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Titre de la vidéo *
                  </label>
                  <input
                    type="text"
                    value={formData.videoTitle}
                    onChange={(e) => setFormData({ ...formData, videoTitle: e.target.value })}
                    placeholder="Titre accrocheur"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.videoDescription}
                    onChange={(e) => setFormData({ ...formData, videoDescription: e.target.value })}
                    placeholder="Description de la vidéo"
                    rows={3}
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
                    <option value="7">1 semaine (450,000 FCFA)</option>
                    <option value="14">2 semaines (855,000 FCFA)</option>
                    <option value="21">3 semaines (1,215,000 FCFA)</option>
                    <option value="30">1 mois (1,620,000 FCFA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Date de début de la campagne *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    La vidéo sera affichée dès cette date aux visiteurs de votre site
                  </p>
                </div>
              </div>
            </div>

            {/* Vérification disponibilité créneaux */}
            {formData.startDate && formData.durationDays > 0 && (
              <AvailabilityChecker
                campaignType="video-home"
                startDate={formData.startDate}
                durationDays={formData.durationDays}
                onAvailabilityChange={setIsAvailable}
              />
            )}

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
                    ✨ Créer la vidéo pour moi (+300,000 FCFA)
                  </label>
                  <p className="text-sm text-gray-700 mb-3">
                    Notre équipe créera une vidéo publicitaire professionnelle optimisée pour modal (montage, motion design, animations, voix-off)
                  </p>
                  
                  {formData.designRequest && (
                    <textarea
                      value={formData.designNotes}
                      onChange={(e) => setFormData({ ...formData, designNotes: e.target.value })}
                      placeholder="Décrivez votre vision : style, message, call-to-action, éléments visuels..."
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Upload de la vidéo */}
            {!formData.designRequest && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Upload de la vidéo</h2>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Formats supportés:</strong> MP4 (H.264), WebM • <strong>Durée:</strong> 15-30 secondes • <strong>Taille max:</strong> 10 MB
                </p>
                
                {/* Info sur le format modal */}
                <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-bold text-orange-900 mb-2">⚠️ FORMAT VIDÉO REQUIS - CARRÉ</h3>
                  <ul className="text-xs text-orange-900 space-y-1.5">
                    <li>• <strong className="text-orange-600">Résolution OBLIGATOIRE:</strong> 1080x1080 pixels (format carré 1:1)</li>
                    <li>• <strong>Pourquoi carré?</strong> S'adapte parfaitement desktop ET mobile sans déformation</li>
                    <li>• <strong>Format:</strong> MP4 (codec H.264) pour compatibilité maximale</li>
                    <li>• <strong>Compression:</strong> Optimisez votre vidéo avant upload (HandBrake, FFmpeg)</li>
                    <li>• <strong>Affichage:</strong> Pop-up/modal centré avec bouton fermer après 5 secondes</li>
                    <li>• <strong>Déclenchement:</strong> Au lancement de l'app (1 fois par jour par utilisateur)</li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-800">
                    💡 <strong>Conseil:</strong> Utilisez un outil comme <strong>Canva</strong> ou <strong>Adobe Premiere</strong> pour créer une vidéo carrée 1080x1080. Format idéal pour réseaux sociaux!
                  </p>
                </div>
                
                {video.preview ? (
                  <div className="relative">
                    <video
                      src={video.preview}
                      controls
                      className="w-full max-w-2xl rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {video.file && (
                      <p className="mt-2 text-sm text-gray-600">
                        📁 {video.file.name} ({(video.file.size / (1024 * 1024)).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                ) : (
                  <label className="block border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-orange-500 transition-colors cursor-pointer max-w-2xl">
                    <VideoIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2 font-semibold">Cliquez ou glissez votre vidéo ici</p>
                    <p className="text-sm text-orange-600 font-bold mb-1">📐 Format CARRÉ requis: 1080x1080</p>
                    <p className="text-sm text-gray-400">MP4 ou WebM • 15-30 secondes • Max 10 MB</p>
                    <input
                      type="file"
                      accept="video/mp4,video/webm"
                      onChange={handleVideoChange}
                      className="hidden"
                    />
                  </label>
                )}
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
                disabled={loading || !isAvailable}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title={!isAvailable ? 'Créneau non disponible pour cette période' : ''}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {isAvailable ? 'Soumettre pour validation' : 'Créneau non disponible'}
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
