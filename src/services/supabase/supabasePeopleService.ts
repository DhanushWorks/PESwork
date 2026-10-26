import { supabase, isSupabaseReady, markSupabaseOffline } from '../../lib/supabase'
import { User, Role } from '../../types'
import { peopleService as mockPeopleService } from '../mock/peopleService'
import { apiCache } from '../../lib/apiCache'
import { matchesUser, toDatabaseUserId } from '../../lib/workflow'

export const supabasePeopleService = {
  async list(): Promise<User[]> {
    return apiCache.getOrFetch('people:list', async () => {
      if (!isSupabaseReady()) return mockPeopleService.list()

      try {
        const { data, error } = await supabase.from('profiles').select('*')
        if (error || !data || data.length === 0) {
          return mockPeopleService.list()
        }

        const localList = await mockPeopleService.list()

        const dbUsers: User[] = data.map((p) => {
          const isEleanor =
            p.id === '11111111-1111-1111-1111-111111111103' ||
            p.name === 'Eleanor Vance' ||
            p.email === 'admin@performiq.internal'

          const email = isEleanor ? 'eleanor.vance@performiq.internal' : p.email
          const role = isEleanor ? 'admin' : (p.role as Role)
          const localMatch = localList.find((lu) => lu.id === p.id || matchesUser(lu.id, p.id) || lu.email.toLowerCase() === email.toLowerCase())

          return {
            id: p.id,
            name: localMatch?.name || p.name,
            email,
            role,
            department: localMatch?.department || p.department,
            designation: localMatch?.designation || p.designation,
            managerId: p.manager_id,
            employeeCode: p.employee_code || `EMP-${Math.floor(100 + Math.random() * 900)}`,
            avatar: localMatch?.avatar || p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            active: p.active,
            joinedDate: p.join_date,
          }
        })

        const merged = [...dbUsers]
        for (const lu of localList) {
          if (!merged.some((u) => u.id === lu.id || matchesUser(u.id, lu.id) || u.email.toLowerCase() === lu.email.toLowerCase())) {
            merged.push(lu)
          }
        }
        return merged
      } catch (err) {
        markSupabaseOffline(err)
        return mockPeopleService.list()
      }
    }, 60000)
  },

  async getById(id: string): Promise<User | null> {
    return apiCache.getOrFetch(`people:user:${id}`, async () => {
      if (!isSupabaseReady()) return mockPeopleService.getById(id)

      try {
        let queryId = id
        if (id === 'u-admin') queryId = '11111111-1111-1111-1111-111111111103'
        else if (id === 'u-mgr-1') queryId = '11111111-1111-1111-1111-111111111102'
        else if (id === 'u-emp-1') queryId = '11111111-1111-1111-1111-111111111101'

        const localUser = await mockPeopleService.getById(id)
        const { data, error } = await supabase.from('profiles').select('*').eq('id', queryId).single()
        if (error || !data) {
          return localUser
        }

        const isEleanor =
          data.id === '11111111-1111-1111-1111-111111111103' ||
          data.name === 'Eleanor Vance' ||
          data.email === 'admin@performiq.internal'

        const email = isEleanor ? 'eleanor.vance@performiq.internal' : data.email
        const role = isEleanor ? 'admin' : (data.role as Role)

        return {
          id: data.id,
          name: localUser?.name || data.name,
          email,
          role,
          department: localUser?.department || data.department,
          designation: localUser?.designation || data.designation,
          managerId: data.manager_id,
          employeeCode: data.employee_code || `EMP-${Math.floor(100 + Math.random() * 900)}`,
          avatar: localUser?.avatar || data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          active: data.active,
          joinedDate: data.join_date,
        }
      } catch (err) {
        markSupabaseOffline(err)
        return mockPeopleService.getById(id)
      }
    }, 60000)
  },

  async getDirectReports(managerId: string): Promise<User[]> {
    return apiCache.getOrFetch(`people:reports:${managerId}`, async () => {
      if (!isSupabaseReady()) return mockPeopleService.getDirectReports(managerId)

      try {
        let queryManagerId = managerId
        if (managerId === 'u-mgr-1') queryManagerId = '11111111-1111-1111-1111-111111111102'

        const { data, error } = await supabase.from('profiles').select('*').eq('manager_id', queryManagerId)
        if (error || !data || data.length === 0) {
          return mockPeopleService.getDirectReports(managerId)
        }

        return data.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role: p.role as Role,
          department: p.department,
          designation: p.designation,
          managerId: p.manager_id,
          employeeCode: p.employee_code || `EMP-${Math.floor(100 + Math.random() * 900)}`,
          avatar: p.avatar,
          active: p.active,
          joinedDate: p.join_date,
        }))
      } catch (err) {
        markSupabaseOffline(err)
        return mockPeopleService.getDirectReports(managerId)
      }
    }, 60000)
  },

  async create(user: Omit<User, 'id'>): Promise<User> {
    apiCache.invalidate('people:')
    const mockCreated = await mockPeopleService.create(user)

    if (isSupabaseReady()) {
      try {
        const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single()
        const tenantId = tenant?.id || '00000000-0000-0000-0000-000000000001'

        const { data, error } = await supabase
          .from('profiles')
          .insert({
            tenant_id: tenantId,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            designation: user.designation,
            employee_code: user.employeeCode,
            avatar: user.avatar,
            active: user.active !== undefined ? user.active : true,
            join_date: user.joinedDate || new Date().toISOString().split('T')[0],
          })
          .select()
          .single()

        if (!error && data) {
          return {
            ...mockCreated,
            id: data.id,
          }
        }
      } catch (err) {
        console.warn('Supabase create profile notice:', err)
      }
    }

    return mockCreated
  },

  async update(id: string, updates: Partial<User>): Promise<User> {
    apiCache.invalidate('people:')

    // Always update mock / localStorage first so local state is immediately updated
    const localUpdated = await mockPeopleService.update(id, updates)

    const targetUuid = toDatabaseUserId(id)
    if (isSupabaseReady() && targetUuid) {
      try {
        const dbUpdates: any = {}
        if (updates.name !== undefined) dbUpdates.name = updates.name
        if (updates.designation !== undefined) dbUpdates.designation = updates.designation
        if (updates.department !== undefined) dbUpdates.department = updates.department
        if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar
        if (updates.active !== undefined) dbUpdates.active = updates.active

        await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('id', targetUuid)
      } catch (err) {
        console.warn('Notice updating profile in Supabase:', err)
      }
    }

    return localUpdated
  },

  async toggleActive(id: string): Promise<User> {
    const current = await this.getById(id)
    if (!current) throw new Error(`User ${id} not found`)
    return this.update(id, { active: !current.active })
  },
}
