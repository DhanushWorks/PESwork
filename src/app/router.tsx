import React from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AppLayout } from '../components/shell/AppLayout'
import { Login } from '../pages/Login'
import { Forbidden, NotFound, RouteErrorBoundary } from '../pages/Forbidden'
import { RoleRouteGuard, RootRedirect } from '../components/auth/RoleRouteGuard'

// Employee Pages
import { EmployeeDashboard } from '../pages/employee/Dashboard'
import { EmployeeGoals } from '../pages/employee/Goals'
import { GoalDetail } from '../pages/employee/GoalDetail'
import { EmployeeSelfReview } from '../pages/employee/SelfReview'
import { EmployeeFeedback } from '../pages/employee/Feedback'
import { EmployeeResults } from '../pages/employee/Results'
import { EmployeeDevelopment } from '../pages/employee/Development'
import { EmployeeProfile } from '../pages/employee/Profile'

// Manager Pages
import { ManagerDashboard } from '../pages/manager/Dashboard'
import { ManagerApprovals } from '../pages/manager/Approvals'
import { ManagerReviewWorkspace } from '../pages/manager/ReviewWorkspace'
import { ManagerAnalytics } from '../pages/manager/Analytics'
import { ManagerOneOnOnes } from '../pages/manager/OneOnOnes'

// Admin Pages
import { AdminOverview } from '../pages/admin/Overview'
import { AdminUsers } from '../pages/admin/Users'
import { AdminCycles } from '../pages/admin/Cycles'
import { AdminCycleDetail } from '../pages/admin/CycleDetail'
import { AdminCalibration } from '../pages/admin/Calibration'
import { AdminReports } from '../pages/admin/Reports'
import { AdminAudit } from '../pages/admin/Audit'
import { Settings } from '../pages/Settings'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/signup',
    element: <Login initialMode="signup" />,
  },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <RootRedirect />,
      },
      // Employee Routes (Strictly Employee role only)
      {
        path: 'employee',
        element: <RoleRouteGuard allowedRole="employee" />,
        children: [
          { index: true, element: <EmployeeDashboard /> },
          { path: 'goals', element: <EmployeeGoals /> },
          { path: 'goals/:goalId', element: <GoalDetail /> },
          { path: 'self-review', element: <EmployeeSelfReview /> },
          { path: 'feedback', element: <EmployeeFeedback /> },
          { path: 'results', element: <EmployeeResults /> },
          { path: 'development', element: <EmployeeDevelopment /> },
          { path: 'profile', element: <EmployeeProfile /> },
        ],
      },
      // Manager Routes (Strictly Manager role only)
      {
        path: 'manager',
        element: <RoleRouteGuard allowedRole="manager" />,
        children: [
          { index: true, element: <ManagerDashboard /> },
          { path: 'approvals', element: <ManagerApprovals /> },
          { path: 'reviews/:employeeId', element: <ManagerReviewWorkspace /> },
          { path: 'analytics', element: <ManagerAnalytics /> },
          { path: 'one-on-ones', element: <ManagerOneOnOnes /> },
        ],
      },
      // Admin Routes (Strictly Admin role only)
      {
        path: 'admin',
        element: <RoleRouteGuard allowedRole="admin" />,
        children: [
          { index: true, element: <AdminOverview /> },
          { path: 'users', element: <AdminUsers /> },
          { path: 'cycles', element: <AdminCycles /> },
          { path: 'cycles/:cycleId', element: <AdminCycleDetail /> },
          { path: 'calibration', element: <AdminCalibration /> },
          { path: 'reports', element: <AdminReports /> },
          { path: 'audit', element: <AdminAudit /> },
        ],
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'forbidden',
        element: <Forbidden />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
])

