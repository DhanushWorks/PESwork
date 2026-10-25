import { supabase, isSupabaseConfigured, isSupabaseReady, markSupabaseOffline } from '../../lib/supabase'
import { Notification } from '../../types'
import { mockNotificationService } from '../mock/notificationService'

export const supabaseNotificationService = {
  async list(userId: string): Promise<Notification[]> {
    if (!isSupabaseReady()) {
      return mockNotificationService.list(userId)
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error || !data) {
        return mockNotificationService.list(userId)
      }

      // Map Supabase snake_case columns to camelCase Notification model
      const mapped: Notification[] = data.map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        title: n.title,
        message: n.message,
        link: n.link || '',
        read: Boolean(n.read),
        createdAt: n.created_at,
        type: n.type || 'info',
      }))

      // Merge with any in-memory mock notifications to ensure seamless local continuity
      const mockList = await mockNotificationService.list(userId)
      const ids = new Set(mapped.map((m) => m.id))
      const extra = mockList.filter((m) => !ids.has(m.id))

      return [...mapped, ...extra].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } catch (err) {
      markSupabaseOffline(err)
      return mockNotificationService.list(userId)
    }
  },

  async create(data: {
    id?: string
    userId: string
    title: string
    message: string
    link: string
    type?: 'action' | 'info' | 'success' | 'warning'
  }): Promise<Notification> {
    // 1. Always create in mockNotificationService (storageService) for instantaneous in-app UI updates
    const mockCreated = await mockNotificationService.create(data)

    // 2. Persist to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single()
        const tenantId = tenant?.id || '00000000-0000-0000-0000-000000000001'

        const payload: any = {
          user_id: data.userId,
          tenant_id: tenantId,
          title: data.title,
          message: data.message,
          link: data.link,
          type: data.type || 'info',
          read: false,
        }

        const { data: inserted, error } = await supabase
          .from('notifications')
          .insert(payload)
          .select()
          .single()

        if (error) {
          console.warn('Notice persisting notification to Supabase:', error.message)
        } else if (inserted) {
          return {
            id: inserted.id,
            userId: inserted.user_id,
            title: inserted.title,
            message: inserted.message,
            link: inserted.link || '',
            read: Boolean(inserted.read),
            createdAt: inserted.created_at,
            type: inserted.type || 'info',
          }
        }
      } catch (err: any) {
        console.warn('Supabase notification insertion error:', err.message)
      }
    }

    return mockCreated
  },

  async markRead(id: string): Promise<void> {
    await mockNotificationService.markRead(id)

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', id)

        if (error) {
          console.warn('Supabase markRead notice:', error.message)
        }
      } catch (err: any) {
        console.warn('Supabase markRead error:', err.message)
      }
    }
  },

  async markAllRead(userId: string): Promise<void> {
    await mockNotificationService.markAllRead(userId)

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId)

        if (error) {
          console.warn('Supabase markAllRead notice:', error.message)
        }
      } catch (err: any) {
        console.warn('Supabase markAllRead error:', err.message)
      }
    }
  },

  async delete(id: string): Promise<void> {
    await mockNotificationService.delete(id)

    if (isSupabaseConfigured) {
      try {
        await supabase.from('notifications').delete().eq('id', id)
      } catch (err: any) {
        console.warn('Supabase delete notification error:', err.message)
      }
    }
  },

  /**
   * Realtime Supabase subscription helper to listen for new notifications
   */
  subscribeToUserNotifications(userId: string, onUpdate: () => void): () => void {
    if (!isSupabaseConfigured) return () => {}

    try {
      const channel = supabase
        .channel(`user-notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            onUpdate()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch {
      return () => {}
    }
  },
}

