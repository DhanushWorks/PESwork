import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { peopleService } from '../../services'
import { Role, User } from '../../types'
import { RoleBadge } from '../../components/ui/Badge'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { formatDate } from '../../lib/formatters'
import { AnimatedSearchBar } from '../../components/ui/AnimatedSearchBar'
import { CustomDropdown } from '../../components/ui/CustomDropdown'
import { AvatarGroup } from '../../components/ui/AvatarGroup'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { InstaProfileModal } from '../../components/ui/InstaProfileModal'
import {
  Building,
  Edit2,
  Filter,
  LayoutGrid,
  List,
  Mail,
  Plus,
  Search,
  Sparkles,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react'

// Deterministic clean neutral palette for initials
function getInitialsColor(name: string): string {
  const colors = [
    'bg-zinc-800 text-zinc-200 border-zinc-700',
    'bg-neutral-800 text-neutral-200 border-neutral-700',
    'bg-stone-800 text-stone-200 border-stone-700',
    'bg-slate-800 text-slate-200 border-slate-700',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const AdminUsers: React.FC = () => {
  const { allUsers, refreshData } = useApp()
  const { success, error } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [selectedInstaUser, setSelectedInstaUser] = useState<User | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [department, setDepartment] = useState('Engineering')
  const [designation, setDesignation] = useState('')
  const [managerId, setManagerId] = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const list = await peopleService.list()
      setUsers(list)
    } catch (err) {
      console.warn('Notice loading users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    fetchUsers().finally(() => {
      clearTimeout(safetyTimer)
    })

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
    }
  }, [])

  const openCreateModal = () => {
    setEditingUser(null)
    setName('')
    setEmail('')
    setRole('employee')
    setDepartment('Engineering')
    setDesignation('')
    setManagerId('u-mgr-1')
    setShowModal(true)
  }

  const openEditModal = (u: User) => {
    setEditingUser(u)
    setName(u.name)
    setEmail(u.email)
    setRole(u.role)
    setDepartment(u.department)
    setDesignation(u.designation)
    setManagerId(u.managerId || '')
    setShowModal(true)
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      error('Fields required', 'Name and corporate email are required.')
      return
    }

    try {
      if (editingUser) {
        await peopleService.update(editingUser.id, {
          name,
          email,
          role,
          department,
          designation,
          managerId: managerId || undefined,
        })
        success('User updated', `${name}'s account details have been saved.`)
      } else {
        await peopleService.create({
          name,
          email,
          role,
          department,
          designation,
          managerId: managerId || undefined,
          employeeCode: `EMP-0${Math.floor(Math.random() * 90 + 10)}`,
          active: true,
          joinedDate: new Date().toISOString().split('T')[0],
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        })
        success('User created', `${name} was added to the sample user directory.`)
      }

      setShowModal(false)
      await refreshData()
      fetchUsers()
    } catch (err: any) {
      error('Failed to save user', err.message)
    }
  }

  const handleToggleActive = async (u: User) => {
    try {
      const updated = await peopleService.toggleActive(u.id)
      success(
        updated.active ? 'Account Activated' : 'Account Deactivated',
        `${u.name} is now ${updated.active ? 'active' : 'inactive'}.`
      )
      await refreshData()
      fetchUsers()
    } catch (err: any) {
      error('Toggle failed', err.message)
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
      u.designation.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' ? true : u.role === roleFilter
    const matchDept = deptFilter === 'all' ? true : u.department === deptFilter
    return matchSearch && matchRole && matchDept
  })

  const managersList = users.filter((u) => u.role === 'manager' || u.role === 'admin')

  return (
    <div className="space-y-4 w-full pb-3 font-sans">
      {/* Executive Talent Cohort Showcase Banner */}
      <div className="rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Live Interactive Avatar Group with tooltips */}
            <div className="p-1.5 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] shadow-2xs">
              <AvatarGroup users={users} max={7} size="lg" onUserClick={(u) => setSelectedInstaUser(u)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {users.length} Total Enterprise Personnel
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs font-sans">
                <span className="inline-flex items-center px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.08] text-[11px]">
                  Engineering: <strong className="text-slate-900 dark:text-white font-semibold">{users.filter((u) => u.department === 'Engineering').length}</strong>
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.08] text-[11px]">
                  Product: <strong className="text-slate-900 dark:text-white font-semibold">{users.filter((u) => u.department === 'Product & Design').length}</strong>
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.08] text-[11px]">
                  Managers: <strong className="text-slate-900 dark:text-white font-semibold">{users.filter((u) => u.role === 'manager' || u.role === 'admin').length}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-center flex-wrap">
            {/* View Mode Switcher Capsule */}
            <RubberSegmentedControl
              options={[
                { value: 'grid', label: 'Executive Cards', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
                { value: 'table', label: 'Table View', icon: <List className="w-3.5 h-3.5" /> },
              ]}
              value={viewMode}
              onChange={(val) => setViewMode(val as 'grid' | 'table')}
              size="sm"
            />

            <button
              type="button"
              onClick={openCreateModal}
              className="h-8.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-zinc-900 font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all border border-transparent shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Employee</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters Single-Line Bar (No Card Wrapper: Segment on Left, Search & Dropdown on Right) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
        {/* Left: Role Filter Segmented Control */}
        <div className="overflow-x-auto scrollbar-none py-0.5 shrink-0">
          <RubberSegmentedControl
            options={[
              { value: 'all', label: 'All Roles', count: users.length },
              {
                value: 'employee',
                label: 'Employees',
                count: users.filter((u) => u.role === 'employee').length,
              },
              {
                value: 'manager',
                label: 'Managers',
                count: users.filter((u) => u.role === 'manager').length,
              },
              {
                value: 'admin',
                label: 'Admins',
                count: users.filter((u) => u.role === 'admin').length,
              },
            ]}
            value={roleFilter}
            onChange={setRoleFilter}
            size="sm"
          />
        </div>

        {/* Right: Search Input & Department Dropdown */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto sm:justify-end min-w-0">
          {/* Compact Search Input */}
          <div className="relative flex-1 sm:flex-initial sm:w-52 md:w-60 min-w-0 flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 absolute left-3 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personnel..."
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-400 dark:focus:border-zinc-600 focus:ring-1 focus:ring-slate-300 dark:focus:ring-zinc-700 transition-all font-sans shadow-2xs"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2.5 pointer-events-none px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-800 text-[10px] font-mono text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-900 hidden sm:inline-block">
                /
              </kbd>
            )}
          </div>

          {/* Department Filter Dropdown */}
          <div className="shrink-0">
            <CustomDropdown
              value={deptFilter}
              onChange={setDeptFilter}
              align="right"
              triggerClassName="h-9 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs font-semibold shadow-2xs"
              options={[
                { value: 'all', label: 'All Departments' },
                { value: 'Engineering', label: 'Engineering' },
                { value: 'Product & Design', label: 'Product & Design' },
                { value: 'People Operations', label: 'People Operations' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Directory Content: Grid Cards View vs Table View */}
      {viewMode === 'grid' ? (
        loading ? (
          <LoadingState message="Loading talent directory..." variant="card" />
        ) : filteredUsers.length === 0 ? (
          <div className="dark-glass-card p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
            <div className="text-sm font-bold text-slate-800 dark:text-zinc-200">No personnel found</div>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 font-sans">Try adjusting your search criteria or role filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((u) => {
              const manager = users.find((m) => m.id === u.managerId)
              const initials = getInitials(u.name)
              const colorClass = getInitialsColor(u.name)

              return (
                <div
                  key={u.id}
                  className="group relative rounded-2xl dark-glass-card dark-glass-card-lift p-5 transition-all duration-200 flex flex-col justify-between cursor-pointer hover:border-slate-300 dark:hover:border-white/20"
                >
                  <div className="space-y-4">
                    {/* Top row: Code badge + RoleBadge + Status Dot */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-zinc-300 border border-slate-200/70 dark:border-white/[0.08]">
                        {u.employeeCode}
                      </span>
                      <div className="flex items-center gap-2">
                        <RoleBadge role={u.role} />
                      </div>
                    </div>

                    {/* Employee Profile Identity */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className="relative shrink-0 cursor-pointer group/avatar"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedInstaUser(u)
                        }}
                        title="Touch to view Instagram-style profile"
                      >
                        {/* Instagram Story Gradient Ring */}
                        <div className="p-[2.5px] rounded-[18px] bg-gradient-to-tr from-[#f09433] via-[#dc2743] via-[#cc2366] to-[#bc1888] shadow-xs group-hover/avatar:shadow-[0_0_18px_rgba(220,39,67,0.45)] group-hover/avatar:scale-105 active:scale-95 transition-all duration-200">
                          <div className="p-[2px] bg-white dark:bg-[#18181b] rounded-[15px]">
                            {u.avatar ? (
                              <img
                                src={u.avatar}
                                alt={u.name}
                                className="w-12 h-12 rounded-[13px] object-cover"
                              />
                            ) : (
                              <div
                                className={`w-12 h-12 rounded-[13px] ${colorClass} flex items-center justify-center font-bold text-sm select-none`}
                              >
                                {initials}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate">
                          {u.name}
                        </h3>
                        <p className="text-xs font-medium text-slate-600 dark:text-zinc-300 truncate mt-0.5 font-sans">
                          {u.designation}
                        </p>
                        <div className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                          <Building className="w-3 h-3 text-[#8B7CFF] shrink-0" />
                          <span className="truncate">{u.department}</span>
                        </div>
                      </div>
                    </div>

                    {/* Reporting Line & Contact */}
                    <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] space-y-1.5 text-[11px] font-sans">
                      <div className="flex items-center justify-between text-slate-500 dark:text-zinc-300">
                        <span>Reports to</span>
                        <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[130px]">
                          {manager ? manager.name : '— (Executive)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-300 truncate pt-1 border-t border-slate-100 dark:border-white/[0.06]">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs font-sans">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(u)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                        u.active
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent hover:bg-slate-800'
                          : 'bg-slate-100 dark:bg-zinc-850 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-slate-200'
                      }`}
                    >
                      {u.active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      <span>{u.active ? 'Active' : 'Inactive'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-700 dark:text-[#E6E9F2] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.1] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3 text-[#8B7CFF]" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* Users Table View */
        <div className="dark-glass-card overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.12] text-slate-900 dark:text-white uppercase tracking-wider text-xs font-bold font-sans">
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Department & Title</th>
                  <th className="py-3.5 px-4">Direct Manager</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05] text-slate-700">
                {loading ? (
                  <LoadingState message="Loading directory roster..." variant="table" colSpan={6} />
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No users match your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const manager = users.find((m) => m.id === u.managerId)
                    const initials = getInitials(u.name)
                    const colorClass = getInitialsColor(u.name)

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-[#1a1a22] transition-colors group">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedInstaUser(u)
                              }}
                              className="relative shrink-0 cursor-pointer p-[1.5px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] via-[#cc2366] to-[#bc1888] shadow-2xs hover:shadow-[0_0_12px_rgba(220,39,67,0.4)] hover:scale-110 active:scale-95 transition-all"
                              title="Touch to view Instagram-style profile"
                            >
                              <div className="p-[1px] bg-white dark:bg-[#121214] rounded-full">
                                {u.avatar ? (
                                  <img
                                    src={u.avatar}
                                    alt={u.name}
                                    className="w-7 h-7 rounded-full object-cover"
                                  />
                                ) : (
                                  <div
                                    className={`w-7 h-7 rounded-full ${colorClass} flex items-center justify-center font-medium text-[10px] select-none`}
                                  >
                                    {initials}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-zinc-100">{u.name}</div>
                              <div className="text-[11px] text-slate-400 dark:text-zinc-400 font-sans group-hover:text-slate-500 dark:group-hover:text-zinc-300 transition-colors">
                                {u.employeeCode} · {u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <RoleBadge role={u.role} />
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800 dark:text-zinc-200">{u.designation}</div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400">{u.department}</div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                          {manager ? manager.name : '—'}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${
                              u.active
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent'
                                : 'bg-slate-100 dark:bg-zinc-850 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                            }`}
                          >
                            {u.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Edit user details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                u.active
                                  ? 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                  : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                              }`}
                              title={u.active ? 'Deactivate user' : 'Activate user'}
                            >
                              {u.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination / Results count under cards/table */}
      <div className="flex items-center justify-end pt-1 pb-1 text-xs text-slate-500 dark:text-zinc-400 font-sans">
        <span>Showing {filteredUsers.length} of {users.length} enterprise personnel</span>
      </div>

      {/* Create / Edit User Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Edit Employee Record' : 'Add Employee to Directory'}
        subtitle="Manage employee profile and reporting relationship"
        maxWidth="md"
        onSubmit={handleSaveUser}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors font-sans text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="premium-glow-btn h-10 px-5 text-xs font-semibold cursor-pointer"
            >
              {editingUser ? 'Save Changes' : 'Create Account'}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Corporate Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. alex.rivera@performiq.internal"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Role Permission</label>
              <CustomDropdown
                value={role}
                onChange={(val) => setRole(val as Role)}
                fullWidth
                options={[
                  { value: 'employee', label: 'Employee (IC)' },
                  { value: 'manager', label: 'Manager' },
                  { value: 'admin', label: 'Administrator' },
                ]}
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Department</label>
              <CustomDropdown
                value={department}
                onChange={setDepartment}
                fullWidth
                options={[
                  { value: 'Engineering', label: 'Engineering' },
                  { value: 'Product & Design', label: 'Product & Design' },
                  { value: 'People Operations', label: 'People Operations' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Job Designation</label>
            <input
              type="text"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Staff Frontend Engineer"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Direct Manager</label>
            <CustomDropdown
              value={managerId}
              onChange={setManagerId}
              fullWidth
              placeholder="No manager (Executive level)"
              options={[
                { value: '', label: 'No manager (Executive level)' },
                ...managersList
                  .filter((m) => (editingUser ? m.id !== editingUser.id : true))
                  .map((m) => ({
                    value: m.id,
                    label: `${m.name} — ${m.designation} (${m.department})`,
                  })),
              ]}
            />
          </div>

        </div>
      </Modal>

      {/* Instagram-Style Profile Photo Modal */}
      <InstaProfileModal
        user={selectedInstaUser}
        isOpen={Boolean(selectedInstaUser)}
        onClose={() => setSelectedInstaUser(null)}
        manager={users.find((m) => m.id === selectedInstaUser?.managerId)}
        onEdit={(u) => {
          setSelectedInstaUser(null)
          openEditModal(u)
        }}
      />
    </div>
  )
}

