'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Edit, Trash2, Eye, EyeOff, Save, X } from 'lucide-react'

interface BusinessBanner {
  id: string
  feature_slug: string
  page_path: string
  sort_order: number
  is_active: boolean
  badge_text: string | null
  badge_color: string
  badge_icon: string | null
  title: string
  subtitle: string | null
  description: string | null
  features: string[] | null
  primary_cta_text: string | null
  primary_cta_url: string | null
  primary_cta_type: 'action' | 'credits' | 'subscription'
  secondary_cta_text: string | null
  secondary_cta_url: string | null
  background_type: 'gradient' | 'image' | 'color'
  background_value: string
  background_image: string | null
  text_color: string
  require_subscription: boolean
  required_subscription_plan: string | null
  require_credits: boolean
  credit_cost: number
}

const DEFAULT_GRADIENTS = [
  { name: 'Orange-Rouge', value: 'from-orange-500 via-red-500 to-pink-600' },
  { name: 'Vert-Cyan', value: 'from-emerald-500 via-teal-500 to-cyan-600' },
  { name: 'Violet-Indigo', value: 'from-purple-500 via-violet-500 to-indigo-600' },
  { name: 'Bleu-Cyan', value: 'from-blue-500 via-cyan-500 to-teal-600' },
  { name: 'Rouge-Jaune', value: 'from-red-500 via-orange-500 to-yellow-500' },
  { name: 'Violet Pro', value: 'from-purple-600 via-violet-600 to-purple-700' },
]

const BUSINESS_FEATURES = [
  { slug: 'mes-projets', name: 'Mes Projets', path: '/business/mes-projets', icon: '📁' },
  { slug: 'actu-plus', name: 'Actu++', path: '/actu-plus', icon: '📰' },
  { slug: 'audio-summaries', name: 'Résumés Audio', path: '/audio/daily', icon: '🎧' },
  { slug: 'ai-opportunities', name: 'Opportunités IA', path: '/business/live-opportunities', icon: '🤖' },
  { slug: 'veille-alertes', name: 'Veille & Alertes', path: '/veille', icon: '🔔' },
  { slug: 'marketing-ads', name: 'Publicité', path: '/marketing/publicite', icon: '📢' },
]

