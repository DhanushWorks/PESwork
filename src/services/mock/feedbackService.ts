import { FeedbackItem } from '../../types'
import { storageService } from './storageService'

export const feedbackService = {
  async listForUser(userId: string): Promise<{ received: FeedbackItem[]; sent: FeedbackItem[] }> {
    const { feedback } = storageService.getState()
    return {
      received: feedback.filter((f) => f.toUserId === userId),
      sent: feedback.filter((f) => f.fromUserId === userId),
    }
  },

  async giveFeedback(data: Omit<FeedbackItem, 'id' | 'createdAt'>): Promise<FeedbackItem> {
    const newItem: FeedbackItem = {
      ...data,
      id: `fb-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }

    storageService.updateState((state) => {
      // Create notification for recipient
      const sender = state.users.find((u) => u.id === data.fromUserId)
      const notif = {
        id: `notif-fb-${Date.now()}`,
        userId: data.toUserId,
        title: data.type === 'kudos' ? 'New Peer Kudos' : 'New Constructive Feedback',
        message: `${sender?.name || 'A colleague'} shared feedback regarding "${data.competency}".`,
        link: '/employee/feedback',
        read: false,
        createdAt: new Date().toISOString(),
        type: 'info' as const,
      }

      return {
        feedback: [newItem, ...state.feedback],
        notifications: [notif, ...state.notifications],
      }
    })

    return newItem
  },
}

