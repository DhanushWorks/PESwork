import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { AuditLog } from '../../types'
import { auditService as mockAuditService } from '../mock/auditService'
import { storageService } from '../mock/storageService'

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

export const supabaseAuditService = {
  /**
   * List recent immutable administrative and evaluation audit logs
   */
  async list(): Promise<AuditLog[]> {
    if (!isSupabaseConfigured) return mockAuditService.list()

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, profiles:actor_id(name)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error || !data || data.length === 0) {
        return mockAuditService.list()
      }

      const mapped: AuditLog[] = data.map((d: any) => {
        let detailsStr = ''
        if (typeof d.details === 'string') {
          detailsStr = d.details
        } else if (d.details && typeof d.details === 'object') {
          detailsStr = d.details.note || d.details.reason || JSON.stringify(d.details)
        }

        return {
          id: d.id,
          actorId: d.actor_id || '',
          actorName: d.profiles?.name || 'System / Admin',
          action: d.action,
          entity: d.entity,
          entityId: d.entity_id || '',
          timestamp: d.created_at,
          details: detailsStr || `${d.action} on ${d.entity}`,
        }
      })

      // Combine with local mock logs so recent actions are immediately visible
      const mockList = await mockAuditService.list()
      const existingIds = new Set(mapped.map((m) => m.id))
      const combined = [...mapped, ...mockList.filter((m) => !existingIds.has(m.id))]

      return combined.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    } catch {
      return mockAuditService.list()
    }
  },

  /**
   * Append an immutable audit event
   */
  async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const mockCreated = await mockAuditService.log(entry)

    if (isSupabaseConfigured) {
      try {
        const tenantId = await getTenantId(entry.actorId)
        await supabase.from('audit_logs').insert({
          tenant_id: tenantId,
          actor_id: entry.actorId && entry.actorId.length > 10 ? entry.actorId : null,
          action: entry.action,
          entity: entry.entity,
          details: {
            actor_name: entry.actorName,
            note: entry.details,
          },
        })
      } catch (err) {
        console.warn('Notice logging to Supabase audit_logs:', err)
      }
    }

    return mockCreated
  },
}

export { supabaseAuditService as auditService }

