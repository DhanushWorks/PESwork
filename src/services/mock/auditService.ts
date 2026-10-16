import { AuditLog } from '../../types'
import { storageService } from './storageService'

export const auditService = {
  async list(): Promise<AuditLog[]> {
    return [...storageService.getState().auditLogs]
  },

  async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const newLog: AuditLog = {
      ...entry,
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
    }

    storageService.updateState((state) => ({
      auditLogs: [newLog, ...state.auditLogs],
    }))

    return newLog
  },
}

