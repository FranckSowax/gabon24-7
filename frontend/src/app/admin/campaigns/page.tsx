'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Check, X, Eye, Calendar, DollarSign, Clock, AlertCircle, 
  ExternalLink, Plus, ChevronDown, Image as ImageIcon, Trash2, Edit,
  TrendingUp, BarChart3, MousePointer, Megaphone, RefreshCw,
  Video, FileText, Layout
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FeedBannerModal from '@/components/admin/FeedBannerModal'
import ImageUploader from '@/components/ui/ImageUploader'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  return headers
}

interface CampaignStats {
  totalCampaigns: number
  activeCampaigns: number
  pendingCampaigns: number
  totalViews: number
  totalClicks: number
  totalRevenue: number
}

interface Slide {
  id: string
  title: string
  description: string | null
  image_url: string
  link_url: string | null
  cta_text: string
  company_name: string
  display_order: number
  click_count: number
  view_count: number
  is_active: boolean
  created_at: string
}

interface FeedBanner {
  id: string
  title: string
  image_url: string
  redirect_url: string
  position: number
  is_active: boolean
  priority: number
  view_count: number
  click_count: number
  start_date: string
  end_date: string | null
  created_at: string
}

interface Campaign {
  id: string
  campaign_type: string
  name: string
  banner_title: string
  banner_description: string
  redirect_url: string
  start_date: string
  duration_days: number
  desktop_image_url: string
  mobile_image_url: string
  design_request: boolean
  design_request_notes: string
  budget: number
  status: 'pending' | 'active' | 'rejected' | 'completed'
  views: number
  clicks: number
  created_at: string
  updated_at: string
}

interface SponsoredArticle {
  id: string
  external_id: string
  title: string
  summary: string
  content: string
  url: string
  author: string
  category: string
  image_urls: string[]
  view_count: number
  share_count: number
  is_published: boolean
  is_trending: boolean
  published_at: string
  created_at: string
  feed: {
    name: string
  }
}

