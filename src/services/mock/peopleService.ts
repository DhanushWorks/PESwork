import { User } from '../../types'
import { storageService } from './storageService'

export const peopleService = {
  async list(): Promise<User[]> {
    return [...storageService.getState().users]
  },

  async getById(id: string): Promise<User | null> {
    const user = storageService.getState().users.find((u) => u.id === id)
    return user ? { ...user } : null
  },

  async getDirectReports(managerId: string): Promise<User[]> {
    return storageService.getState().users.filter((u) => u.managerId === managerId)
  },

  async create(user: Omit<User, 'id'>): Promise<User> {
    const id = `u-custom-${Date.now()}`
    const newUser: User = { ...user, id }
    storageService.updateState((state) => ({
      users: [...state.users, newUser],
    }))
    return newUser
  },

  async update(id: string, updates: Partial<User>): Promise<User> {
    let updated: User | null = null
    storageService.updateState((state) => {
      const users = state.users.map((u) => {
        if (u.id === id) {
          updated = { ...u, ...updates }
          return updated
        }
        return u
      })
      return { users }
    })
    if (!updated) throw new Error(`User ${id} not found`)
    return updated
  },

  async toggleActive(id: string): Promise<User> {
    const current = await this.getById(id)
    if (!current) throw new Error(`User ${id} not found`)
    return this.update(id, { active: !current.active })
  },
}

