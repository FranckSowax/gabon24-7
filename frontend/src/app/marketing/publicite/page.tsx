'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Sparkles, Video, TrendingUp, BarChart3, Eye, MousePointerClick, Calendar } from 'lucide-react'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { Loading } from '@/components/ui/Loading'

type CampaignType = 'banner-home' | 'banner-feed' | 'video-home' | 'article-trending'

interface Campaign {
  id: string
  type: CampaignType
  name: string
  status: 'pending' | 'active' | 'rejected'
  views: number
  clicks: number
  ctr: number
  createdAt: string
  imageUrl?: string
  videoUrl?: string
}

export default function PublicitePage() {
  const router = useRouter()
  const { user, subscriptionPlan, loading: authLoading } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<CampaignType | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Protection de la page - Pro uniquement
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/signin?redirect=/marketing/publicite')
      } else if (subscriptionPlan?.slug !== 'pro') {
        router.push('/abonnement')
      }
    }
  }, [user, subscriptionPlan, authLoading, router])

  // Afficher loading pendant la vérification
  if (authLoading || !user || subscriptionPlan?.slug !== 'pro') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  // Données de démonstration
  const campaigns: Campaign[] = [
    {
      id: '1',
      type: 'banner-home',
      name: 'Ma campagne bannière accueil',
      status: 'active',
      views: 12450,
      clicks: 342,
      ctr: 2.75,
      createdAt: '2025-01-05',
      imageUrl: 'https://placehold.co/1200x300/f97316/white?text=Banniere+Exemple'
    }
  ]

  const adTypes = [
    {
      id: 'banner-home' as CampaignType,
      title: 'Bannière Page d\'Accueil',
      description: 'Bannière premium en haut de la page d\'accueil, visible par tous les visiteurs',
      icon: '🏠',
      color: 'from-orange-500 to-orange-600',
      features: ['Position premium', 'Visibilité maximale', 'Desktop + Mobile'],
      price: '50,000 FCFA/semaine'
    },
    {
      id: 'banner-feed' as CampaignType,
      title: 'Bannière Feed Articles',
      description: 'Bannière intégrée dans le fil d\'actualités, apparaît tous les 5 articles',
      icon: '📰',
      color: 'from-orange-500 to-orange-600',
      features: ['Intégration naturelle', 'Ciblage contextuel', 'Format 800x200px'],
      price: '30,000 FCFA/semaine'
    },
    {
      id: 'video-home' as CampaignType,
      title: 'Vidéo Home',
      description: 'Vidéo publicitaire affichée sur la page d\'accueil avec lecture automatique',
      icon: '🎬',
      color: 'from-orange-500 to-orange-600',
      features: ['Auto-play', 'Format vertical/horizontal', 'Max 30 secondes'],
      price: '75,000 FCFA/semaine'
    },
    {
      id: 'article-trending' as CampaignType,
      title: 'Article Sponsorisé Tendances',
      description: 'Article natif dans le feed et TOP tendances avec source "Gabon Insight"',
      icon: '🔥',
      color: 'from-orange-500 to-orange-600',
      features: ['Source: Gabon Insight', 'TOP Tendances', 'Vues boostées (5000+)', 'Page article dédiée'],
      price: '250,000 FCFA/semaine'
    }
  ]

  const handleCreateCampaign = (type: CampaignType) => {
    // Rediriger vers la page dédiée selon le type
    switch(type) {
      case 'banner-home':
        router.push('/marketing/publicite/banner-home')
        break
      case 'banner-feed':
        router.push('/marketing/publicite/banner-feed')
        break
      case 'video-home':
        router.push('/marketing/publicite/video-home')
        break
      case 'article-trending':
        router.push('/marketing/publicite/article-trending')
        break
    }
  }

  const handleRequestCreation = (typeData: typeof adTypes[0]) => {
    const typeLabel = typeData.id.includes('banner') ? 'bannière' : typeData.id.includes('video') ? 'vidéo' : 'visuel'
    const confirmation = confirm(
      `Souhaitez-vous que notre équipe crée votre ${typeLabel} pour vous ?\n\nNotre équipe de designers professionnels créera un visuel personnalisé pour votre campagne.\n\nTarif : +15,000 FCFA (création personnalisée)`
    )
    
    if (confirmation) {
      alert('🎉 Demande envoyée ! Notre équipe vous contactera sous 24h pour discuter de vos besoins.')
      // TODO: Envoyer la demande au backend
    }
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={toggleMobileMenu} />
      
      <div className="flex min-h-screen w-full">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64 p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">📢</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Publicité</h1>
                <p className="text-gray-600">Créez et gérez vos campagnes publicitaires sur Gabon Insight</p>
              </div>
            </div>

            {/* Introduction */}
            <div className="bg-white border-2 border-transparent bg-clip-padding rounded-xl p-6 mt-6 relative"
              style={{
                borderImage: 'linear-gradient(to right, #f97316, #fb923c, #fdba74) 1'
              }}>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                🚀 Boostez votre visibilité sur Gabon Insight
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Atteignez des milliers de lecteurs gabonais chaque jour avec nos solutions publicitaires premium. 
                Profitez d'outils de création assistés par IA, d'analytics en temps réel et d'un processus de validation rapide.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Eye className="w-5 h-5 text-blue-600" />
                  <span><strong>50k+</strong> visiteurs/mois</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <span>Création assistée par <strong>IA</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                  <span>Analytics en <strong>temps réel</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Types de publicités - Cartes */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Choisissez votre format publicitaire</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {adTypes.map((type) => (
                <div
                  key={type.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
                >
                  {/* Header avec contour orange dégradé */}
                  <div className="bg-white border-2 p-6 relative"
                    style={{
                      borderImage: 'linear-gradient(to right, #f97316, #fb923c, #fdba74) 1',
                      borderBottom: 'none'
                    }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-4xl">{type.icon}</span>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{type.title}</h3>
                        <p className="text-sm text-orange-600 font-semibold">{type.price}</p>
                      </div>
                    </div>
                  </div>

                  {/* Contenu */}
                  <div className="p-6">
                    <p className="text-gray-600 mb-4">{type.description}</p>
                    
                    {/* Caractéristiques */}
                    <div className="space-y-2 mb-6">
                      {type.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Boutons d'action */}
                    <div className="space-y-2">
                      <button
                        onClick={() => handleCreateCampaign(type.id)}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Créer ma campagne
                      </button>
                      <button
                        onClick={() => handleRequestCreation(type)}
                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Créer le design pour moi
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mes campagnes actives */}
          {campaigns.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Mes campagnes</h2>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Campagne</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Statut</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Vues</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Clics</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">CTR</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {campaigns.map((campaign) => (
                        <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                                {campaign.imageUrl ? (
                                  <img src={campaign.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    📢
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{campaign.name}</p>
                                <p className="text-sm text-gray-500">{adTypes.find(t => t.id === campaign.type)?.title}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                              campaign.status === 'active' 
                                ? 'bg-green-100 text-green-700' 
                                : campaign.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {campaign.status === 'active' ? '✓ Active' : campaign.status === 'pending' ? '⏳ En attente' : '✗ Rejetée'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold text-gray-900">{campaign.views.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <MousePointerClick className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold text-gray-900">{campaign.clicks.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-green-500" />
                              <span className="font-semibold text-green-600">{campaign.ctr}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              {new Date(campaign.createdAt).toLocaleDateString('fr-FR')}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Modal Upload */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-xl max-w-3xl w-full p-8 my-8">
                <h3 className="text-2xl font-bold mb-4">Créer une campagne</h3>
                <p className="text-gray-600 mb-6">
                  Type: {adTypes.find(t => t.id === selectedType)?.title}
                </p>

                {/* Upload pour bannière page d'accueil (2 images) */}
                {selectedType === 'banner-home' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        🖥️ Image Desktop (1200x300px)
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600">
                          Cliquez ou glissez votre image ici
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Format recommandé: 1200x300px (JPG, PNG)
                        </p>
                        <input type="file" className="hidden" accept="image/*" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        📱 Image Mobile (800x400px)
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600">
                          Cliquez ou glissez votre image ici
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Format recommandé: 800x400px (JPG, PNG)
                        </p>
                        <input type="file" className="hidden" accept="image/*" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload pour autres types (1 image) */}
                {selectedType !== 'banner-home' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      {selectedType === 'video-home' ? '🎬 Vidéo' : '🖼️ Image'}
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        Cliquez ou glissez votre {selectedType === 'video-home' ? 'vidéo' : 'image'} ici
                      </p>
                      <p className="text-sm text-gray-400 mt-2">
                        {selectedType === 'video-home' 
                          ? 'MP4, max 30 secondes, 50 MB max' 
                          : selectedType === 'banner-feed'
                          ? 'Format: 800x200px (JPG, PNG)'
                          : 'Format recommandé (JPG, PNG)'}
                      </p>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept={selectedType === 'video-home' ? 'video/*' : 'image/*'} 
                      />
                    </div>
                  </div>
                )}

                {/* Informations complémentaires */}
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nom de la campagne
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Promotion Nouvel An 2025"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      URL de destination
                    </label>
                    <input
                      type="url"
                      placeholder="https://votresite.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Durée de la campagne
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="7">1 semaine</option>
                      <option value="14">2 semaines</option>
                      <option value="21">3 semaines</option>
                      <option value="30">1 mois</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold transition-all"
                  >
                    Soumettre pour validation
                  </button>
                </div>

                {/* Info */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    ℹ️ Votre campagne sera examinée par notre équipe sous 24h. Vous recevrez une notification par email.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
