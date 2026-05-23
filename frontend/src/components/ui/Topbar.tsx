'use client'

import { useState } from 'react'
import { Bell, ChevronDown, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useFilterStore } from '@/stores/filterStore'
import { authApi, clearTokens, getRefreshToken } from '@/lib/api'
import { NotificationPanel } from '@/components/ui/NotificationPanel'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const DATE_RANGES = [
  { value: '7d' as const, label: '7d' },
  { value: '30d' as const, label: '30d' },
  { value: '3m' as const, label: '3m' },
  { value: '12m' as const, label: '12m' },
]

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  const router = useRouter()
  const { userName, userRole, logout } = useAuthStore()
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const { dateRange, setDateRange } = useFilterStore()
  const { t } = useTranslation()

  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  const handleLogout = async () => {
    const refresh = getRefreshToken()
    if (refresh) {
      try { await authApi.logout(refresh) } catch { /* proceed */ }
    }
    clearTokens()
    logout()
    router.replace('/login')
  }

  return (
    <header className="h-16 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between px-6 sticky top-0 z-30">
      <h1 className="text-lg font-semibold text-[var(--text-primary)] truncate">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Date range */}
        <div className="flex items-center gap-0.5 bg-[var(--surface-secondary)] rounded-lg p-1">
          {DATE_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDateRange(r.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                dateRange === r.value
                  ? 'bg-primary text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen((o) => !o)
              setUserMenuOpen(false)
            }}
            className="relative p-2 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
        </div>

        {/* User button */}
        <div className="relative">
          <button
            onClick={() => {
              setUserMenuOpen((o) => !o)
              setNotifOpen(false)
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary/30 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-medium text-[var(--text-primary)] leading-none">{userName || '—'}</p>
              <p className="text-[10px] text-[var(--text-muted)] leading-none mt-0.5">{userRole || 'User'}</p>
            </div>
            <ChevronDown size={13} className="text-[var(--text-muted)]" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden z-50">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 dark:text-red-400 hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <LogOut size={14} />
                {t.nav.signOut}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