export default function CampagnesValidationPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'campaigns' | 'slides' | 'feed-banners' | 'sponsored-articles'>('campaigns')
  const [stats, setStats] = useState<CampaignStats | null>(null)
  
  // Campaigns states
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
  
  // Slides states
  const [slides, setSlides] = useState<Slide[]>([])
  const [slidesLoading, setSlidesLoading] = useState(false)
  
  // Sponsored Articles states
  const [sponsoredArticles, setSponsoredArticles] = useState<SponsoredArticle[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  
  // Feed Banners states
  const [feedBanners, setFeedBanners] = useState<FeedBanner[]>([])
  const [feedBannersLoading, setFeedBannersLoading] = useState(false)
  const [showAddBannerModal, setShowAddBannerModal] = useState(false)
  const [editingBanner, setEditingBanner] = useState<FeedBanner | null>(null)
  
  // Slide Modal states
  const [showSlideModal, setShowSlideModal] = useState(false)
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null)
  const [slideFormData, setSlideFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    link_url: '',
    cta_text: 'En savoir plus',
    company_name: '',
    display_order: 1,
    schedule_type: 'always' as 'always' | 'scheduled' | 'recurring',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    days_of_week: [0, 1, 2, 3, 4, 5, 6] as number[],
    images: { banner: null as string | null, mobile: null as string | null }
  })
  const [slideSaving, setSlideSaving] = useState(false)

  useEffect(() => {
    fetchStats()
    if (activeTab === 'campaigns') {
      fetchCampaigns()
    } else if (activeTab === 'slides') {
      fetchSlides()
    } else if (activeTab === 'feed-banners') {
      fetchFeedBanners()
    } else if (activeTab === 'sponsored-articles') {
      fetchSponsoredArticles()
    }
  }, [filterStatus, activeTab])

  const fetchStats = async () => {
    try {
      // Récupérer toutes les campagnes pour les stats
      const { data: allCampaigns, error } = await supabase
        .from('campaigns')
        .select('status, views, clicks, budget')
      
      if (error) throw error
      
      type CampaignRow = { status: string; views: number | null; clicks: number | null; budget: number | null }
      const campaigns = (allCampaigns || []) as CampaignRow[]
      
      const totalCampaigns = campaigns.length
      const activeCampaigns = campaigns.filter((c: CampaignRow) => c.status === 'active').length
      const pendingCampaigns = campaigns.filter((c: CampaignRow) => c.status === 'pending').length
      const totalViews = campaigns.reduce((sum: number, c: CampaignRow) => sum + (c.views || 0), 0)
      const totalClicks = campaigns.reduce((sum: number, c: CampaignRow) => sum + (c.clicks || 0), 0)
      const totalRevenue = campaigns.filter((c: CampaignRow) => c.status === 'active' || c.status === 'completed')
        .reduce((sum: number, c: CampaignRow) => sum + (c.budget || 0), 0)
      
      setStats({
        totalCampaigns,
        activeCampaigns,
        pendingCampaigns,
        totalViews,
        totalClicks,
        totalRevenue
      })
    } catch (error) {
      console.error('Erreur stats:', error)
    }
  }
  
  const fetchSlides = async () => {
    try {
      setSlidesLoading(true)
      const { data, error } = await supabase
        .from('promotional_slides')
        .select('*')
        .order('display_order', { ascending: true })
      
      if (error) throw error
      setSlides(data || [])
    } catch (error) {
      console.error('Erreur slides:', error)
    } finally {
      setSlidesLoading(false)
    }
  }

  const fetchSponsoredArticles = async () => {
    try {
      setArticlesLoading(true)
      const { data, error } = await supabase
        .from('articles')
        .select(`
          *,
          feed:rss_feeds(name)
        `)
        .like('external_id', 'sponsored-%')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setSponsoredArticles(data || [])
    } catch (error) {
      console.error('Erreur articles sponsorisés:', error)
    } finally {
      setArticlesLoading(false)
    }
  }

  const handleToggleArticlePublished = async (articleId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ is_published: !currentValue })
        .eq('id', articleId)

      if (error) throw error
      
      // Rafraîchir liste
      await fetchSponsoredArticles()
      alert(`✅ Article ${!currentValue ? 'publié' : 'dépublié'}!`)
    } catch (error) {
      console.error('Erreur:', error)
      alert('❌ Erreur lors de la mise à jour')
    }
  }

  const handleDeleteArticle = async (articleId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet article sponsorisé?')) return

    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleId)

      if (error) throw error
      
      await fetchSponsoredArticles()
      alert('✅ Article supprimé!')
    } catch (error) {
      console.error('Erreur:', error)
      alert('❌ Erreur lors de la suppression')
    }
  }
  
  const handleToggleSlideActive = async (slideId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('promotional_slides')
        .update({ is_active: !currentValue })
        .eq('id', slideId)
      
      if (!error) fetchSlides()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }
  
  const handleDeleteSlide = async (slideId: string) => {
    if (!confirm('Supprimer ce slide ?')) return
    try {
      const { error } = await supabase
        .from('promotional_slides')
        .delete()
        .eq('id', slideId)
      
      if (!error) fetchSlides()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const openSlideModal = (slide?: Slide) => {
    if (slide) {
      setEditingSlide(slide)
      setSlideFormData({
        title: slide.title,
        description: slide.description || '',
        image_url: slide.image_url,
        link_url: slide.link_url || '',
        cta_text: slide.cta_text,
        company_name: slide.company_name,
        display_order: slide.display_order,
        schedule_type: (slide as any).schedule_type || 'always',
        start_date: (slide as any).start_date ? (slide as any).start_date.split('T')[0] : new Date().toISOString().split('T')[0],
        end_date: (slide as any).end_date ? (slide as any).end_date.split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        days_of_week: (slide as any).days_of_week || [0, 1, 2, 3, 4, 5, 6],
        images: { 
          banner: (slide as any).image_url_banner || slide.image_url || null, 
          mobile: (slide as any).image_url_mobile || null 
        }
      })
    } else {
      setEditingSlide(null)
      setSlideFormData({
        title: '',
        description: '',
        image_url: '',
        link_url: '',
        cta_text: 'En savoir plus',
        company_name: '',
        display_order: slides.length + 1,
        schedule_type: 'always',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        images: { banner: null, mobile: null }
      })
    }
    setShowSlideModal(true)
  }

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault()
    setSlideSaving(true)
    
    try {
      // Utiliser l'image uploadée ou l'URL manuelle
      const finalImageUrl = slideFormData.images.banner || slideFormData.image_url
      
      if (!finalImageUrl) {
        alert('❌ Veuillez ajouter une image (upload ou URL)')
        setSlideSaving(false)
        return
      }

      const slideData = {
        title: slideFormData.title,
        description: slideFormData.description || null,
        image_url: finalImageUrl,
        image_url_banner: slideFormData.images.banner || null,
        image_url_mobile: slideFormData.images.mobile || null,
        link_url: slideFormData.link_url || null,
        cta_text: slideFormData.cta_text,
        company_name: slideFormData.company_name,
        display_order: slideFormData.display_order,
        schedule_type: slideFormData.schedule_type,
        start_date: slideFormData.schedule_type !== 'always' ? new Date(slideFormData.start_date).toISOString() : null,
        end_date: slideFormData.schedule_type !== 'always' ? new Date(slideFormData.end_date).toISOString() : null,
        days_of_week: slideFormData.days_of_week,
        is_active: true
      }

      if (editingSlide) {
        const { error } = await supabase
          .from('promotional_slides')
          .update(slideData)
          .eq('id', editingSlide.id)
        
        if (error) throw error
        alert('✅ Slide mis à jour!')
      } else {
        const { error } = await supabase
          .from('promotional_slides')
          .insert([{ ...slideData, view_count: 0, click_count: 0, admin_approved: true }])
        
        if (error) throw error
        alert('✅ Slide créé!')
      }

      setShowSlideModal(false)
      setEditingSlide(null)
      fetchSlides()
    } catch (error) {
      console.error('Erreur:', error)
      alert('❌ Erreur lors de la sauvegarde')
    } finally {
      setSlideSaving(false)
    }
  }
  
  const fetchFeedBanners = async () => {
    try {
      setFeedBannersLoading(true)
      const { data, error } = await supabase
        .from('feed_banners')
        .select('*')
        .order('position', { ascending: true })
        .order('priority', { ascending: false })
      
      if (error) throw error
      setFeedBanners(data || [])
    } catch (error) {
      console.error('Erreur feed banners:', error)
    } finally {
      setFeedBannersLoading(false)
    }
  }
  
  const handleToggleFeedBannerActive = async (bannerId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('feed_banners')
        .update({ is_active: !currentValue })
        .eq('id', bannerId)
      
      if (!error) fetchFeedBanners()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }
  
  const handleDeleteFeedBanner = async (bannerId: string) => {
    if (!confirm('Supprimer cette bannière feed ?')) return
    try {
      const { error } = await supabase
        .from('feed_banners')
        .delete()
        .eq('id', bannerId)
      
      if (!error) fetchFeedBanners()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [filterStatus])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const statusParam = filterStatus !== 'all' ? `?status=${filterStatus}` : ''
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/campaigns${statusParam}`, { headers })
      const data = await response.json()
      
      if (data.success) {
        setCampaigns(data.campaigns || [])
      }
    } catch (error) {
      console.error('❌ Erreur récupération campagnes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleValidate = async (campaignId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir VALIDER cette campagne ?')) return

    setActionLoading(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/campaigns/${campaignId}/validate`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'active' })
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ Campagne validée avec succès!')
        setShowModal(false)
        fetchCampaigns()
      } else {
        alert('❌ Erreur lors de la validation')
      }
    } catch (error) {
      console.error('❌ Erreur:', error)
      alert('❌ Erreur lors de la validation')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (campaignId: string) => {
    if (!rejectionReason.trim()) {
      alert('Veuillez entrer une raison de rejet')
      return
    }

    if (!confirm('Êtes-vous sûr de vouloir REJETER cette campagne ?')) return

    setActionLoading(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/campaigns/${campaignId}/reject`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          status: 'rejected',
          rejection_reason: rejectionReason
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('❌ Campagne rejetée')
        setShowModal(false)
        setRejectionReason('')
        fetchCampaigns()
      } else {
        alert('❌ Erreur lors du rejet')
      }
    } catch (error) {
      console.error('❌ Erreur:', error)
      alert('❌ Erreur lors du rejet')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      active: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      completed: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    
    const labels = {
      pending: 'En attente',
      active: 'Active',
      rejected: 'Rejetée',
      completed: 'Terminée'
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const getCampaignTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'banner-home': '🏠 Bannière Accueil',
      'banner-feed': '📰 Bannière Feed',
      'video-home': '🎬 Vidéo Home',
      'article-trending': '🔥 Article Sponsorisé'
    }
    return types[type] || type
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📢 Publicités & Campagnes</h1>
          <p className="text-gray-500 mt-1">Gérez vos campagnes publicitaires et contenus sponsorisés</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchStats(); fetchCampaigns(); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          
          {/* Bouton Créer Campagne */}
          <div className="relative">
            <button
              onClick={() => setShowCreateDropdown(!showCreateDropdown)}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-2.5 px-5 rounded-lg transition-all flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nouvelle Campagne
              <ChevronDown className={`w-4 h-4 transition-transform ${showCreateDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Types de campagnes */}
            {showCreateDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCreateDropdown(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                  <div className="p-2">
                    <button
                      onClick={() => { router.push('/marketing/publicite/banner-home'); setShowCreateDropdown(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-orange-50 rounded-lg transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <Layout className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 group-hover:text-orange-600">Bannière Accueil</div>
                        <div className="text-xs text-gray-500">100,000 FCFA/semaine</div>
                      </div>
                    </button>

                    <button
                      onClick={() => { router.push('/marketing/publicite/banner-feed'); setShowCreateDropdown(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-orange-50 rounded-lg transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 group-hover:text-orange-600">Bannière Feed</div>
                        <div className="text-xs text-gray-500">85,000 FCFA/semaine</div>
                      </div>
                    </button>

                    <button
                      onClick={() => { router.push('/marketing/publicite/video-home'); setShowCreateDropdown(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-orange-50 rounded-lg transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Video className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 group-hover:text-orange-600">Vidéo Pop-up</div>
                        <div className="text-xs text-gray-500">450,000 FCFA/semaine</div>
                      </div>
                    </button>

                    <button
                      onClick={() => { router.push('/marketing/publicite/article-trending'); setShowCreateDropdown(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-orange-50 rounded-lg transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 group-hover:text-orange-600">Article Sponsorisé</div>
                        <div className="text-xs text-gray-500">150,000 FCFA/semaine</div>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalCampaigns || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-sm text-gray-500">Actives</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats?.activeCampaigns || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            <span className="text-sm text-gray-500">En attente</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats?.pendingCampaigns || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-purple-500" />
            <span className="text-sm text-gray-500">Vues</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{stats?.totalViews?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <MousePointer className="w-5 h-5 text-indigo-500" />
            <span className="text-sm text-gray-500">Clics</span>
          </div>
          <p className="text-2xl font-bold text-indigo-600">{stats?.totalClicks?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-orange-500" />
            <span className="text-sm text-gray-500">Revenus</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{((stats?.totalRevenue || 0) / 1000).toFixed(0)}K</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 inline-flex gap-1 flex-wrap">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'campaigns'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Campagnes
          {stats?.pendingCampaigns ? (
            <span className="bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full font-bold">
              {stats.pendingCampaigns}
            </span>
          ) : null}
        </button>
        <button
          onClick={() => setActiveTab('sponsored-articles')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'sponsored-articles'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Articles Sponsorisés
        </button>
        <button
          onClick={() => setActiveTab('slides')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'slides'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Layout className="w-4 h-4" />
          Slides Accueil
        </button>
        <button
          onClick={() => setActiveTab('feed-banners')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'feed-banners'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Bannières Feed
        </button>
      </div>

      {/* Filtres (seulement pour campagnes) */}
      {activeTab === 'campaigns' && (
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'Toutes', color: 'gray' },
            { value: 'pending', label: 'En attente', color: 'yellow' },
            { value: 'active', label: 'Actives', color: 'green' },
            { value: 'rejected', label: 'Rejetées', color: 'red' },
            { value: 'completed', label: 'Terminées', color: 'blue' }
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterStatus === filter.value
                  ? filter.color === 'yellow' ? 'bg-yellow-500 text-white' :
                    filter.color === 'green' ? 'bg-green-500 text-white' :
                    filter.color === 'red' ? 'bg-red-500 text-white' :
                    filter.color === 'blue' ? 'bg-blue-500 text-white' :
                    'bg-gray-800 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

          {/* Liste des campagnes */}
          {activeTab === 'campaigns' && (
          loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Aucune campagne à afficher</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Header carte */}
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-sm font-semibold text-orange-600">
                        {getCampaignTypeLabel(campaign.campaign_type)}
                      </div>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 mb-1">{campaign.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{campaign.banner_title}</p>
                  </div>

                  {/* Image preview */}
                  {campaign.desktop_image_url && (
                    <div className="aspect-[4/1] bg-gray-100 relative">
                      <img 
                        src={campaign.desktop_image_url} 
                        alt={campaign.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Infos */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Démarrage: {new Date(campaign.start_date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Durée: {campaign.duration_days} jours</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold text-orange-600">{campaign.budget.toLocaleString()} FCFA</span>
                    </div>
                    {campaign.design_request && (
                      <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        ✨ Création design demandée
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="p-4 pt-0">
                    <button
                      onClick={() => {
                        setSelectedCampaign(campaign)
                        setShowModal(true)
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Examiner
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
          )}

          {/* Liste des slides */}
          {activeTab === 'slides' && (
            <div>
              {/* Bouton ajouter slide */}
              <div className="mb-6">
                <button
                  onClick={() => openSlideModal()}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center gap-2 shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Ajouter un slide
                </button>
              </div>

            {slidesLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Chargement...</p>
              </div>
            ) : slides.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Aucun slide à afficher</p>
                <p className="text-sm text-gray-500 mt-2">Cliquez sur le bouton ci-dessus pour en ajouter un</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {slides.map((slide) => (
                  <div
                    key={slide.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    {/* Image preview */}
                    {slide.image_url && (
                      <div className="aspect-[16/9] bg-gray-100 relative">
                        <img 
                          src={slide.image_url} 
                          alt={slide.title}
                          className="w-full h-full object-cover"
                        />
                        {!slide.is_active && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">INACTIF</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Infos */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-lg text-gray-900">{slide.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          slide.is_active 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          #{slide.display_order}
                        </span>
                      </div>
                      
                      {slide.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{slide.description}</p>
                      )}
                      
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>🏢 {slide.company_name}</span>
                        <span className="text-orange-600 font-semibold">{slide.cta_text}</span>
                      </div>

                      {/* Stats */}
                      <div className="flex gap-4 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-1 text-sm">
                          <Eye className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold">{slide.view_count.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold">{slide.click_count.toLocaleString()}</span>
                        </div>
                      </div>

                      {slide.link_url && (
                        <a 
                          href={slide.link_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate block"
                        >
                          {slide.link_url}
                        </a>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="p-4 pt-0 flex gap-2">
                      <button
                        onClick={() => handleToggleSlideActive(slide.id, slide.is_active)}
                        className={`flex-1 font-semibold py-2 px-4 rounded-lg transition-colors ${
                          slide.is_active
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {slide.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={() => openSlideModal(slide)}
                        className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                        title="Éditer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSlide(slide.id)}
                        className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}

          {/* Liste des bannières feed */}
          {activeTab === 'feed-banners' && (
            <div>
              {/* Bouton ajouter bannière */}
              <div className="mb-6">
                <button
                  onClick={() => setShowAddBannerModal(true)}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center gap-2 shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Ajouter une bannière feed
                </button>
              </div>

              {feedBannersLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Chargement...</p>
                </div>
              ) : feedBanners.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Aucune bannière feed à afficher</p>
                  <p className="text-sm text-gray-500 mt-2">Cliquez sur le bouton ci-dessus pour en ajouter une</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Grouper par position */}
                  {[7, 14, 21].map(position => {
                    const bannersAtPosition = feedBanners.filter(b => b.position === position)
                    if (bannersAtPosition.length === 0) return null

                    return (
                      <div key={position} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center font-bold">
                            {position}
                          </div>
                          <h3 className="font-bold text-lg">Position {position} (après {position - 1} articles)</h3>
                          <span className="text-sm text-gray-500">• {bannersAtPosition.length} bannière(s)</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {bannersAtPosition.map(banner => (
                            <div
                              key={banner.id}
                              className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                            >
                              {/* Image preview */}
                              <div className="relative bg-gray-100">
                                <img
                                  src={banner.image_url}
                                  alt={banner.title}
                                  className="w-full h-auto object-cover"
                                  style={{ maxHeight: '120px' }}
                                />
                                {!banner.is_active && (
                                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">INACTIF</span>
                                  </div>
                                )}
                                <div className="absolute top-2 right-2 flex gap-1">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    banner.is_active 
                                      ? 'bg-green-500 text-white' 
                                      : 'bg-gray-500 text-white'
                                  }`}>
                                    {banner.is_active ? 'ACTIF' : 'INACTIF'}
                                  </span>
                                  <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-500 text-white">
                                    Priorité: {banner.priority}
                                  </span>
                                </div>
                              </div>

                              {/* Infos */}
                              <div className="p-3 space-y-2">
                                <h4 className="font-bold text-sm truncate">{banner.title}</h4>
                                
                                <a
                                  href={banner.redirect_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline truncate block"
                                >
                                  {banner.redirect_url}
                                </a>

                                {/* Stats */}
                                <div className="flex gap-3 pt-2 border-t border-gray-200">
                                  <div className="flex items-center gap-1 text-xs">
                                    <Eye className="w-3 h-3 text-gray-400" />
                                    <span className="font-semibold">{banner.view_count.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs">
                                    <ExternalLink className="w-3 h-3 text-gray-400" />
                                    <span className="font-semibold">{banner.click_count.toLocaleString()}</span>
                                  </div>
                                </div>

                                {/* Dates */}
                                <div className="text-xs text-gray-500">
                                  <div>Début: {new Date(banner.start_date).toLocaleDateString()}</div>
                                  {banner.end_date && (
                                    <div>Fin: {new Date(banner.end_date).toLocaleDateString()}</div>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="p-3 pt-0 flex gap-2">
                                <button
                                  onClick={() => handleToggleFeedBannerActive(banner.id, banner.is_active)}
                                  className={`flex-1 font-semibold py-2 px-3 rounded-lg transition-colors text-xs ${
                                    banner.is_active
                                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                      : 'bg-green-500 hover:bg-green-600 text-white'
                                  }`}
                                >
                                  {banner.is_active ? 'Désactiver' : 'Activer'}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingBanner(banner)
                                    setShowAddBannerModal(true)
                                  }}
                                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold py-2 px-3 rounded-lg transition-colors"
                                  title="Éditer"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteFeedBanner(banner.id)}
                                  className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-3 rounded-lg transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Liste des articles sponsorisés */}
          {activeTab === 'sponsored-articles' && (
            articlesLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Chargement...</p>
              </div>
            ) : sponsoredArticles.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <span className="text-6xl mb-4 block">🔥</span>
                <p className="text-gray-600">Aucun article sponsorisé à afficher</p>
                <p className="text-sm text-gray-500 mt-2">Les articles créés en mode Demo apparaîtront ici</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {sponsoredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className="flex gap-4 p-6">
                      {/* Image */}
                      {article.image_urls && article.image_urls[0] && (
                        <div className="w-48 h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={article.image_urls[0]}
                            alt={article.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Contenu */}
                      <div className="flex-1">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="inline-block bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded">
                                {article.feed?.name || 'Gabon Insight'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(article.created_at).toLocaleDateString('fr-FR')}
                              </span>
                              {article.is_published ? (
                                <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded">
                                  ✓ PUBLIÉ
                                </span>
                              ) : (
                                <span className="inline-block bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-1 rounded">
                                  ⏸ BROUILLON
                                </span>
                              )}
                              {article.is_trending && (
                                <span className="inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded">
                                  🔥 TENDANCE
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 mb-2">{article.title}</h3>
                            <p className="text-sm text-gray-600 line-clamp-2">{article.summary}</p>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            <span>{article.view_count.toLocaleString()} vues</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ExternalLink className="w-4 h-4" />
                            <span>{article.share_count} partages</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            Catégorie: {article.category}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleArticlePublished(article.id, article.is_published)}
                            className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                              article.is_published
                                ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                                : 'bg-green-100 hover:bg-green-200 text-green-700'
                            }`}
                          >
                            {article.is_published ? (
                              <>
                                <X className="w-4 h-4" />
                                Dépublier
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                Publier
                              </>
                            )}
                          </button>
                          <a
                            href={`/admin/preview-article/${article.id}`}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            {article.is_published ? 'Voir l\'article' : 'Prévisualiser & Valider'}
                          </a>
                          <button
                            onClick={() => handleDeleteArticle(article.id)}
                            className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

      {/* Modal détails campagne */}
      {showModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header modal */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedCampaign.name}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {getCampaignTypeLabel(selectedCampaign.campaign_type)}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false)
                  setRejectionReason('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Contenu modal */}
            <div className="p-6 space-y-6">
              {/* Statut */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Statut</label>
                {getStatusBadge(selectedCampaign.status)}
              </div>

              {/* Informations générales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Titre bannière</label>
                  <p className="text-gray-900">{selectedCampaign.banner_title}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date démarrage</label>
                  <p className="text-gray-900">{new Date(selectedCampaign.start_date).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Durée</label>
                  <p className="text-gray-900">{selectedCampaign.duration_days} jours</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Budget</label>
                  <p className="text-orange-600 font-bold">{selectedCampaign.budget.toLocaleString()} FCFA</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <p className="text-gray-600">{selectedCampaign.banner_description}</p>
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">URL de redirection</label>
                <a 
                  href={selectedCampaign.redirect_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  {selectedCampaign.redirect_url}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Images */}
              {!selectedCampaign.design_request && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Image Desktop</label>
                    {selectedCampaign.desktop_image_url ? (
                      <img 
                        src={selectedCampaign.desktop_image_url} 
                        alt="Desktop"
                        className="w-full rounded-lg border border-gray-300"
                      />
                    ) : (
                      <p className="text-gray-400">Aucune image</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Image Mobile</label>
                    {selectedCampaign.mobile_image_url ? (
                      <img 
                        src={selectedCampaign.mobile_image_url} 
                        alt="Mobile"
                        className="max-w-md rounded-lg border border-gray-300"
                      />
                    ) : (
                      <p className="text-gray-400">Aucune image</p>
                    )}
                  </div>
                </div>
              )}

              {/* Demande création design */}
              {selectedCampaign.design_request && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">✨ Création design demandée (+50,000 FCFA)</h3>
                  {selectedCampaign.design_request_notes && (
                    <div>
                      <label className="block text-sm font-semibold text-blue-800 mb-1">Notes du client:</label>
                      <p className="text-blue-700">{selectedCampaign.design_request_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions validation (seulement si pending) */}
              {selectedCampaign.status === 'pending' && (
                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <h3 className="font-semibold text-gray-900">Actions de validation</h3>
                  
                  {/* Rejet */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Raison du rejet (si rejeté)
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Ex: Images non conformes, contenu inapproprié..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  {/* Boutons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReject(selectedCampaign.id)}
                      disabled={actionLoading || !rejectionReason.trim()}
                      className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Rejeter
                    </button>
                    <button
                      onClick={() => handleValidate(selectedCampaign.id)}
                      disabled={actionLoading}
                      className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Valider
                    </button>
                  </div>
                </div>
              )}

              {/* Info si déjà validé/rejeté */}
              {selectedCampaign.status !== 'pending' && (
                <div className={`rounded-lg p-4 ${
                  selectedCampaign.status === 'active' ? 'bg-green-50 border border-green-200' :
                  selectedCampaign.status === 'rejected' ? 'bg-red-50 border border-red-200' :
                  'bg-gray-50 border border-gray-200'
                }`}>
                  <p className="text-sm font-semibold">
                    {selectedCampaign.status === 'active' && '✅ Cette campagne a été validée'}
                    {selectedCampaign.status === 'rejected' && '❌ Cette campagne a été rejetée'}
                    {selectedCampaign.status === 'completed' && '⏹️ Cette campagne est terminée'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal ajouter/éditer bannière feed */}
      <FeedBannerModal
        isOpen={showAddBannerModal}
        onClose={() => {
          setShowAddBannerModal(false)
          setEditingBanner(null)
        }}
        onSuccess={() => {
          fetchFeedBanners()
          setEditingBanner(null)
        }}
        editingBanner={editingBanner}
      />

      {/* Modal ajouter/éditer slide */}
      {showSlideModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header modal */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingSlide ? '✏️ Modifier le Slide' : '➕ Nouveau Slide'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {editingSlide ? 'Modifiez les informations du slide' : 'Créez un nouveau slide publicitaire'}
                </p>
              </div>
              <button
                onClick={() => { setShowSlideModal(false); setEditingSlide(null); }}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSaveSlide} className="p-6 space-y-6">
              {/* Infos de base */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                  <input
                    type="text"
                    required
                    value={slideFormData.title}
                    onChange={(e) => setSlideFormData({...slideFormData, title: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Titre du slide"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise *</label>
                  <input
                    type="text"
                    required
                    value={slideFormData.company_name}
                    onChange={(e) => setSlideFormData({...slideFormData, company_name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Nom de l'entreprise"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={slideFormData.description}
                  onChange={(e) => setSlideFormData({...slideFormData, description: e.target.value})}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Description du slide (optionnel)"
                />
              </div>

              {/* Section Upload Images */}
              <div className="border-t pt-6">
                <ImageUploader
                  onImagesChange={(images) => setSlideFormData({...slideFormData, images})}
                  initialImages={{
                    banner: slideFormData.images.banner || undefined,
                    mobile: slideFormData.images.mobile || undefined
                  }}
                />
              </div>

              {/* URL Image alternative */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL d'image alternative (optionnel)
                </label>
                <input
                  type="url"
                  value={slideFormData.image_url}
                  onChange={(e) => setSlideFormData({...slideFormData, image_url: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="https://example.com/image.jpg"
                />
                <p className="text-xs text-gray-500 mt-1">Utilisé comme fallback si les images uploadées ne sont pas disponibles</p>
              </div>

              {/* Lien et CTA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lien de destination</label>
                  <input
                    type="url"
                    value={slideFormData.link_url}
                    onChange={(e) => setSlideFormData({...slideFormData, link_url: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Texte du bouton</label>
                  <input
                    type="text"
                    value={slideFormData.cta_text}
                    onChange={(e) => setSlideFormData({...slideFormData, cta_text: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="En savoir plus"
                  />
                </div>
              </div>

              {/* Ordre d'affichage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ordre d'affichage</label>
                <input
                  type="number"
                  min="1"
                  value={slideFormData.display_order}
                  onChange={(e) => setSlideFormData({...slideFormData, display_order: parseInt(e.target.value) || 1})}
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* Section Planification */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 Planification de diffusion</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type de planification</label>
                  <select
                    value={slideFormData.schedule_type}
                    onChange={(e) => setSlideFormData({...slideFormData, schedule_type: e.target.value as 'always' | 'scheduled' | 'recurring'})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="always">🔄 Toujours actif</option>
                    <option value="scheduled">📆 Planifié (dates fixes)</option>
                    <option value="recurring">🔁 Récurrent (jours de la semaine)</option>
                  </select>
                </div>

                {slideFormData.schedule_type !== 'always' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                        <input
                          type="date"
                          value={slideFormData.start_date}
                          onChange={(e) => setSlideFormData({...slideFormData, start_date: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                        <input
                          type="date"
                          value={slideFormData.end_date}
                          onChange={(e) => setSlideFormData({...slideFormData, end_date: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {slideFormData.schedule_type === 'recurring' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Jours de diffusion</label>
                        <div className="flex flex-wrap gap-2">
                          {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                const newDays = slideFormData.days_of_week.includes(index)
                                  ? slideFormData.days_of_week.filter(d => d !== index)
                                  : [...slideFormData.days_of_week, index].sort()
                                setSlideFormData({...slideFormData, days_of_week: newDays})
                              }}
                              className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                                slideFormData.days_of_week.includes(index)
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Boutons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowSlideModal(false); setEditingSlide(null); }}
                  className="px-5 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={slideSaving}
                  className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {slideSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingSlide ? 'Mettre à jour' : 'Créer le slide'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
