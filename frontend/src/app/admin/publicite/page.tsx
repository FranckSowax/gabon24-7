'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import Image from 'next/image'

interface Campaign {
  id: string
  company_name: string
  contact_email: string
  contact_phone: string
  start_date: string
  end_date: string
  payment_status: string
  payment_reference: string
  is_active: boolean
  admin_approved: boolean
  status: string
  visual_creation_service: boolean
  visual_service_price: number
  admin_notes: string
  submission_date: string
  approval_date: string
  created_at: string
  ad_packages: {
    name: string
    price_fcfa: number
    duration_days: number
    max_slides: number
  }
  promotional_slides: Array<{
    id: string
    title: string
    description: string
    image_url: string
    link_url: string
    cta_text: string
    view_count: number
    click_count: number
    is_active: boolean
    display_order: number
  }>
}

export default function PublicitePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlide, setSelectedSlide] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [editCampaignMode, setEditCampaignMode] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const fetchCampaigns = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/admin/campaigns')
      setCampaigns(response.data.campaigns)
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const handleViewSlide = (slide: any, campaign: Campaign) => {
    setSelectedSlide({ ...slide, campaign })
    setEditMode(false)
    setShowModal(true)
  }

  const handleEditSlide = (slide: any, campaign: Campaign) => {
    setSelectedSlide({ ...slide, campaign })
    setEditMode(true)
    setShowModal(true)
  }

  const handleDeleteSlide = async (slideId: string, event?: React.MouseEvent) => {
    // Empêcher la propagation de l'événement
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    try {
      await axios.delete(`http://localhost:3001/api/admin/slides/${slideId}`)
      fetchCampaigns()
      alert('Slide supprimé avec succès')
    } catch (error) {
      console.error('Erreur suppression:', error)
      alert('Erreur lors de la suppression du slide')
    }
  }

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setEditCampaignMode(true)
    setShowCampaignModal(true)
  }

  const handleViewCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setEditCampaignMode(false)
    setShowCampaignModal(true)
  }

  const handleApproveCampaign = async (campaignId: string) => {
    try {
      await axios.post(`http://localhost:3001/api/admin/campaigns/${campaignId}/approve`)
      fetchCampaigns()
      alert('Campagne approuvée avec succès')
    } catch (error) {
      console.error('Erreur approbation:', error)
      alert('Erreur lors de l\'approbation')
    }
  }

  const handleRejectCampaign = async (campaignId: string) => {
    const reason = prompt('Raison du rejet (optionnel):')
    try {
      await axios.post(`http://localhost:3001/api/admin/campaigns/${campaignId}/reject`, {
        admin_notes: reason
      })
      fetchCampaigns()
      alert('Campagne rejetée')
    } catch (error) {
      console.error('Erreur rejet:', error)
      alert('Erreur lors du rejet')
    }
  }

  const handleActivateCampaign = async (campaignId: string) => {
    try {
      await axios.post(`http://localhost:3001/api/admin/campaigns/${campaignId}/activate`)
      fetchCampaigns()
      alert('Campagne activée avec succès')
    } catch (error) {
      console.error('Erreur activation:', error)
      alert('Erreur lors de l\'activation')
    }
  }

  const handleRenewCampaign = async (campaignId: string) => {
    const duration = prompt('Durée de renouvellement (en jours):', '30')
    if (!duration) return
    
    try {
      await axios.post(`http://localhost:3001/api/admin/campaigns/${campaignId}/renew`, {
        duration_days: parseInt(duration)
      })
      fetchCampaigns()
      alert(`Campagne renouvelée pour ${duration} jours`)
    } catch (error) {
      console.error('Erreur renouvellement:', error)
      alert('Erreur lors du renouvellement')
    }
  }

  const handleExtendCampaign = async (campaignId: string) => {
    const extension = prompt('Prolonger de combien de jours ?:', '7')
    if (!extension) return
    
    try {
      await axios.post(`http://localhost:3001/api/admin/campaigns/${campaignId}/extend`, {
        extension_days: parseInt(extension)
      })
      fetchCampaigns()
      alert(`Campagne prolongée de ${extension} jours`)
    } catch (error) {
      console.error('Erreur prolongation:', error)
      alert('Erreur lors de la prolongation')
    }
  }

  const handleReactivateCampaign = async (campaignId: string) => {
    try {
      await axios.post(`http://localhost:3001/api/admin/campaigns/${campaignId}/reactivate`)
      fetchCampaigns()
      alert('Campagne réactivée avec succès')
    } catch (error) {
      console.error('Erreur réactivation:', error)
      alert('Erreur lors de la réactivation')
    }
  }

  const handleSaveCampaign = async (campaignData: any) => {
    try {
      if (selectedCampaign) {
        await axios.put(`http://localhost:3001/api/admin/campaigns/${selectedCampaign.id}`, campaignData)
        fetchCampaigns()
        setShowCampaignModal(false)
      }
    } catch (error) {
      console.error('Erreur sauvegarde campagne:', error)
    }
  }

  const handleSaveSlide = async (slideData: any) => {
    try {
      if (editMode) {
        await axios.put(`http://localhost:3001/api/admin/slides/${selectedSlide.id}`, slideData)
      }
      fetchCampaigns()
      setShowModal(false)
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
    }
  }

  // Filtrer les campagnes
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesStatus = filterStatus === 'all' || campaign.status === filterStatus
    const matchesSearch = campaign.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.contact_email.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Statistiques rapides
  const stats = {
    total: campaigns.length,
    pending: campaigns.filter(c => c.status === 'pending').length,
    active: campaigns.filter(c => c.status === 'active').length,
    expired: campaigns.filter(c => c.status === 'expired').length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-white/70 rounded-lg w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-64 bg-white/70 rounded-xl shadow-sm"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header moderne */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                🎯 Gestion des Publicités
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Gérez vos campagnes publicitaires avec style
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="px-4 py-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-white/20"
              >
                {viewMode === 'grid' ? '📋 Liste' : '🔲 Grille'}
              </button>
            </div>
          </div>

          {/* Statistiques modernes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-white/20">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-blue-600 text-xl">📊</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-white/20">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <span className="text-yellow-600 text-xl">⏳</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">En attente</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-white/20">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-green-600 text-xl">🟢</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Actives</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-white/20">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <span className="text-red-600 text-xl">⏰</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Expirées</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.expired}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filtres et recherche modernes */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-white/20 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                  <input
                    type="text"
                    placeholder="Rechercher par entreprise ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {['all', 'pending', 'approved', 'active', 'expired', 'rejected'].map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      filterStatus === status
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? 'Tous' :
                     status === 'pending' ? 'En attente' :
                     status === 'approved' ? 'Approuvées' :
                     status === 'active' ? 'Actives' :
                     status === 'expired' ? 'Expirées' : 'Rejetées'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Info technique moderne */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50 rounded-xl p-4 mb-6">
            <div className="flex items-start">
              <span className="text-2xl mr-3">💡</span>
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Spécifications techniques</h3>
                <div className="text-sm text-blue-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <p><strong>📐 Taille :</strong> 2000x421px (ratio 4.75:1)</p>
                  <p><strong>📁 Format :</strong> JPG, PNG (max 2MB)</p>
                  <p><strong>✨ Qualité :</strong> Haute résolution</p>
                  <p><strong>🔄 Redimensionnement :</strong> Auto à 421px</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des campagnes */}
        <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}`}>
          {filteredCampaigns.map((campaign) => {
            // Déterminer la couleur de fond selon le forfait
            const getPackageColor = (packageName: string) => {
              switch(packageName?.toLowerCase()) {
                case 'basic':
                case 'basique':
                  return 'from-blue-50 to-blue-100 border-blue-200'
                case 'premium':
                  return 'from-purple-50 to-purple-100 border-purple-200'
                case 'pro':
                case 'professionnel':
                  return 'from-green-50 to-green-100 border-green-200'
                case 'enterprise':
                case 'entreprise':
                  return 'from-orange-50 to-orange-100 border-orange-200'
                default:
                  return 'from-gray-50 to-gray-100 border-gray-200'
              }
            }

            const totalViews = campaign.promotional_slides?.reduce((total: number, slide: any) => total + (slide.view_count || 0), 0) || 0
            const totalClicks = campaign.promotional_slides?.reduce((total: number, slide: any) => total + (slide.click_count || 0), 0) || 0
            const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : '0.00'

            return (
              <div key={campaign.id} className="group bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-white/20 overflow-hidden">
                <div className={`bg-gradient-to-r ${getPackageColor(campaign.ad_packages?.name)} p-6 border-b border-white/30`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{campaign.company_name}</h3>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          campaign.status === 'active' ? 'bg-green-500 text-white' :
                          campaign.status === 'approved' ? 'bg-blue-500 text-white' :
                          campaign.status === 'pending' ? 'bg-yellow-500 text-white' :
                          campaign.status === 'rejected' ? 'bg-red-500 text-white' :
                          'bg-gray-500 text-white'
                        }`}>
                          {campaign.status === 'active' ? '🟢 Active' :
                           campaign.status === 'approved' ? '✅ Approuvée' :
                           campaign.status === 'pending' ? '⏳ En attente' :
                           campaign.status === 'rejected' ? '❌ Rejetée' :
                           '⚪ Inconnue'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <span>📧 {campaign.contact_email}</span>
                        <span>📞 {campaign.contact_phone}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>📅 {new Date(campaign.start_date).toLocaleDateString()}</span>
                        <span>→</span>
                        <span>{new Date(campaign.end_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions rapides */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleViewCampaign(campaign)}
                      className="px-3 py-1.5 bg-white/80 hover:bg-white text-blue-600 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm"
                    >
                      👁️ Détails
                    </button>
                    <button
                      onClick={() => handleEditCampaign(campaign)}
                      className="px-3 py-1.5 bg-white/80 hover:bg-white text-orange-600 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm"
                    >
                      ✏️ Éditer
                    </button>
                    
                    {/* Actions contextuelles */}
                    {campaign.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApproveCampaign(campaign.id)}
                          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm"
                        >
                          ✅ Approuver
                        </button>
                        <button
                          onClick={() => handleRejectCampaign(campaign.id)}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm"
                        >
                          ❌ Rejeter
                        </button>
                      </>
                    )}
                    
                    {campaign.status === 'approved' && (
                      <button
                        onClick={() => handleActivateCampaign(campaign.id)}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm"
                      >
                        🚀 Activer
                      </button>
                    )}
                    
                    {campaign.status === 'active' && (
                      <>
                        <button
                          onClick={() => handleRenewCampaign(campaign.id)}
                          className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm"
                        >
                          🔄 Renouveler
                        </button>
                        <button
                          onClick={() => handleExtendCampaign(campaign.id)}
                          className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm"
                        >
                          ⏰ Prolonger
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Statistiques modernes */}
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{totalViews.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">👁️ Vues</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{totalClicks.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">🖱️ Clics</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{ctr}%</div>
                      <div className="text-xs text-gray-500">📈 CTR</div>
                    </div>
                  </div>

                  {/* Informations supplémentaires */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Forfait:</span>
                      <span className="font-medium text-gray-900">{campaign.ad_packages?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Prix:</span>
                      <span className="font-medium text-gray-900">{campaign.ad_packages?.price_fcfa?.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paiement:</span>
                      <span className={`font-medium ${
                        campaign.payment_status === 'paid' ? 'text-green-600' : 
                        campaign.payment_status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {campaign.payment_status === 'paid' ? '✅ Payé' : 
                         campaign.payment_status === 'pending' ? '⏳ En attente' : '❌ Échoué'}
                      </span>
                    </div>
                    {campaign.visual_creation_service && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Service visuel:</span>
                        <span className="font-medium text-purple-600">🎨 Inclus</span>
                      </div>
                    )}
                  </div>

                  {/* Slides de la campagne */}
                  {campaign.promotional_slides && campaign.promotional_slides.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">📸 Slides ({campaign.promotional_slides.length})</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {campaign.promotional_slides.slice(0, 6).map((slide: any) => (
                          <div key={slide.id} className="group relative">
                            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                              {slide.image_url && (
                                <Image
                                  src={slide.image_url}
                                  alt={slide.title || 'Slide'}
                                  width={120}
                                  height={68}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                              )}
                            </div>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 rounded-lg flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                                <button
                                  onClick={() => handleViewSlide(slide, campaign)}
                                  className="p-1.5 bg-white/90 rounded-full text-blue-600 hover:bg-white shadow-sm"
                                >
                                  👁️
                                </button>
                                <button
                                  onClick={() => handleEditSlide(slide, campaign)}
                                  className="p-1.5 bg-white/90 rounded-full text-orange-600 hover:bg-white shadow-sm"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={(e) => handleDeleteSlide(slide.id, e)}
                                  className="p-1.5 bg-white/90 rounded-full text-red-600 hover:bg-white shadow-sm"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {filteredCampaigns.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune campagne trouvée</h3>
              <p className="text-gray-500">Essayez de modifier vos filtres de recherche</p>
            </div>
          )}
        </div>

        {/* Modals */}
        {showModal && selectedSlide && (
          <SlideModal
            slide={selectedSlide}
            editMode={editMode}
            onClose={() => setShowModal(false)}
            onSave={handleSaveSlide}
          />
        )}

        {showCampaignModal && selectedCampaign && (
          <CampaignModal
            campaign={selectedCampaign}
            editMode={editCampaignMode}
            onClose={() => setShowCampaignModal(false)}
            onSave={handleSaveCampaign}
          />
        )}
      </div>
    </div>
  )
}

// Composant Modal pour les slides
function SlideModal({ slide, editMode, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    title: slide?.title || '',
    description: slide?.description || '',
    image_url: slide?.image_url || '',
    link_url: slide?.link_url || '',
    cta_text: slide?.cta_text || '',
    display_order: slide?.display_order || 1,
    is_active: slide?.is_active ?? true
  })
  const [uploading, setUploading] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validation côté client
    const maxSize = 5 * 1024 * 1024 // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    
    if (file.size > maxSize) {
      alert('❌ Fichier trop volumineux. Taille maximum: 5MB')
      return
    }
    
    if (!allowedTypes.includes(file.type)) {
      alert('❌ Type de fichier non autorisé. Utilisez JPG, PNG, GIF ou WebP.')
      return
    }

    setUploading(true)
    const formDataUpload = new FormData()
    formDataUpload.append('image', file)

    try {
      const response = await axios.post('http://localhost:3001/api/admin/upload-image', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      if (response.data.success) {
        setFormData({ ...formData, image_url: response.data.image_url })
        alert('✅ Image uploadée avec succès!')
      } else {
        throw new Error(response.data.message || 'Erreur lors de l\'upload')
      }
    } catch (error: any) {
      console.error('Erreur upload:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de l\'upload'
      alert(`❌ ${errorMessage}`)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {editMode ? '✏️ Éditer le slide' : '👁️ Détails du slide'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              ❌
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Aperçu de l'image */}
          {formData.image_url && (
            <div className="text-center">
              <Image
                src={formData.image_url}
                alt="Aperçu"
                width={400}
                height={200}
                className="mx-auto rounded-lg shadow-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Titre
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!editMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔗 Lien URL
              </label>
              <input
                type="url"
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!editMode}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📄 Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!editMode}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🎯 Texte du bouton
              </label>
              <input
                type="text"
                value={formData.cta_text}
                onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!editMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📊 Ordre d'affichage
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!editMode}
              />
            </div>
          </div>

          {editMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🖼️ Changer l'image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {uploading && <p className="text-sm text-blue-600 mt-2">⏳ Upload en cours...</p>}
            </div>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              disabled={!editMode}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              ✅ Slide actif
            </label>
          </div>

          {/* Statistiques */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">📊 Statistiques</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">👁️ Vues:</span>
                <p className="font-bold text-blue-600">{slide?.view_count || 0}</p>
              </div>
              <div>
                <span className="text-gray-500">🖱️ Clics:</span>
                <p className="font-bold text-green-600">{slide?.click_count || 0}</p>
              </div>
            </div>
          </div>

          {editMode && (
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                💾 Sauvegarder
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

// Composant Modal pour les campagnes
function CampaignModal({ campaign, editMode, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    company_name: campaign?.company_name || '',
    contact_email: campaign?.contact_email || '',
    contact_phone: campaign?.contact_phone || '',
    start_date: campaign?.start_date?.split('T')[0] || '',
    end_date: campaign?.end_date?.split('T')[0] || '',
    payment_status: campaign?.payment_status || 'pending',
    payment_reference: campaign?.payment_reference || '',
    is_active: campaign?.is_active ?? true
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const totalViews = campaign?.promotional_slides?.reduce((total: number, slide: any) => total + (slide.view_count || 0), 0) || 0
  const totalClicks = campaign?.promotional_slides?.reduce((total: number, slide: any) => total + (slide.click_count || 0), 0) || 0
  const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : '0.00'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {editMode ? '✏️ Éditer la campagne' : '👁️ Détails de la campagne'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              ❌
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏢 Nom de l'entreprise
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!editMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📧 Email de contact
              </label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!editMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📞 Téléphone
              </label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!editMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💳 Statut de paiement
              </label>
              <select
                value={formData.payment_status}
                onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!editMode}
              >
                <option value="pending">⏳ En attente</option>
                <option value="paid">✅ Payé</option>
                <option value="failed">❌ Échoué</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Date de début
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!editMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Date de fin
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!editMode}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔖 Référence de paiement
            </label>
            <input
              type="text"
              value={formData.payment_reference}
              onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!editMode}
            />
          </div>

          {/* Informations sur le forfait */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">📦 Informations du forfait</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Nom:</span>
                <p className="font-medium">{campaign?.ad_packages?.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Prix:</span>
                <p className="font-medium text-green-600">{campaign?.ad_packages?.price_fcfa?.toLocaleString()} FCFA</p>
              </div>
              <div>
                <span className="text-gray-500">Durée:</span>
                <p className="font-medium">{campaign?.ad_packages?.duration_days} jours</p>
              </div>
            </div>
          </div>

          {/* Statistiques globales */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">📊 Statistiques globales</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{totalViews.toLocaleString()}</div>
                <div className="text-xs text-gray-500">👁️ Vues totales</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{totalClicks.toLocaleString()}</div>
                <div className="text-xs text-gray-500">🖱️ Clics totaux</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{ctr}%</div>
                <div className="text-xs text-gray-500">📈 CTR</div>
              </div>
            </div>
          </div>

          {/* Liste des slides */}
          {campaign?.promotional_slides && campaign.promotional_slides.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">📸 Slides de la campagne</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {campaign.promotional_slides.map((slide: any) => (
                  <div key={slide.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-3">
                      {slide.image_url && (
                        <Image
                          src={slide.image_url}
                          alt={slide.title}
                          width={40}
                          height={24}
                          className="rounded object-cover"
                        />
                      )}
                      <div>
                        <p className="font-medium text-sm">{slide.title}</p>
                        <p className="text-xs text-gray-500">
                          👁️ {slide.view_count || 0} • 🖱️ {slide.click_count || 0}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      slide.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {slide.is_active ? '✅' : '⏸️'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editMode && (
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                💾 Sauvegarder
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
