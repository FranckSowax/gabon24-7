'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Bell, 
  BellRing,
  Check, 
  CheckCheck,
  Trash2, 
  Archive,
  Filter,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  Clock,
  User,
  FileText,
  CreditCard,
  Shield,
  Bot,
  Rss,
  Settings,
  ExternalLink,
  MoreVertical,
  Search,
  Calendar
} from 'lucide-react'

// Types
interface AdminNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'system'
  category: 'system' | 'user' | 'content' | 'payment' | 'security' | 'ai'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  source: string | null
  is_read: boolean
  is_archived: boolean
  metadata: Record<string, any>
  action_url: string | null
  action_label: string | null
  reference_type: string | null
  reference_id: string | null
  created_at: string
  read_at: string | null
  archived_at: string | null
  expires_at: string | null
}

// Configuration des types
const TYPE_CONFIG = {
  info: { icon: Info, color: 'blue', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  success: { icon: CheckCircle, color: 'green', bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
  warning: { icon: AlertTriangle, color: 'yellow', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', borderColor: 'border-yellow-200' },
  error: { icon: XCircle, color: 'red', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' },
  system: { icon: Settings, color: 'purple', bgColor: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
}

// Configuration des catégories
const CATEGORY_CONFIG = {
  system: { icon: Settings, label: 'Système', color: 'gray' },
  user: { icon: User, label: 'Utilisateurs', color: 'blue' },
  content: { icon: FileText, label: 'Contenu', color: 'green' },
  payment: { icon: CreditCard, label: 'Paiements', color: 'yellow' },
  security: { icon: Shield, label: 'Sécurité', color: 'red' },
  ai: { icon: Bot, label: 'IA', color: 'purple' },
}

// Configuration des priorités
const PRIORITY_CONFIG = {
  low: { label: 'Basse', color: 'gray' },
  normal: { label: 'Normale', color: 'blue' },
  high: { label: 'Haute', color: 'orange' },
  urgent: { label: 'Urgente', color: 'red' },
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'archived'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState({ total: 0, unread: 0, urgent: 0 })
  
  // Using singleton supabase from @/lib/supabase

  useEffect(() => {
    loadNotifications()
    loadStats()
    
    // Abonnement temps réel
    const channel = supabase
      .channel('admin_notifications_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'admin_notifications'
      }, () => {
        loadNotifications()
        loadStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [filter, categoryFilter])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })

      // Filtres
      if (filter === 'unread') {
        query = query.eq('is_read', false).eq('is_archived', false)
      } else if (filter === 'read') {
        query = query.eq('is_read', true).eq('is_archived', false)
      } else if (filter === 'archived') {
        query = query.eq('is_archived', true)
      } else {
        query = query.eq('is_archived', false)
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter)
      }

      const { data, error } = await query.limit(100)

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Erreur chargement notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const { data: allData } = await supabase
        .from('admin_notifications')
        .select('id', { count: 'exact' })
        .eq('is_archived', false)

      const { data: unreadData } = await supabase
        .from('admin_notifications')
        .select('id', { count: 'exact' })
        .eq('is_read', false)
        .eq('is_archived', false)

      const { data: urgentData } = await supabase
        .from('admin_notifications')
        .select('id', { count: 'exact' })
        .eq('priority', 'urgent')
        .eq('is_read', false)
        .eq('is_archived', false)

      setStats({
        total: allData?.length || 0,
        unread: unreadData?.length || 0,
        urgent: urgentData?.length || 0
      })
    } catch (error) {
      console.error('Erreur stats:', error)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('admin_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      )
      loadStats()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const ids = notifications.filter(n => !n.is_read).map(n => n.id)
      if (ids.length === 0) return

      await supabase
        .from('admin_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', ids)
      
      loadNotifications()
      loadStats()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const archiveNotification = async (id: string) => {
    try {
      await supabase
        .from('admin_notifications')
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq('id', id)
      
      setNotifications(prev => prev.filter(n => n.id !== id))
      loadStats()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const deleteNotification = async (id: string) => {
    if (!confirm('Supprimer cette notification ?')) return
    
    try {
      await supabase
        .from('admin_notifications')
        .delete()
        .eq('id', id)
      
      setNotifications(prev => prev.filter(n => n.id !== id))
      loadStats()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const bulkAction = async (action: 'read' | 'archive' | 'delete') => {
    if (selectedNotifications.size === 0) return
    
    const ids = Array.from(selectedNotifications)
    
    try {
      if (action === 'read') {
        await supabase
          .from('admin_notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in('id', ids)
      } else if (action === 'archive') {
        await supabase
          .from('admin_notifications')
          .update({ is_archived: true, archived_at: new Date().toISOString() })
          .in('id', ids)
      } else if (action === 'delete') {
        if (!confirm(`Supprimer ${ids.length} notification(s) ?`)) return
        await supabase
          .from('admin_notifications')
          .delete()
          .in('id', ids)
      }
      
      setSelectedNotifications(new Set())
      loadNotifications()
      loadStats()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'À l\'instant'
    if (minutes < 60) return `Il y a ${minutes} min`
    if (hours < 24) return `Il y a ${hours}h`
    if (days < 7) return `Il y a ${days}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  const filteredNotifications = notifications.filter(n => {
    if (!searchQuery) return true
    return n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           n.message.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-7 h-7 text-orange-500" />
            Notifications
          </h1>
          <p className="text-gray-600 mt-1">Gérez les alertes et événements de l'application</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={loadNotifications}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Actualiser"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={markAllAsRead}
            disabled={stats.unread === 0}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            Tout marquer lu
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <BellRing className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.unread}</p>
              <p className="text-sm text-gray-500">Non lues</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.urgent}</p>
              <p className="text-sm text-gray-500">Urgentes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Recherche */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Filtre statut */}
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'Toutes' },
              { id: 'unread', label: 'Non lues' },
              { id: 'read', label: 'Lues' },
              { id: 'archived', label: 'Archivées' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Filtre catégorie */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">Toutes catégories</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        {/* Actions groupées */}
        {selectedNotifications.size > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {selectedNotifications.size} sélectionnée(s)
            </span>
            <button
              onClick={() => bulkAction('read')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Marquer lu
            </button>
            <button
              onClick={() => bulkAction('archive')}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Archiver
            </button>
            <button
              onClick={() => bulkAction('delete')}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Supprimer
            </button>
            <button
              onClick={() => setSelectedNotifications(new Set())}
              className="text-sm text-gray-500 hover:text-gray-700 ml-auto"
            >
              Désélectionner
            </button>
          </div>
        )}
      </div>

      {/* Liste des notifications */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Aucune notification</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map((notification) => {
              const typeConfig = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info
              const categoryConfig = CATEGORY_CONFIG[notification.category] || CATEGORY_CONFIG.system
              const priorityConfig = PRIORITY_CONFIG[notification.priority] || PRIORITY_CONFIG.normal
              const TypeIcon = typeConfig.icon
              const CategoryIcon = categoryConfig.icon

              return (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notification.is_read ? 'bg-orange-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedNotifications.has(notification.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedNotifications)
                        if (e.target.checked) {
                          newSet.add(notification.id)
                        } else {
                          newSet.delete(notification.id)
                        }
                        setSelectedNotifications(newSet)
                      }}
                      className="mt-1 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />

                    {/* Icône type */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeConfig.bgColor}`}>
                      <TypeIcon className={`w-5 h-5 ${typeConfig.textColor}`} />
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className={`font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                        
                        {/* Badge priorité */}
                        {notification.priority === 'urgent' && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                            Urgent
                          </span>
                        )}
                        {notification.priority === 'high' && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                            Important
                          </span>
                        )}
                      </div>

                      {/* Métadonnées */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <CategoryIcon className="w-3.5 h-3.5" />
                          {categoryConfig.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(notification.created_at)}
                        </span>
                        {notification.source && (
                          <span className="text-gray-400">
                            via {notification.source}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-3">
                        {notification.action_url && (
                          <a
                            href={notification.action_url}
                            className="text-sm text-orange-600 hover:text-orange-800 flex items-center gap-1"
                          >
                            {notification.action_label || 'Voir'}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Marquer lu
                          </button>
                        )}
                        <button
                          onClick={() => archiveNotification(notification.id)}
                          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Archiver
                        </button>
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Supprimer
                        </button>
                      </div>
                    </div>

                    {/* Indicateur non lu */}
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
