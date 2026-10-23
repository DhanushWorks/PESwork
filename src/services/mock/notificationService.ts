import { Notification } from '../../types'
import { storageService } from './storageService'

export const mockNotificationService = {
  async list(userId: string): Promise<Notification[]> {
    return storageService
      .getState()
      .notifications.filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((n) => ({ ...n }))
  },

  async create(data: {
    id?: string
    userId: string
    title: string
    message: string
    link: string
    type?: 'action' | 'info' | 'success' | 'warning'
  }): Promise<Notification> {
    const state = storageService.getState()
    const now = new Date().toISOString()
    const notifId =
      data.id ||
      `notif-${data.userId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    // Prevent duplicate notifications from repeated clicks, retries, or React re-renders
    const existing = state.notifications.find(
      (n) =>
        n.id === notifId ||
        (n.userId === data.userId &&
          n.title === data.title &&
          n.link === data.link &&
          !n.read &&
          Math.abs(new Date(now).getTime() - new Date(n.createdAt).getTime()) < 15000)
    )

    if (existing) {
      return existing
    }

    const newNotification: Notification = {
      id: notifId,
      userId: data.userId,
      title: data.title,
      message: data.message,
      link: data.link,
      read: false,
      createdAt: now,
      type: data.type || 'info',
    }

    storageService.updateState((s) => ({
      notifications: [newNotification, ...s.notifications],
    }))

    return newNotification
  },

  async markRead(id: string): Promise<void> {
    storageService.updateState((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }))
  },

  async markAllRead(userId: string): Promise<void> {
    storageService.updateState((state) => ({
      notifications: state.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)),
    }))
  },

  async delete(id: string): Promise<void> {
    storageService.updateState((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },
}

// Export as notificationService for mock exports
export const notificationService = mockNotificationService
