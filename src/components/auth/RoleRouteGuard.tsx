import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Role } from '../../types'

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
  const { currentUser } = useApp()

  if (currentUser.role !== allowedRole) {
    return <Navigate to={`/${currentUser.role}`} replace />
  }

  return children ? <>{children}</> : <Outlet />
}

/**
 * Root dynamic redirect:
 * When navigating to root `/`, redirects directly to the active user's role dashboard.
 */
export const RootRedirect: React.FC = () => {
  const { currentUser } = useApp()
  return <Navigate to={`/${currentUser.role}`} replace />
}

