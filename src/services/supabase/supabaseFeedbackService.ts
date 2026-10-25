import { supabase, isSupabaseConfigured, isSupabaseReady, markSupabaseOffline } from '../../lib/supabase'
import { FeedbackItem } from '../../types'
import { feedbackService as mockFeedbackService } from '../mock/feedbackService'
import { supabaseNotificationService as notificationService } from './supabaseNotificationService'
import { supabasePeopleService as peopleService } from './supabasePeopleService'

async function getTenantId(userId?: string): Promise<string> {
  if (!isSupabaseConfigured) return '00000000-0000-0000-0000-000000000001'
  try {
    if (userId) {
      const { data } = await supabase.from('profiles').select('tenant_id').eq('id', userId).maybeSingle()
      if (data?.tenant_id) return data.tenant_id
    }
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).maybeSingle()
    return tenant?.id || '00000000-0000-0000-0000-000000000001'
  } catch {
    return '00000000-0000-0000-0000-000000000001'
  }
}

export const supabaseFeedbackService = {
  /**
   * List feedback items received and sent by a user
   */
  async listForUser(userId: string): Promise<{ received: FeedbackItem[]; sent: FeedbackItem[] }> {
    if (!isSupabaseReady()) return mockFeedbackService.listForUser(userId)

    try {
      const [recRes, sentRes] = await Promise.all([
        supabase
          .from('feedback')
          .select('*')
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('feedback')
          .select('*')
          .eq('sender_id', userId)
          .order('created_at', { ascending: false }),
      ])

      if ((recRes.error || !recRes.data) && (sentRes.error || !sentRes.data)) {
        return mockFeedbackService.listForUser(userId)
      }

      const mapRow = (r: any): FeedbackItem => ({
        id: r.id,
        fromUserId: r.sender_id,
        toUserId: r.recipient_id,
        type: r.type === 'praise' ? 'kudos' : 'constructive',
        competency: (r.tags && r.tags[0]) || 'Core Values & Team Impact',
        message: r.content || '',
        createdAt: r.created_at,
        isPublic: !r.is_private,
      })

      const received = (recRes.data || []).map(mapRow)
      const sent = (sentRes.data || []).map(mapRow)

      // Fall back to mock if both are empty to guarantee demo/seed continuity
      if (received.length === 0 && sent.length === 0) {
        return mockFeedbackService.listForUser(userId)
      }

      return { received, sent }
    } catch (err) {
      markSupabaseOffline(err)
      console.warn('Notice in supabaseFeedbackService.listForUser:', err)
      return mockFeedbackService.listForUser(userId)
    }
  },

  /**
   * Submit peer feedback (kudos or constructive coaching)
   */
  async giveFeedback(data: Omit<FeedbackItem, 'id' | 'createdAt'>): Promise<FeedbackItem> {
    const mockCreated = await mockFeedbackService.giveFeedback(data)

    if (isSupabaseConfigured) {
      try {
        const tenantId = await getTenantId(data.fromUserId)
        const dbType = data.type === 'kudos' ? 'praise' : 'constructive'

        const { data: inserted, error } = await supabase
          .from('feedback')
          .insert({
            tenant_id: tenantId,
            sender_id: data.fromUserId,
            recipient_id: data.toUserId,
            type: dbType,
            content: data.message,
            tags: data.competency ? [data.competency] : [],
            is_private: !data.isPublic,
          })
          .select()
          .single()

        // Send notification to recipient
        const sender = await peopleService.getById(data.fromUserId)
        await notificationService.create({
          userId: data.toUserId,
          title: data.type === 'kudos' ? 'New Peer Kudos' : 'New Constructive Feedback',
          message: `${sender?.name || 'A colleague'} shared feedback regarding "${data.competency}".`,
          link: '/employee/feedback',
          type: 'info',
        })

        if (!error && inserted) {
          return {
            id: inserted.id,
            fromUserId: inserted.sender_id,
            toUserId: inserted.recipient_id,
            type: inserted.type === 'praise' ? 'kudos' : 'constructive',
            competency: (inserted.tags && inserted.tags[0]) || data.competency,
            message: inserted.content,
            createdAt: inserted.created_at,
            isPublic: !inserted.is_private,
          }
        }
      } catch (err) {
        console.warn('Notice in supabaseFeedbackService.giveFeedback:', err)
      }
    }

    return mockCreated
  },
}

export { supabaseFeedbackService as feedbackService }
