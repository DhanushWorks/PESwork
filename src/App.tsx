import React from 'react'
import { RouterProvider } from 'react-router-dom'
import { AppProvider } from './app/AppContext'
import { ToastProvider } from './components/ui/Toast'
import { router } from './app/router'

export function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <RouterProvider router={router} />
      </AppProvider>
    </ToastProvider>
  )
}

export default App
