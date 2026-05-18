'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/ui/Sidebar'
import { Topbar } from '@/components/ui/Topbar'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { OnboardingModal } from '@/components/ui/OnboardingModal'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { useNotifications } from '@/hooks/useNotifications'
import { meApi } from '@/lib/api'

const PAGE_TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/transport': 'Transport Demands',
  '/parcel-costs': 'Parcel Costs (CCC)',
  '/routes': 'Route Analysis',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
  '/admin': 'Admin Overview',
  '/admin/users': 'User Management',
  '/admin/roles': 'Role Management',
  '/admin/etl': 'ETL Runs',
}

function pageTitle(pathname: string): string {
  return PAGE_TITLES[pathname] ?? 'Dashboard'
}

// Starts SSE notification stream — runs inside auth-guarded layout
function NotificationsInit() {
  useNotifications()
  return null
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isFirstLogin, user, updateUser } = useAuthStore()

  const [hydrated, setHydrated] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Zustand persist rehydrates after first render
  useEffect(() => {
    setHydrated(true)
  }, [])

  // Auth guard
  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [hydrated, isAuthenticated, router])

  // Show onboarding on first login
  useEffect(() => {
    if (hydrated && isAuthenticated && isFirstLogin && user && !user.has_completed_onboarding) {
      setShowOnboarding(true)
    }
  }, [hydrated, isAuthenticated, isFirstLogin, user])

  // Track page visit (fire-and-forget)
  useEffect(() => {
    if (!isAuthenticated) return
    const dashboard = pathname.replace('/', '') || 'overview'
    meApi.trackActivity(dashboard, 'view')
  }, [pathname, isAuthenticated])

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#161829] flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#161829]">
      <NotificationsInit />
      <Sidebar />
      <div className="flex-1 flex flex-col" style={{ marginLeft: 240 }}>
        <Topbar title={pageTitle(pathname)} />
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="flex-1 p-6 max-w-[1600px] w-full mx-auto"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      <ToastContainer />

      <OnboardingModal
        open={showOnboarding}
        onDone={() => {
          setShowOnboarding(false)
          updateUser({ has_completed_onboarding: true })
        }}
      />
    </div>
  )
}
