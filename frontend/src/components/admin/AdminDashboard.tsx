'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface Analytics {
  campaigns: {
    total: number
    approved: number
    active: number
    paid: number
  }
  slides: {
    total: number
    active: number
    totalViews: number
    totalClicks: number
    ctr: string
  }
}

interface Campaign {
  id: string
  company_name: string
  contact_email: string
  contact_phone: string
  start_date: string
  end_date: string
  payment_status: 'pending' | 'paid' | 'failed'
  is_approved: boolean
  is_active: boolean
  ad_packages: {
    name: string
    price: number
    duration_days: number
  }
  promotional_slides: Array<{
    id: string
    title: string
    description: string
    image_url: string
    view_count: number
    click_count: number
    is_active: boolean
    cta_text: string
    display_order: number
  }>
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'slides'>('overview')
  const [editingSlide, setEditingSlide] = useState<any>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [analyticsRes, campaignsRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/analytics`),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/campaigns`)
      ])

      if (analyticsRes.data.success) {
        setAnalytics(analyticsRes.data.analytics)
      }
      if (campaignsRes.data.success) {
        setCampaigns(campaignsRes.data.campaigns)
      }
    } catch (error) {
      console.error('Erreur chargement données:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCampaignApproval = async (campaignId: string, approved: boolean) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      if (approved) {
        await axios.post(`${API_URL}/api/admin/campaigns/${campaignId}/approve`, { admin_notes: 'Approuvée via dashboard' })
      } else {
        await axios.post(`${API_URL}/api/admin/campaigns/${campaignId}/reject`, { admin_notes: 'Rejetée via dashboard' })
      }
      fetchData()
      alert(`Campagne ${approved ? 'approuvée' : 'rejetée'}`)
    } catch (error) {
      alert('Erreur lors de l\'approbation')
    }
  }

  const handleCampaignStatus = async (campaignId: string, isActive: boolean) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      if (isActive) {
        // Activer: endpoint dédié
        await axios.post(`${API_URL}/api/admin/campaigns/${campaignId}/activate`)
      } else {
        // Désactiver: mise à jour directe
        await axios.put(`${API_URL}/api/admin/campaigns/${campaignId}`, { is_active: false })
      }
      fetchData()
      alert(`Campagne ${isActive ? 'activée' : 'désactivée'}`)
    } catch (error) {
      alert('Erreur lors du changement de statut')
    }
  }

  const handleSlideEdit = async (slide: any) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      await axios.put(`${API_URL}/api/admin/slides/${slide.id}`, slide)
      fetchData()
      setEditingSlide(null)
      alert('Slide modifié avec succès')
    } catch (error) {
      alert('Erreur modification slide')
    }
  }

  const handleSlideDelete = async (slideId: string) => {
    if (!confirm('Supprimer ce slide ?')) return
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      await axios.delete(`${API_URL}/api/admin/slides/${slideId}`)
      fetchData()
      alert('Slide supprimé')
    } catch (error) {
      alert('Erreur suppression slide')
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Administration - Slides Publicitaires
          </h1>
          <p className="text-gray-600">Gérez les campagnes et slides promotionnels</p>
        </div>

        {/* Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
              { id: 'campaigns', label: 'Campagnes', icon: '📢' },
              { id: 'slides', label: 'Slides', icon: '🖼️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium ${
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Vue d'ensemble */}
        {activeTab === 'overview' && analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Campagnes Totales</p>
                  <p className="text-2xl font-bold">{analytics.campaigns.total}</p>
                </div>
                <span className="text-2xl">📢</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Approuvées</p>
                  <p className="text-2xl font-bold text-green-600">{analytics.campaigns.approved}</p>
                </div>
                <span className="text-2xl">✅</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Slides Actifs</p>
                  <p className="text-2xl font-bold text-orange-600">{analytics.slides.active}</p>
                </div>
                <span className="text-2xl">🖼️</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">CTR Global</p>
                  <p className="text-2xl font-bold text-purple-600">{analytics.slides.ctr}%</p>
                </div>
                <span className="text-2xl">📈</span>
              </div>
            </div>
          </div>
        )}

        {/* Campagnes */}
        {activeTab === 'campaigns' && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Campagnes Publicitaires</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Entreprise
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Forfait
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td className="px-6 py-4">
                        <div className="font-medium">{campaign.company_name}</div>
                        <div className="text-sm text-gray-500">{campaign.contact_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div>{campaign.ad_packages.name}</div>
                        <div className="text-sm text-gray-500">
                          {campaign.ad_packages.price.toLocaleString()} FCFA
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            campaign.payment_status === 'paid' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {campaign.payment_status === 'paid' ? 'Payé' : 'En attente'}
                          </span>
                          <br />
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            campaign.is_approved 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {campaign.is_approved ? 'Approuvée' : 'En attente'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 space-x-2">
                        {!campaign.is_approved && (
                          <>
                            <button
                              onClick={() => handleCampaignApproval(campaign.id, true)}
                              className="text-green-600 hover:text-green-900 text-sm"
                            >
                              Approuver
                            </button>
                            <button
                              onClick={() => handleCampaignApproval(campaign.id, false)}
                              className="text-red-600 hover:text-red-900 text-sm"
                            >
                              Rejeter
                            </button>
                          </>
                        )}
                        {campaign.is_approved && (
                          <button
                            onClick={() => handleCampaignStatus(campaign.id, !campaign.is_active)}
                            className={`text-sm ${
                              campaign.is_active 
                                ? 'text-red-600 hover:text-red-900' 
                                : 'text-green-600 hover:text-green-900'
                            }`}
                          >
                            {campaign.is_active ? 'Désactiver' : 'Activer'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Slides */}
        {activeTab === 'slides' && (
          <div className="space-y-6">
            {campaigns.map((campaign) => 
              campaign.promotional_slides.map((slide) => (
                <div key={slide.id} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold">{slide.title}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          slide.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {slide.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">{slide.description}</p>
                      <div className="flex space-x-6 text-sm text-gray-500">
                        <span>👁️ {slide.view_count} vues</span>
                        <span>👆 {slide.click_count} clics</span>
                        <span>🏢 {campaign.company_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {slide.image_url && (
                        <img 
                          src={slide.image_url} 
                          alt={slide.title}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex flex-col space-y-2">
                        <button
                          onClick={() => setEditingSlide(slide)}
                          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleSlideDelete(slide.id)}
                          className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Modal d'édition */}
        {editingSlide && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">Modifier le slide</h3>
              <form onSubmit={(e) => {
                e.preventDefault()
                handleSlideEdit(editingSlide)
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Titre</label>
                  <input
                    type="text"
                    value={editingSlide.title}
                    onChange={(e) => setEditingSlide({...editingSlide, title: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={editingSlide.description}
                    onChange={(e) => setEditingSlide({...editingSlide, description: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">URL Image</label>
                  <input
                    type="url"
                    value={editingSlide.image_url}
                    onChange={(e) => setEditingSlide({...editingSlide, image_url: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingSlide.is_active}
                    onChange={(e) => setEditingSlide({...editingSlide, is_active: e.target.checked})}
                    className="h-4 w-4 text-orange-600"
                  />
                  <label className="ml-2 text-sm">Slide actif</label>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingSlide(null)}
                    className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
