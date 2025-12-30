import { supabase } from './supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface Notification {
  id: string
  user_id: string
  type: string
  category: 'veille' | 'ia' | 'project' | 'system' | 'admin'
  title: string
  message: string
  metadata?: Record<string, any>
  action_url?: string
  action_label?: string
  reference_type?: string
  reference_id?: string
  is_read: boolean
  is_archived: boolean
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_at: string
  read_at?: string
  archived_at?: string
  expires_at?: string
}

export interface NotificationPreferences {
  id: string
  user_id: string
  email_enabled: boolean
  push_enabled: boolean
  in_app_enabled: boolean
  preferences: Record<string, any>
  quiet_hours_start?: string
  quiet_hours_end?: string
  digest_frequency: 'none' | 'daily' | 'weekly'
  created_at: string
  updated_at: string
}

class NotificationService {
  private channel: RealtimeChannel | null = null
  private listeners: Set<(notification: Notification) => void> = new Set()

  /**
   * Récupérer les notifications de l'utilisateur
   */
  async getNotifications(userId: string, options?: {
    limit?: number
    offset?: number
    unreadOnly?: boolean
    category?: string
  }): Promise<{ data: Notification[], count: number }> {
    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (options?.unreadOnly) {
        query = query.eq('is_read', false)
      }

      if (options?.category) {
        query = query.eq('category', options.category)
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
      }

      const { data, error, count } = await query

      if (error) throw error

      return { data: data || [], count: count || 0 }
    } catch (error) {
      console.error('Error fetching notifications:', error)
      return { data: [], count: 0 }
    }
  }

  /**
   * Obtenir le nombre de notifications non lues
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('get_unread_count', { uid: userId })

      if (error) throw error
      return data || 0
    } catch (error) {
      console.error('Error getting unread count:', error)
      return 0
    }
  }

  /**
   * Marquer une notification comme lue
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('mark_notification_as_read', { 
          notification_id: notificationId,
          uid: userId 
        })

      if (error) throw error
      return data || false
    } catch (error) {
      console.error('Error marking notification as read:', error)
      return false
    }
  }

  /**
   * Marquer toutes les notifications comme lues
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('mark_all_notifications_as_read', { uid: userId })

      if (error) throw error
      return data || 0
    } catch (error) {
      console.error('Error marking all as read:', error)
      return 0
    }
  }

  /**
   * Archiver une notification
   */
  async archiveNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq('id', notificationId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error archiving notification:', error)
      return false
    }
  }

  /**
   * Supprimer une notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting notification:', error)
      return false
    }
  }

  /**
   * Créer une notification
   */
  async createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'is_read' | 'is_archived'>): Promise<Notification | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          ...notification,
          is_read: false,
          is_archived: false
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating notification:', error)
      return null
    }
  }

  /**
   * S'abonner aux notifications en temps réel
   */
  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    this.listeners.add(callback)

    if (!this.channel) {
      this.channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload: any) => {
            const notification = payload.new as Notification
            this.listeners.forEach(listener => listener(notification))
          }
        )
        .subscribe((status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime notifications connected')
          }
          if (status === 'CHANNEL_ERROR') {
            console.error('❌ Realtime notifications connection error')
          }
          if (status === 'TIMED_OUT') {
            console.warn('⚠️ Realtime notifications connection timed out')
          }
        })
    }

    return () => {
      this.listeners.delete(callback)
      if (this.listeners.size === 0 && this.channel) {
        this.channel.unsubscribe()
        this.channel = null
      }
    }
  }

  /**
   * Récupérer les préférences de notification
   */
  async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching preferences:', error)
      return null
    }
  }

  /**
   * Mettre à jour les préférences
   */
  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({
          ...preferences,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating preferences:', error)
      return false
    }
  }
}

export const notificationService = new NotificationService()
