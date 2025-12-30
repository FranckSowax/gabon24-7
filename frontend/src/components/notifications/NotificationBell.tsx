'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  X,
  Trash2,
  ExternalLink,
  AlertCircle,
  TrendingUp,
  FileText,
  Mail,
  GraduationCap,
  Target,
  Briefcase,
  Users,
  Settings as SettingsIcon,
  Flame
} from 'lucide-react'
import { notificationService, Notification } from '@/lib/notificationService'
import { useAuth } from '@/contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function NotificationBell() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Charger les notifications
  const loadNotifications = async () => {
    if (!user?.id) return
    
    setLoading(true)
    const { data } = await notificationService.getNotifications(user.id, {
      limit: 20,
      unreadOnly: filter === 'unread'
    })
    setNotifications(data)
    setLoading(false)
  }

  // Charger le compteur
  const loadUnreadCount = async () => {
    if (!user?.id) return
    const count = await notificationService.getUnreadCount(user.id)
    setUnreadCount(count)
  }

  // Initialisation
  useEffect(() => {
    if (user?.id) {
      loadNotifications()
      loadUnreadCount()

      // S'abonner aux nouvelles notifications en temps réel
      const unsubscribe = notificationService.subscribeToNotifications(
        user.id,
        (newNotification) => {
          setNotifications(prev => {
            // Éviter les doublons
            if (prev.some(n => n.id === newNotification.id)) {
              return prev
            }
            
            // Si c'est vraiment une nouvelle notification, on met à jour le compteur et on joue le son
            // On utilise setTimeout pour sortir du cycle de rendu pur du setState
            setTimeout(() => {
              setUnreadCount(c => c + 1)
              playNotificationSound()
            }, 0)

            return [newNotification, ...prev]
          })
        }
      )

      return () => unsubscribe()
    }
  }, [user?.id, filter])

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Son de notification
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/sounds/notification.mp3')
      audio.volume = 0.3
      audio.play().catch(() => {}) // Ignorer les erreurs
    } catch (error) {}
  }

  // Marquer comme lu
  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user?.id) return

    await notificationService.markAsRead(notificationId, user.id)
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  // Marquer toutes comme lues
  const handleMarkAllAsRead = async () => {
    if (!user?.id) return

    await notificationService.markAllAsRead(user.id)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  // Supprimer une notification
  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    await notificationService.deleteNotification(notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    
    // Recharger le compteur
    loadUnreadCount()
  }

  // Cliquer sur une notification
  const handleNotificationClick = async (notification: Notification) => {
    // Marquer comme lue
    if (!notification.is_read && user?.id) {
      await notificationService.markAsRead(notification.id, user.id)
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    // Rediriger si URL d'action
    if (notification.action_url) {
      window.location.href = notification.action_url
    }
  }

  // Icône selon le type
  const getNotificationIcon = (notification: Notification) => {
    const iconClass = "w-4 h-4"
    
    switch (notification.type) {
      case 'alert_match':
        return <TrendingUp className={iconClass} />
      case 'document_generated':
      case 'letter_generated':
        return <FileText className={iconClass} />
      case 'training_generated':
        return <GraduationCap className={iconClass} />
      case 'skill_test_generated':
        return <Target className={iconClass} />
      case 'business_plan_ready':
      case 'action_plan_ready':
        return <Briefcase className={iconClass} />
      case 'project_shared':
        return <Users className={iconClass} />
      case 'admin_message':
        return <Mail className={iconClass} />
      default:
        return <AlertCircle className={iconClass} />
    }
  }

  // Couleur selon la catégorie
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'veille':
        return 'bg-blue-500'
      case 'ia':
        return 'bg-purple-500'
      case 'project':
        return 'bg-green-500'
      case 'admin':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  // Couleur selon la priorité
  const getPriorityBadge = (priority: string) => {
    if (priority === 'urgent') {
      return <Flame className="w-3 h-3 text-red-500 animate-pulse" />
    }
    if (priority === 'high') {
      return <span className="text-orange-500 text-xs">!</span>
    }
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton cloche */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-6 h-6 text-orange-500 animate-pulse" />
        ) : (
          <Bell className="w-6 h-6 text-gray-600" />
        )}
        
        {/* Badge compteur */}
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border-2 border-gray-200 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 text-white">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notifications
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filtres */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-white text-orange-600'
                      : 'bg-white bg-opacity-20 hover:bg-opacity-30'
                  }`}
                >
                  Toutes ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'unread'
                      ? 'bg-white text-orange-600'
                      : 'bg-white bg-opacity-20 hover:bg-opacity-30'
                  }`}
                >
                  Non lues ({unreadCount})
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="px-3 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
                    title="Tout marquer comme lu"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Liste des notifications */}
            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                  <p className="text-gray-500 text-sm mt-2">Chargement...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600 font-medium">Aucune notification</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Vous êtes à jour !
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        !notification.is_read ? 'bg-orange-50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icône */}
                        <div className={`w-10 h-10 rounded-xl ${getCategoryColor(notification.category)} flex items-center justify-center text-white flex-shrink-0`}>
                          {getNotificationIcon(notification)}
                        </div>

                        {/* Contenu */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-sm text-gray-900 leading-tight flex items-center gap-1">
                              {notification.title}
                              {getPriorityBadge(notification.priority)}
                            </h4>
                            {!notification.is_read && (
                              <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1"></span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-500">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: fr
                              })}
                            </span>
                            <div className="flex items-center gap-1">
                              {!notification.is_read && (
                                <button
                                  onClick={(e) => handleMarkAsRead(notification.id, e)}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                  title="Marquer comme lu"
                                >
                                  <Check className="w-3 h-3 text-gray-600" />
                                </button>
                              )}
                              <button
                                onClick={(e) => handleDelete(notification.id, e)}
                                className="p-1 hover:bg-red-100 rounded transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3 h-3 text-gray-600" />
                              </button>
                              {notification.action_url && (
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-200 p-3 bg-gray-50">
                <button
                  className="w-full text-center text-sm text-gray-600 hover:text-orange-600 font-medium transition-colors flex items-center justify-center gap-2"
                  onClick={() => {
                    setIsOpen(false)
                    // TODO: Rediriger vers la page des paramètres de notifications
                  }}
                >
                  <SettingsIcon className="w-4 h-4" />
                  Paramètres de notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
