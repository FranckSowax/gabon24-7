'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Search, Shield, Trash2, RefreshCw, Plus, Minus, Eye, X,
  Users, Wallet, BarChart3, Crown, MessageSquare, Calendar,
  TrendingUp, Activity, Coins, Award, Filter, Download,
  ChevronLeft, ChevronRight, UserPlus, Mail, Phone,
  Briefcase, Target, ExternalLink, Rocket
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  email: string
  phone: string | null
  full_name: string
  subscription_type: string
  subscription_status: string
  subscription_start_date: string | null
  subscription_end_date: string | null
  whatsapp_number: string | null
  is_active: boolean
  last_login: string | null
  created_at: string
  journalist_verified: boolean
  media_affiliation: string | null
  credits_balance: number
  whatsapp_credits: number
  language: string
  projects_count?: number
}

interface UserStats {
  totalUsers: number
  activeUsers: number
  premiumUsers: number
  journalistUsers: number
  totalCredits: number
  newUsersThisWeek: number
  newUsersThisMonth: number
  totalProjects: number
}

interface UserProject {
  id: string
  article_title: string
  proposition_titre: string
  proposition_description: string
  secteur_principal: string
  budget_selectionne: string
  proposition_score_faisabilite: number
  current_phase: string | null
  progress_percentage: number | null
  total_credits_used: number | null
  created_at: string
  updated_at: string | null
}

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(25)
  const [stats, setStats] = useState<UserStats | null>(null)
  
  // Onglet actif
  const [activeTab, setActiveTab] = useState<'list' | 'credits' | 'stats'>('list')
  
  // Filtres
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubscription, setFilterSubscription] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [filterJournalist, setFilterJournalist] = useState<'all' | 'verified' | 'not_verified'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'last_login' | 'credits_balance'>('created_at')
  
  // Modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [creditsToAdd, setCreditsToAdd] = useState(100)
  
  // Projets utilisateur
  const [userProjects, setUserProjects] = useState<UserProject[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchStats()
  }, [currentPage, filterSubscription, filterStatus, filterJournalist, sortBy])

  const fetchStats = async () => {
    try {
      // Total users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // Active users
      const { count: activeUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      // Premium users
      const { count: premiumUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_type', 'premium')

      // Journalist users
      const { count: journalistUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('journalist_verified', true)

      // Total credits (depuis user_credits qui est la source principale)
      const { data: creditsData } = await supabase
        .from('user_credits')
        .select('balance')
      const totalCredits = creditsData?.reduce((sum: number, u: { balance: number | null }) => sum + (u.balance || 0), 0) || 0

      // New users this week
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const { count: newUsersThisWeek } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString())

      // New users this month
      const monthAgo = new Date()
      monthAgo.setDate(monthAgo.getDate() - 30)
      const { count: newUsersThisMonth } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthAgo.toISOString())

      // Total projects
      const { count: totalProjects } = await supabase
        .from('saved_projects')
        .select('*', { count: 'exact', head: true })

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        premiumUsers: premiumUsers || 0,
        journalistUsers: journalistUsers || 0,
        totalCredits,
        newUsersThisWeek: newUsersThisWeek || 0,
        newUsersThisMonth: newUsersThisMonth || 0,
        totalProjects: totalProjects || 0
      })
    } catch (error) {
      console.error('Erreur stats:', error)
    }
  }

  const fetchUserProjects = async (userId: string) => {
    try {
      setLoadingProjects(true)
      const { data, error } = await supabase
        .from('saved_projects')
        .select(`
          id,
          article_title,
          proposition_titre,
          proposition_description,
          secteur_principal,
          budget_selectionne,
          proposition_score_faisabilite,
          current_phase,
          progress_percentage,
          total_credits_used,
          created_at,
          updated_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erreur projets:', error)
        setUserProjects([])
      } else {
        setUserProjects(data || [])
      }
    } catch (error) {
      console.error('Erreur projets:', error)
      setUserProjects([])
    } finally {
      setLoadingProjects(false)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })

      if (searchTerm) {
        query = query.or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
      }

      if (filterSubscription !== 'all') {
        query = query.eq('subscription_type', filterSubscription)
      }

      if (filterStatus === 'active') {
        query = query.eq('is_active', true)
      } else if (filterStatus === 'inactive') {
        query = query.eq('is_active', false)
      }

      if (filterJournalist === 'verified') {
        query = query.eq('journalist_verified', true)
      } else if (filterJournalist === 'not_verified') {
        query = query.eq('journalist_verified', false)
      }

      query = query.order(sortBy, { ascending: false })

      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.error('Erreur:', error)
        return
      }

      // Récupérer le nombre de projets et crédits réels pour chaque utilisateur
      const usersWithExtras = await Promise.all(
        (data || []).map(async (user: User) => {
          // Projets
          const { count: projectsCount } = await supabase
            .from('saved_projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)

          // Crédits depuis user_credits (source principale)
          const { data: creditsData } = await supabase
            .from('user_credits')
            .select('balance')
            .eq('user_id', user.id)
            .single()

          return {
            ...user,
            projects_count: projectsCount || 0,
            credits_balance: creditsData?.balance ?? user.credits_balance ?? 0
          }
        })
      )

      setUsers(usersWithExtras)
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (userId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentValue })
        .eq('id', userId)
      
      if (!error) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const handleToggleJournalist = async (userId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ journalist_verified: !currentValue })
        .eq('id', userId)
      
      if (!error) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const handleChangeSubscription = async (userId: string, newType: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ subscription_type: newType })
        .eq('id', userId)
      
      if (!error) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const handleAdjustCredits = async (userId: string, amount: number) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

    try {
      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        alert('Erreur: Non authentifié. Veuillez vous reconnecter.')
        return
      }

      if (amount > 0) {
        // Ajouter des crédits via le nouvel endpoint universel
        const response = await fetch(`${API_URL}/api/admin/subscriptions/adjust-credits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            user_id: userId,
            amount: amount,
            reason: 'admin_bonus'
          })
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          alert(`Erreur: ${result.error || 'Impossible d\'ajouter les crédits'}`)
          return
        }

        fetchUsers()
        alert(`✅ ${amount} crédits ajoutés avec succès (solde: ${result.new_balance})`)
      } else {
        // Retirer des crédits - utiliser le nouvel endpoint backend
        const response = await fetch(`${API_URL}/api/admin/subscriptions/adjust-credits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            user_id: userId,
            amount: amount, // Négatif pour retirer
            reason: 'admin_deduction'
          })
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          alert(`Erreur: ${result.error || 'Impossible de retirer les crédits'}`)
          return
        }

        fetchUsers()
        alert(`✅ ${Math.abs(amount)} crédits retirés avec succès (solde: ${result.new_balance})`)
      }
    } catch (error) {
      console.error('Erreur ajustement crédits:', error)
      alert('Erreur lors de l\'ajustement des crédits. Vérifiez la console.')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return
    
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)
      
      if (!error) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const getSubscriptionBadge = (type: string) => {
    const badges: Record<string, string> = {
      free: 'bg-gray-100 text-gray-700',
      freemium: 'bg-gray-100 text-gray-700',
      discovery: 'bg-yellow-100 text-yellow-700',
      premium: 'bg-yellow-100 text-yellow-700',
      pro: 'bg-purple-100 text-purple-700',
      professionnel: 'bg-purple-100 text-purple-700',
      journalist: 'bg-blue-100 text-blue-700',
      enterprise: 'bg-purple-100 text-purple-700'
    }
    return badges[type?.toLowerCase()] || 'bg-gray-100 text-gray-700'
  }

  // Formater le nom d'affichage de l'abonnement
  const getSubscriptionLabel = (type: string) => {
    const labels: Record<string, string> = {
      free: 'Freemium',
      freemium: 'Freemium',
      discovery: 'Premium',
      premium: 'Premium',
      pro: 'Professionnel',
      professionnel: 'Professionnel',
      journalist: 'Journaliste',
      enterprise: 'Enterprise'
    }
    return labels[type?.toLowerCase()] || type || 'Freemium'
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  const exportUsers = () => {
    const headers = ['Nom', 'Email', 'Téléphone', 'WhatsApp', 'Abonnement', 'Crédits', 'Statut', 'Date création']
    const rows = users.map(u => [
      u.full_name,
      u.email,
      u.phone || '',
      u.whatsapp_number || '',
      u.subscription_type,
      u.credits_balance || 0,
      u.is_active ? 'Actif' : 'Inactif',
      new Date(u.created_at).toLocaleDateString()
    ])
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `utilisateurs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header avec Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">👥 Gestion Utilisateurs</h1>
          <p className="text-gray-500 mt-1">Utilisateurs, crédits et statistiques</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchUsers(); fetchStats(); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button
            onClick={exportUsers}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-green-500" />
            <span className="text-sm text-gray-500">Actifs</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats?.activeUsers || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            <span className="text-sm text-gray-500">Premium</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats?.premiumUsers || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-gray-500">Journalistes</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats?.journalistUsers || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-orange-500" />
            <span className="text-sm text-gray-500">Crédits</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{stats?.totalCredits?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100" title="Total de tous les projets créés sur la plateforme">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-5 h-5 text-indigo-500" />
            <span className="text-sm text-gray-500">Projets (total)</span>
          </div>
          <p className="text-2xl font-bold text-indigo-600">{stats?.totalProjects || 0}</p>
          <p className="text-xs text-gray-400 mt-1">
            Page: {users.reduce((sum, u) => sum + (u.projects_count || 0), 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-5 h-5 text-purple-500" />
            <span className="text-sm text-gray-500">Cette semaine</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">+{stats?.newUsersThisWeek || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <span className="text-sm text-gray-500">Ce mois</span>
          </div>
          <p className="text-2xl font-bold text-indigo-600">+{stats?.newUsersThisMonth || 0}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Recherche */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher nom, email, téléphone..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Type abonnement */}
          <div>
            <select
              value={filterSubscription}
              onChange={(e) => setFilterSubscription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Tous abonnements</option>
              <option value="free">Gratuit</option>
              <option value="premium">Premium</option>
              <option value="journalist">Journaliste</option>
              <option value="enterprise">Entreprise</option>
            </select>
          </div>

          {/* Statut */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Tous statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={fetchUsers}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </button>
            
            <select
              value={filterJournalist}
              onChange={(e) => setFilterJournalist(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">Tous</option>
              <option value="verified">Journalistes vérifiés</option>
              <option value="not_verified">Non vérifiés</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Trier par:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            >
              <option value="created_at">Date création</option>
              <option value="last_login">Dernière connexion</option>
              <option value="credits_balance">Crédits</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Utilisateur</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Contact</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Abonnement</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Crédits</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Projets</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                          <p className="text-xs text-gray-400">
                            Créé: {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {user.phone && (
                            <div className="text-gray-700">📞 {user.phone}</div>
                          )}
                          {user.whatsapp_number && (
                            <div className="text-green-600">💬 {user.whatsapp_number}</div>
                          )}
                          {user.media_affiliation && (
                            <div className="text-blue-600 text-xs">🏢 {user.media_affiliation}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSubscriptionBadge(user.subscription_type)}`}>
                            {getSubscriptionLabel(user.subscription_type)}
                          </span>
                          {user.journalist_verified && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Journaliste
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-lg font-bold text-orange-600">
                            {user.credits_balance?.toLocaleString() || 0}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleAdjustCredits(user.id, 100)}
                              className="p-1 hover:bg-green-50 rounded"
                              title="Ajouter 100"
                            >
                              <Plus className="w-3 h-3 text-green-600" />
                            </button>
                            <button
                              onClick={() => handleAdjustCredits(user.id, -100)}
                              className="p-1 hover:bg-red-50 rounded"
                              title="Retirer 100"
                            >
                              <Minus className="w-3 h-3 text-red-600" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-lg font-bold ${
                            (user.projects_count || 0) > 0 ? 'text-blue-600' : 'text-gray-400'
                          }`}>
                            {user.projects_count || 0}
                          </span>
                          {(user.projects_count || 0) > 0 && (
                            <span className="text-xs text-gray-500">
                              <Briefcase className="w-3 h-3 inline" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-center">
                          <button
                            onClick={() => handleToggleActive(user.id, user.is_active)}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              user.is_active
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            {user.is_active ? 'Actif' : 'Inactif'}
                          </button>
                          {user.last_login && (
                            <span className="text-xs text-gray-500">
                              {new Date(user.last_login).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setShowModal(true)
                              fetchUserProjects(user.id)
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="Détails"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleToggleJournalist(user.id, user.journalist_verified)}
                            className="p-2 hover:bg-blue-50 rounded-lg"
                            title="Toggle Journaliste"
                          >
                            <Shield className={`w-4 h-4 ${user.journalist_verified ? 'text-blue-600' : 'text-gray-400'}`} />
                          </button>
                          <select
                            value={user.subscription_type}
                            onChange={(e) => handleChangeSubscription(user.id, e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                            title="Changer abonnement"
                          >
                            <option value="free">Freemium</option>
                            <option value="discovery">Premium</option>
                            <option value="pro">Professionnel</option>
                          </select>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 hover:bg-red-50 rounded-lg"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} sur {totalPages} ({totalCount.toLocaleString()} utilisateurs)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Détails Utilisateur */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                    {selectedUser.full_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedUser.full_name}</h2>
                    <p className="text-orange-100">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSubscriptionBadge(selectedUser.subscription_type)}`}>
                  {getSubscriptionLabel(selectedUser.subscription_type)}
                </span>
                {selectedUser.journalist_verified && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1">
                    <Shield className="w-4 h-4" /> Journaliste vérifié
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedUser.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {selectedUser.is_active ? '✓ Actif' : '✗ Inactif'}
                </span>
              </div>

              {/* Crédits Section */}
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-6 border border-orange-200">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-orange-500" />
                  Gestion des Crédits
                </h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-orange-600">{selectedUser.credits_balance?.toLocaleString() || 0}</p>
                    <p className="text-sm text-gray-500">Crédits actuels</p>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      type="number"
                      value={creditsToAdd}
                      onChange={(e) => setCreditsToAdd(parseInt(e.target.value) || 0)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center"
                      placeholder="100"
                    />
                    <button
                      onClick={() => {
                        handleAdjustCredits(selectedUser.id, creditsToAdd)
                        setSelectedUser({ ...selectedUser, credits_balance: (selectedUser.credits_balance || 0) + creditsToAdd })
                      }}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Ajouter
                    </button>
                    <button
                      onClick={() => {
                        handleAdjustCredits(selectedUser.id, -creditsToAdd)
                        setSelectedUser({ ...selectedUser, credits_balance: Math.max(0, (selectedUser.credits_balance || 0) - creditsToAdd) })
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                    >
                      <Minus className="w-4 h-4" /> Retirer
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  {[50, 100, 500, 1000].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setCreditsToAdd(amount)}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        creditsToAdd === amount 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
              </div>

              {/* Informations */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Informations personnelles
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="font-medium">{selectedUser.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Téléphone</p>
                        <p className="font-medium">{selectedUser.phone || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-xs text-gray-500">WhatsApp</p>
                        <p className="font-medium">{selectedUser.whatsapp_number || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" />
                    Activité
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Inscrit le</p>
                        <p className="font-medium">{new Date(selectedUser.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Activity className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Dernière connexion</p>
                        <p className="font-medium">
                          {selectedUser.last_login 
                            ? new Date(selectedUser.last_login).toLocaleString('fr-FR') 
                            : 'Jamais'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Award className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Langue</p>
                        <p className="font-medium">{selectedUser.language || 'fr'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Projets */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-500" />
                  Projets Business ({userProjects.length})
                </h3>
                
                {loadingProjects ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : userProjects.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Briefcase className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Aucun projet créé</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {userProjects.map((project) => (
                      <div 
                        key={project.id} 
                        className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">
                              {project.proposition_titre || project.article_title}
                            </h4>
                            <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                              {project.proposition_description}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                {project.secteur_principal}
                              </span>
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                {project.budget_selectionne}
                              </span>
                              {project.current_phase && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs flex items-center gap-1">
                                  <Rocket className="w-3 h-3" />
                                  {project.current_phase}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              <Target className="w-4 h-4 text-orange-500" />
                              <span className="text-sm font-bold text-orange-600">
                                {project.proposition_score_faisabilite}%
                              </span>
                            </div>
                            {project.progress_percentage !== null && project.progress_percentage > 0 && (
                              <div className="w-20">
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                    style={{ width: `${project.progress_percentage}%` }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 text-right mt-0.5">
                                  {project.progress_percentage}%
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
                          <span>Créé le {new Date(project.created_at).toLocaleDateString('fr-FR')}</span>
                          {project.total_credits_used !== null && project.total_credits_used > 0 && (
                            <span className="flex items-center gap-1">
                              <Coins className="w-3 h-3 text-orange-500" />
                              {project.total_credits_used} crédits utilisés
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions rapides */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleToggleActive(selectedUser.id, selectedUser.is_active)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    selectedUser.is_active 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {selectedUser.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  onClick={() => handleToggleJournalist(selectedUser.id, selectedUser.journalist_verified)}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200"
                >
                  {selectedUser.journalist_verified ? 'Retirer badge journaliste' : 'Ajouter badge journaliste'}
                </button>
                <select
                  value={selectedUser.subscription_type}
                  onChange={(e) => {
                    handleChangeSubscription(selectedUser.id, e.target.value)
                    setSelectedUser({ ...selectedUser, subscription_type: e.target.value })
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                  <option value="journalist">Journalist</option>
                  <option value="enterprise">Enterprise</option>
                </select>
                <button
                  onClick={() => {
                    if (confirm('Supprimer cet utilisateur ?')) {
                      handleDeleteUser(selectedUser.id)
                      setShowModal(false)
                    }
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 ml-auto"
                >
                  <Trash2 className="w-4 h-4 inline mr-2" />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