export default function BusinessBannersAdmin() {
  const [banners, setBanners] = useState<BusinessBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingBanner, setEditingBanner] = useState<string | null>(null)
  const [features, setFeatures] = useState<string[]>([''])

  const [formData, setFormData] = useState({
    feature_slug: '',
    page_path: '',
    badge_text: '',
    badge_color: '#F59E0B',
    badge_icon: '',
    title: '',
    subtitle: '',
    description: '',
    primary_cta_text: '',
    primary_cta_url: '',
    primary_cta_type: 'action' as 'action' | 'credits' | 'subscription',
    secondary_cta_text: '',
    secondary_cta_url: '',
    background_type: 'gradient' as 'gradient' | 'image' | 'color',
    background_value: 'from-orange-500 via-red-500 to-pink-600',
    background_image: '',
    text_color: '#FFFFFF',
    require_subscription: false,
    required_subscription_plan: '',
    require_credits: false,
    credit_cost: 0,
  })

  useEffect(() => {
    loadBanners()
  }, [])

  const loadBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('business_banners')
        .select('*')
        .order('feature_slug', { ascending: true })

      if (error) throw error
      setBanners(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Erreur chargement bannières:', error)
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const bannerData = {
        ...formData,
        features: features.filter(f => f.trim() !== ''),
        sort_order: editingBanner ? undefined : banners.length + 1,
        is_active: true,
      }

      if (editingBanner) {
        const { error } = await supabase
          .from('business_banners')
          .update(bannerData)
          .eq('id', editingBanner)

        if (error) throw error
        alert('Bannière mise à jour !')
      } else {
        const { error } = await supabase.from('business_banners').insert(bannerData)
        if (error) throw error
        alert('Bannière créée !')
      }

      resetForm()
      loadBanners()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const handleEdit = (banner: BusinessBanner) => {
    setFormData({
      feature_slug: banner.feature_slug,
      page_path: banner.page_path,
      badge_text: banner.badge_text || '',
      badge_color: banner.badge_color,
      badge_icon: banner.badge_icon || '',
      title: banner.title,
      subtitle: banner.subtitle || '',
      description: banner.description || '',
      primary_cta_text: banner.primary_cta_text || '',
      primary_cta_url: banner.primary_cta_url || '',
      primary_cta_type: banner.primary_cta_type,
      secondary_cta_text: banner.secondary_cta_text || '',
      secondary_cta_url: banner.secondary_cta_url || '',
      background_type: banner.background_type,
      background_value: banner.background_value,
      background_image: banner.background_image || '',
      text_color: banner.text_color,
      require_subscription: banner.require_subscription,
      required_subscription_plan: banner.required_subscription_plan || '',
      require_credits: banner.require_credits,
      credit_cost: banner.credit_cost,
    })
    setFeatures(banner.features || [''])
    setEditingBanner(banner.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette bannière ?')) return

    try {
      const { error } = await supabase.from('business_banners').delete().eq('id', id)
      if (error) throw error
      alert('Bannière supprimée !')
      loadBanners()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('business_banners')
        .update({ is_active: !currentState })
        .eq('id', id)

      if (error) throw error
      loadBanners()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      feature_slug: '',
      page_path: '',
      badge_text: '',
      badge_color: '#F59E0B',
      badge_icon: '',
      title: '',
      subtitle: '',
      description: '',
      primary_cta_text: '',
      primary_cta_url: '',
      primary_cta_type: 'action',
      secondary_cta_text: '',
      secondary_cta_url: '',
      background_type: 'gradient',
      background_value: 'from-orange-500 via-red-500 to-pink-600',
      background_image: '',
      text_color: '#FFFFFF',
      require_subscription: false,
      required_subscription_plan: '',
      require_credits: false,
      credit_cost: 0,
    })
    setFeatures([''])
    setShowForm(false)
    setEditingBanner(null)
  }

  const addFeature = () => {
    setFeatures([...features, ''])
  }

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...features]
    newFeatures[index] = value
    setFeatures(newFeatures)
  }

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index))
  }

  if (loading) {
    return <div className="p-8">Chargement...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion Bannières Business</h1>
            <p className="text-gray-600 mt-2">Gérer les bannières des fonctions business</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm)
              if (showForm) resetForm()
            }}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-700"
          >
            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showForm ? 'Annuler' : 'Nouvelle Bannière'}
          </button>
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border">
            <h2 className="text-xl font-bold mb-4">
              {editingBanner ? 'Modifier la bannière' : 'Nouvelle bannière'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Fonction Business */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fonction Business *
                  </label>
                  <select
                    value={formData.feature_slug}
                    onChange={(e) => {
                      const feature = BUSINESS_FEATURES.find(f => f.slug === e.target.value)
                      setFormData({ 
                        ...formData, 
                        feature_slug: e.target.value,
                        page_path: feature?.path || '',
                        badge_icon: feature?.icon || ''
                      })
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {BUSINESS_FEATURES.map(f => (
                      <option key={f.slug} value={f.slug}>{f.icon} {f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chemin page *
                  </label>
                  <input
                    type="text"
                    value={formData.page_path}
                    onChange={(e) => setFormData({ ...formData, page_path: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* Badge */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Texte badge
                  </label>
                  <input
                    type="text"
                    value={formData.badge_text}
                    onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="PREMIUM, BUSINESS..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Couleur badge
                  </label>
                  <input
                    type="color"
                    value={formData.badge_color}
                    onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                    className="w-full h-10 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Icon badge
                  </label>
                  <input
                    type="text"
                    value={formData.badge_icon}
                    onChange={(e) => setFormData({ ...formData, badge_icon: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="📁"
                  />
                </div>
              </div>

              {/* Titre */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titre *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sous-titre
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Points clés
                </label>
                {features.map((feature, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => updateFeature(index, e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg"
                      placeholder="Feature..."
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFeature}
                  className="text-sm text-orange-600 hover:text-orange-700"
                >
                  + Ajouter un point clé
                </button>
              </div>

              {/* CTA Principal */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Texte bouton principal
                  </label>
                  <input
                    type="text"
                    value={formData.primary_cta_text}
                    onChange={(e) => setFormData({ ...formData, primary_cta_text: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL bouton
                  </label>
                  <input
                    type="text"
                    value={formData.primary_cta_url}
                    onChange={(e) => setFormData({ ...formData, primary_cta_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type CTA
                  </label>
                  <select
                    value={formData.primary_cta_type}
                    onChange={(e) => setFormData({ ...formData, primary_cta_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="action">Action</option>
                    <option value="credits">Crédits</option>
                    <option value="subscription">Abonnement</option>
                  </select>
                </div>
              </div>

              {/* CTA Secondaire */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Texte bouton secondaire
                  </label>
                  <input
                    type="text"
                    value={formData.secondary_cta_text}
                    onChange={(e) => setFormData({ ...formData, secondary_cta_text: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL secondaire
                  </label>
                  <input
                    type="text"
                    value={formData.secondary_cta_url}
                    onChange={(e) => setFormData({ ...formData, secondary_cta_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Background */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de fond
                </label>
                <select
                  value={formData.background_type}
                  onChange={(e) => setFormData({ ...formData, background_type: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg mb-2"
                >
                  <option value="gradient">Dégradé</option>
                  <option value="image">Image</option>
                  <option value="color">Couleur unie</option>
                </select>

                {formData.background_type === 'gradient' && (
                  <select
                    value={formData.background_value}
                    onChange={(e) => setFormData({ ...formData, background_value: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {DEFAULT_GRADIENTS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Restrictions */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Restrictions d'accès</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.require_subscription}
                        onChange={(e) => setFormData({ ...formData, require_subscription: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Nécessite abonnement</span>
                    </label>
                    {formData.require_subscription && (
                      <select
                        value={formData.required_subscription_plan}
                        onChange={(e) => setFormData({ ...formData, required_subscription_plan: e.target.value })}
                        className="mt-2 w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">Tous les plans</option>
                        <option value="premium">Premium</option>
                        <option value="pro">Pro</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.require_credits}
                        onChange={(e) => setFormData({ ...formData, require_credits: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Nécessite crédits</span>
                    </label>
                    {formData.require_credits && (
                      <input
                        type="number"
                        value={formData.credit_cost}
                        onChange={(e) => setFormData({ ...formData, credit_cost: parseInt(e.target.value) })}
                        className="mt-2 w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Coût en crédits"
                        min="0"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  type="submit"
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingBanner ? 'Mettre à jour' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des bannières */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {banners.map((banner) => (
            <div key={banner.id} className="bg-white rounded-xl shadow border p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {banner.badge_icon && <span className="text-2xl">{banner.badge_icon}</span>}
                  <div>
                    <h3 className="text-lg font-bold">{banner.title}</h3>
                    <p className="text-sm text-gray-600">{banner.feature_slug}</p>
                  </div>
                  {!banner.is_active && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                      Inactif
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">{banner.description}</p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(banner.id, banner.is_active)}
                  className="p-2 hover:bg-gray-100 rounded"
                  title={banner.is_active ? 'Désactiver' : 'Activer'}
                >
                  {banner.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleEdit(banner)}
                  className="p-2 hover:bg-gray-100 rounded"
                  title="Modifier"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  className="p-2 hover:bg-red-50 rounded text-red-600"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {banners.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucune bannière. Cliquez sur "Nouvelle Bannière" pour commencer.
          </div>
        )}
      </div>
    </div>
  )
}
