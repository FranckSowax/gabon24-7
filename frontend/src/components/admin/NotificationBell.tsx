'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Bell, 
  BellRing,
  Check,
  CheckCheck,
  X,
  ExternalLink,
  Clock,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Settings,
  User,
  FileText,
  CreditCard,
  Shield,
  Bot,
  Archive
} from 'lucide-react'
import Link from 'next/link'

interface AdminNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'system'
  category: string
  priority: string
  is_read: boolean
  action_url: string | null
  action_label: string | null
  created_at: string
}

const TYPE_ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  system: Settings,
}

const TYPE_COLORS = {
  info: 'text-blue-500 bg-blue-50',
  success: 'text-green-500 bg-green-50',
  warning: 'text-yellow-500 bg-yellow-50',
  error: 'text-red-500 bg-red-50',
  system: 'text-purple-500 bg-purple-50',
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Using singleton supabase from @/lib/supabase

  useEffect(() => {
    setMounted(true)
    loadNotifications()
    
    // Abonnement temps réel
    const channel = supabase
      .channel('notification_bell_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'admin_notifications'
      }, () => {
        loadNotifications()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = async () => {
    try {
      // Charger les notifications récentes
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setNotifications(data || [])

      // Compter les non lues
      const { count } = await supabase
        .from('admin_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .eq('is_archived', false)

      setUnreadCount(count || 0)
    } catch (error) {
      console.error('Erreur chargement notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('admin_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
      if (unreadIds.length === 0) return

      await supabase
        .from('admin_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds)
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
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
    if (minutes < 60) return `${minutes}min`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  if (!mounted) return null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton cloche */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-6 h-6" />
        ) : (
          <Bell className="w-6 h-6" />
        )}
        
        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50 to-white">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                  {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1"
              >
                <CheckCheck className="w-4 h-4" />
                Tout lire
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                Chargement...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Aucune notification</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notification) => {
                  const TypeIcon = TYPE_ICONS[notification.type] || Info
                  const colorClass = TYPE_COLORS[notification.type] || TYPE_COLORS.info

                  return (
                    <div
                      key={notification.id}
                      className={`p-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                        !notification.is_read ? 'bg-orange-50/50' : ''
                      }`}
                      onClick={() => {
                        if (!notification.is_read) markAsRead(notification.id)
                        if (notification.action_url) {
                          window.location.href = notification.action_url
                        }
                      }}
                    >
                      <div className="flex gap-3">
                        {/* Icône */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <TypeIcon className="w-4 h-4" />
                        </div>

                        {/* Contenu */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium truncate ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notification.title}
                            </p>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(notification.created_at)}
                            </span>
                            {notification.priority === 'urgent' && (
                              <span className="text-xs text-red-600 font-medium">Urgent</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <Link
              href="/admin/notifications"
              className="block text-center text-sm text-orange-600 hover:text-orange-800 font-medium"
              onClick={() => setIsOpen(false)}
            >
              Voir toutes les notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
