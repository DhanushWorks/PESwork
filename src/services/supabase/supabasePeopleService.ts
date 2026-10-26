import { supabase, isSupabaseReady, markSupabaseOffline } from '../../lib/supabase'
import { User, Role } from '../../types'
import { peopleService as mockPeopleService } from '../mock/peopleService'
import { storageService } from '../mock/storageService'
import { apiCache } from '../../lib/apiCache'
import { matchesUser, toDatabaseUserId } from '../../lib/workflow'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function getCloudProfileOverrides(): Promise<Map<string, any>> {
  const map = new Map<string, any>()
  if (!isSupabaseReady()) return map
  try {
    const { data } = await supabase
      .from('audit_logs')
      .select('entity_id, details, created_at')
      .eq('action', 'PROFILE_UPDATED')
      .order('created_at', { ascending: false })
      .limit(100)

    if (data && data.length > 0) {
      for (const log of data) {
        const entId = log.entity_id
        const email = (log.details?.email || '').toLowerCase()
        if (entId && !map.has(entId)) {
          map.set(entId, log.details)
        }
        if (email && !map.has(email)) {
          map.set(email, log.details)
        }
      }
    }
  } catch (e) {
    console.warn('Notice fetching cloud profile overrides:', e)
  }
  return map
}

export const supabasePeopleService = {
  async list(): Promise<User[]> {
    return apiCache.getOrFetch('people:list', async () => {
      if (!isSupabaseReady()) return mockPeopleService.list()

      try {
        const [profilesRes, cloudOverrides] = await Promise.all([
          supabase.from('profiles').select('*'),
          getCloudProfileOverrides(),
        ])
        const data = profilesRes.data
        if (profilesRes.error || !data || data.length === 0) {
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
          const localMatch = localList.find(
            (lu) => lu.id === p.id || matchesUser(lu.id, p.id) || lu.email.toLowerCase() === email.toLowerCase()
          )

          const cloudUpdate =
            cloudOverrides.get(p.id) ||
            cloudOverrides.get(email.toLowerCase()) ||
            (p.id === '11111111-1111-1111-1111-111111111101' ? cloudOverrides.get('u-emp-1') : undefined)

          const resolvedAvatar =
            cloudUpdate?.avatar ||
            localMatch?.avatar ||
            p.avatar ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'

          const resolvedName = cloudUpdate?.name || localMatch?.name || p.name
          const resolvedDesignation = cloudUpdate?.designation || localMatch?.designation || p.designation
          const resolvedDepartment = cloudUpdate?.department || localMatch?.department || p.department

          return {
            id: p.id,
            name: resolvedName,
            email,
            role,
            department: resolvedDepartment,
            designation: resolvedDesignation,
            managerId: p.manager_id,
            employeeCode: p.employee_code || localMatch?.employeeCode || `EMP-${Math.floor(100 + Math.random() * 900)}`,
            avatar: resolvedAvatar,
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

        // Sync fresh users into storageService
        try {
          storageService.updateState((state) => {
            const updatedUsers = [...state.users]
            for (const u of merged) {
              const idx = updatedUsers.findIndex((su) => su.id === u.id || matchesUser(su.id, u.id))
              if (idx >= 0) {
                updatedUsers[idx] = { ...updatedUsers[idx], ...u }
              } else {
                updatedUsers.push(u)
              }
            }
            return { users: updatedUsers }
          })
        } catch (e) {
          console.warn('Sync storage users notice', e)
        }

        return merged
      } catch (err) {
        markSupabaseOffline(err)
        return mockPeopleService.list()
      }
    }, 15000)
  },

  async getById(id: string): Promise<User | null> {
    return apiCache.getOrFetch(`people:user:${id}`, async () => {
      if (!isSupabaseReady()) return mockPeopleService.getById(id)

      try {
        let queryId = id
        if (id === 'u-admin') queryId = '11111111-1111-1111-1111-111111111103'
        else if (id === 'u-mgr-1') queryId = '11111111-1111-1111-1111-111111111102'
        else if (id === 'u-emp-1') queryId = '11111111-1111-1111-1111-111111111101'

        const [userRes, localUser, cloudOverrides] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', queryId).maybeSingle(),
          mockPeopleService.getById(id),
          getCloudProfileOverrides(),
        ])
        const data = userRes.data
        if (userRes.error || !data) {
          return localUser
        }

        const isEleanor =
          data.id === '11111111-1111-1111-1111-111111111103' ||
          data.name === 'Eleanor Vance' ||
          data.email === 'admin@performiq.internal'

        const email = isEleanor ? 'eleanor.vance@performiq.internal' : data.email
        const role = isEleanor ? 'admin' : (data.role as Role)

        const cloudUpdate =
          cloudOverrides.get(data.id) ||
          cloudOverrides.get(email.toLowerCase()) ||
          cloudOverrides.get(id)

        const resolvedAvatar =
          cloudUpdate?.avatar ||
          localUser?.avatar ||
          data.avatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'

        const resolvedName = cloudUpdate?.name || localUser?.name || data.name
        const resolvedDesignation = cloudUpdate?.designation || localUser?.designation || data.designation
        const resolvedDepartment = cloudUpdate?.department || localUser?.department || data.department

        return {
          id: data.id,
          name: resolvedName,
          email,
          role,
          department: resolvedDepartment,
          designation: resolvedDesignation,
          managerId: data.manager_id,
          employeeCode: data.employee_code || localUser?.employeeCode || `EMP-${Math.floor(100 + Math.random() * 900)}`,
          avatar: resolvedAvatar,
          active: data.active,
          joinedDate: data.join_date,
        }
      } catch (err) {
        markSupabaseOffline(err)
        return mockPeopleService.getById(id)
      }
    }, 15000)
  },

  async getDirectReports(managerId: string): Promise<User[]> {
    return apiCache.getOrFetch(`people:reports:${managerId}`, async () => {
      const localReports = await mockPeopleService.getDirectReports(managerId)
      const localList = await mockPeopleService.list()

      if (!isSupabaseReady()) return localReports

      try {
        let queryManagerId = managerId
        if (managerId === 'u-mgr-1') queryManagerId = '11111111-1111-1111-1111-111111111102'

        const [reportsRes, cloudOverrides] = await Promise.all([
          supabase.from('profiles').select('*').eq('manager_id', queryManagerId),
          getCloudProfileOverrides(),
        ])
        const data = reportsRes.data
        if (reportsRes.error || !data || data.length === 0) {
          return localReports
        }

        const dbReports: User[] = data.map((p) => {
          const localMatch = localList.find(
            (lu) => lu.id === p.id || matchesUser(lu.id, p.id) || (p.email && lu.email?.toLowerCase() === p.email.toLowerCase())
          )

          const cloudUpdate =
            cloudOverrides.get(p.id) ||
            cloudOverrides.get((p.email || '').toLowerCase()) ||
            (p.id === '11111111-1111-1111-1111-111111111101' ? cloudOverrides.get('u-emp-1') : undefined)

          const resolvedAvatar =
            cloudUpdate?.avatar ||
            localMatch?.avatar ||
            p.avatar ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'

          const resolvedName = cloudUpdate?.name || localMatch?.name || p.name
          const resolvedDesignation = cloudUpdate?.designation || localMatch?.designation || p.designation
          const resolvedDepartment = cloudUpdate?.department || localMatch?.department || p.department

          return {
            id: p.id,
            name: resolvedName,
            email: p.email,
            role: p.role as Role,
            department: resolvedDepartment,
            designation: resolvedDesignation,
            managerId: p.manager_id,
            employeeCode: localMatch?.employeeCode || p.employee_code || `EMP-${Math.floor(100 + Math.random() * 900)}`,
            avatar: resolvedAvatar,
            active: localMatch?.active !== undefined ? localMatch.active : p.active,
            joinedDate: localMatch?.joinedDate || p.join_date,
          }
        })

        const merged = [...dbReports]
        for (const lr of localReports) {
          if (!merged.some((r) => r.id === lr.id || matchesUser(r.id, lr.id))) {
            merged.push(lr)
          }
        }
        return merged
      } catch (err) {
        markSupabaseOffline(err)
        return localReports
      }
    }, 15000)
  },

  async create(user: Omit<User, 'id'>): Promise<User> {
    apiCache.invalidate('people:')
    apiCache.invalidate('reviews:')
    const mockCreated = await mockPeopleService.create(user)

    if (isSupabaseReady()) {
      try {
        // Prevent duplicate profiles: query Supabase if a profile with this email already exists
        const { data: existing } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', user.email)
          .limit(1)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('profiles')
            .update({
              name: user.name,
              role: user.role,
              department: user.department,
              designation: user.designation,
              employee_code: user.employeeCode || existing.employee_code,
              avatar: user.avatar || existing.avatar,
              active: user.active !== undefined ? user.active : existing.active,
            })
            .eq('id', existing.id)

          const existingUser: User = {
            ...mockCreated,
            id: existing.id,
            employeeCode: existing.employee_code || user.employeeCode,
          }
          storageService.updateState((state) => ({
            users: state.users.map((u) => (u.id === existing.id || u.id === mockCreated.id ? existingUser : u)),
          }))
          return existingUser
        }

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
          const syncedUser: User = {
            ...mockCreated,
            id: data.id,
          }
          storageService.updateState((state) => ({
            users: state.users.map((u) => (u.id === mockCreated.id ? syncedUser : u)),
          }))
          return syncedUser
        }
      } catch (err) {
        console.warn('Supabase create profile notice:', err)
      }
    }

    return mockCreated
  },

  async update(id: string, updates: Partial<User>): Promise<User> {
    apiCache.invalidate('people:')
    apiCache.invalidate('reviews:')
    apiCache.invalidate('calibration:')
    apiCache.invalidate('results:')
    apiCache.invalidate('goals:')

    // Always update mock / localStorage first so local state is immediately updated
    const localUpdated = await mockPeopleService.update(id, updates)

    const targetUuid = toDatabaseUserId(id)
    if (isSupabaseReady()) {
      try {
        const actorUuid = targetUuid && UUID_PATTERN.test(targetUuid) ? targetUuid : '11111111-1111-1111-1111-111111111101'

        // 1. Cross-device cloud sync: persist update to audit_logs
        await supabase.from('audit_logs').insert({
          tenant_id: '00000000-0000-0000-0000-000000000001',
          actor_id: actorUuid,
          action: 'PROFILE_UPDATED',
          entity: 'profiles',
          entity_id: targetUuid || id,
          details: {
            id,
            targetUuid,
            email: localUpdated.email,
            ...updates,
            updated_at: new Date().toISOString(),
          },
        })

        // 2. Also attempt direct profile table update if valid UUID
        if (targetUuid && UUID_PATTERN.test(targetUuid)) {
          const dbUpdates: any = {}
          if (updates.name !== undefined) dbUpdates.name = updates.name
          if (updates.designation !== undefined) dbUpdates.designation = updates.designation
          if (updates.department !== undefined) dbUpdates.department = updates.department
          if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar
          if (updates.active !== undefined) dbUpdates.active = updates.active

          await supabase.from('profiles').update(dbUpdates).eq('id', targetUuid)
        }
      } catch (err) {
        console.warn('Notice updating profile in Supabase:', err)
      }
    }

    storageService.updateState((state) => ({
      users: state.users.map((u) => (u.id === id || matchesUser(u.id, id) ? { ...u, ...updates } : u)),
    }))

    return localUpdated
  },

  async toggleActive(id: string): Promise<User> {
    apiCache.invalidate('people:')
    apiCache.invalidate('reviews:')
    const current = await this.getById(id)
    if (!current) throw new Error(`User ${id} not found`)
    return this.update(id, { active: !current.active })
  },
}
