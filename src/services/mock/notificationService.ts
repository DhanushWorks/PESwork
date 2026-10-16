import { Notification } from '../../types'
import { storageService } from './storageService'

export const notificationService = {
  async list(userId: string): Promise<Notification[]> {
    return storageService
      .getState()
      .notifications.filter((n) => n.userId === userId)
      .map((n) => ({ ...n }))
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
}

