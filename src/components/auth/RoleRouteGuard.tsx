import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Role } from '../../types'
import { storageService } from '../../services'
import { matchesUser } from '../../lib/workflow'

interface RoleRouteGuardProps {
  allowedRole: Role
  children?: React.ReactNode
}

/**
 * Strict Role-Based Access Control (RBAC) Guard.
 * Ensures that if an admin is logged in, ONLY admin pages can be displayed.
 * If an employee is logged in, ONLY employee pages can be displayed.
 * If a manager is logged in, ONLY manager pages can be displayed.
 * Any attempt to access another role's routes is immediately intercepted and redirected
 * to the authenticated user's designated workspace.
 */
export const RoleRouteGuard: React.FC<RoleRouteGuardProps> = ({ allowedRole, children }) => {
  const { currentUser, isAuthenticated } = useApp()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Guard against transient state de-synchronization during navigation:
  // Check storageService synchronously to verify if user was just switched
  const state = storageService.getState()
  const activeUser =
    currentUser && (currentUser.id === state.currentUserId || matchesUser(currentUser.id, state.currentUserId))
      ? currentUser
      : state.users.find((u) => u.id === state.currentUserId || matchesUser(u.id, state.currentUserId)) || currentUser

  const effectiveRole = activeUser?.role || currentUser?.role || 'employee'

  if (effectiveRole !== allowedRole) {
    return <Navigate to={`/${effectiveRole}`} replace />
  }

  return children ? <>{children}</> : <Outlet />
}

/**
 * Root dynamic redirect:
 * When navigating to root `/` via direct link or browser address bar,
 * immediately opens the designated Login page.
 */
export const RootRedirect: React.FC = () => {
  return <Navigate to="/login" replace />
}

