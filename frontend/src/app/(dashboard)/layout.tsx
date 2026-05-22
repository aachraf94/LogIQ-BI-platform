'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Sidebar } from '@/components/ui/Sidebar'
import { Topbar } from '@/components/ui/Topbar'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { OnboardingModal } from '@/components/ui/OnboardingModal'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { useNotifications } from '@/hooks/useNotifications'
import { meApi } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'

// Syncs next-themes to the user's saved theme preference on login/refresh
function ThemeSync() {
  const { setTheme } = useTheme()
  const theme = useAuthStore((s) => s.user?.preferences?.theme)

  useEffect(() => {
    if (theme) setTheme(theme)
  }, [theme, setTheme])

  return null
}

// Syncs the <html> lang + dir attributes to the user's saved language
function LanguageSync() {
  const language = useAuthStore((s) => s.user?.preferences?.language as Locale | undefined)

  useEffect(() => {
    const lang = language ?? 'fr'
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  return null
}

// Starts SSE notification stream — runs inside auth-guarded layout
function NotificationsInit() {
  useNotifications()
  return null
}

function pageTitle(pathname: string, t: ReturnType<typeof useTranslation>['t']): string {
  const map: Record<string, string> = {
    '/overview':    t.nav.overview,
    '/transport':   t.nav.transport,
    '/parcel-costs':t.nav.parcelCosts,
    '/routes':      t.nav.routes,
    '/alerts':      t.nav.alerts,
    '/settings':    t.nav.settings,
    '/admin':       t.nav.adminOverview,
    '/admin/users': t.nav.users,
    '/admin/roles': t.nav.roles,
    '/admin/etl':   t.nav.etl,
  }
  return map[pathname] ?? 'LOGIQ'
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isFirstLogin, user, updateUser } = useAuthStore()
  const { t, isRTL } = useTranslation()

  const [hydrated, setHydrated] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Zustand persist rehydrates after first render
  useEffect(() => { setHydrated(true) }, [])

  // Auth guard
  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated) router.replace('/login')
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
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <ThemeSync />
      <LanguageSync />
      <NotificationsInit />
      <Sidebar />
      <div className="flex-1 flex flex-col" style={isRTL ? { marginRight: 240 } : { marginLeft: 240 }}>
        <Topbar title={pageTitle(pathname, t)} />
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
