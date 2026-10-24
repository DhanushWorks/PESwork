import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { User, Role } from '../../types'
import { peopleService as mockPeopleService } from '../mock/peopleService'

export const supabasePeopleService = {
  async list(): Promise<User[]> {
    if (!isSupabaseConfigured) return mockPeopleService.list()

    try {
      const { data, error } = await supabase.from('profiles').select('*')
      if (error || !data || data.length === 0) {
        return mockPeopleService.list()
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
        avatar: p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        active: p.active,
        joinedDate: p.join_date,
      }))
    } catch {
      return mockPeopleService.list()
    }
  },

  async getById(id: string): Promise<User | null> {
    if (!isSupabaseConfigured) return mockPeopleService.getById(id)

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
      if (error || !data) {
        return mockPeopleService.getById(id)
      }

      return {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role as Role,
        department: data.department,
        designation: data.designation,
        managerId: data.manager_id,
        employeeCode: data.employee_code || `EMP-${Math.floor(100 + Math.random() * 900)}`,
        avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        active: data.active,
        joinedDate: data.join_date,
      }
    } catch {
      return mockPeopleService.getById(id)
    }
  },

  async getDirectReports(managerId: string): Promise<User[]> {
    if (!isSupabaseConfigured) return mockPeopleService.getDirectReports(managerId)

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('manager_id', managerId)
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
    } catch {
      return mockPeopleService.getDirectReports(managerId)
    }
  },

  async create(user: Omit<User, 'id'>): Promise<User> {
    return mockPeopleService.create(user)
  },

  async update(id: string, updates: Partial<User>): Promise<User> {
    if (!isSupabaseConfigured) return mockPeopleService.update(id, updates)

    const dbUpdates: any = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.designation !== undefined) dbUpdates.designation = updates.designation
    if (updates.department !== undefined) dbUpdates.department = updates.department
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar
    if (updates.active !== undefined) dbUpdates.active = updates.active

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      return mockPeopleService.update(id, updates)
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role as Role,
      department: data.department,
      designation: data.designation,
      managerId: data.manager_id,
      employeeCode: data.employee_code || `EMP-${Math.floor(100 + Math.random() * 900)}`,
      avatar: data.avatar,
      active: data.active,
      joinedDate: data.join_date,
    }
  },

  async toggleActive(id: string): Promise<User> {
    const current = await this.getById(id)
    if (!current) throw new Error(`User ${id} not found`)
    return this.update(id, { active: !current.active })
  },
}

