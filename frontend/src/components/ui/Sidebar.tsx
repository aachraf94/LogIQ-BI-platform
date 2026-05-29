'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Truck,
  Package,
  Route,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
  KeyRound,
  Database,
} from 'lucide-react'
import { useState } from 'react'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  labelKey: keyof ReturnType<typeof useTranslation>['t']['nav']
  icon: React.ElementType
  dashboard?: string
}

const MAIN_NAV: NavItem[] = [
  { href: '/overview',     labelKey: 'overview',    icon: LayoutDashboard, dashboard: 'overview' },
  { href: '/transport',    labelKey: 'transport',   icon: Truck,           dashboard: 'transport' },
  { href: '/parcel-delivery', labelKey: 'parcelDelivery', icon: Package,         dashboard: 'parcels' },
  { href: '/routes',       labelKey: 'routes',      icon: Route,           dashboard: 'routes' },
  { href: '/alerts',       labelKey: 'alerts',      icon: Bell },
  { href: '/settings',     labelKey: 'settings',    icon: Settings },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin',        labelKey: 'adminOverview', icon: ShieldCheck },
  { href: '/admin/users',  labelKey: 'users',         icon: Users },
  { href: '/admin/roles',  labelKey: 'roles',         icon: KeyRound },
  { href: '/admin/etl',    labelKey: 'etl',           icon: Database },
]

function NavLink({ item, collapsed, label }: { item: NavItem; collapsed: boolean; label: string }) {
  const pathname = usePathname()
  const active =
    item.href === '/admin'
      ? pathname === '/admin'
      : pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
        active
          ? 'bg-primary/20 text-primary'
          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]'
      )}
      title={collapsed ? label : undefined}
    >
      <item.icon size={18} className="shrink-0" />
      {!collapsed && (
        <span className="text-sm font-medium truncate">{label}</span>
      )}
      {active && !collapsed && (
        <motion.div
          layoutId="active-pill"
          className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
        />
      )}
    </Link>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuthStore()
  const { t, isRTL } = useTranslation()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== 'light'

  const accessibleDashboards = user?.accessible_dashboards ?? []
  const isSuperAdmin = user?.is_superuser ?? false

  const visibleNav = MAIN_NAV.filter(
    (item) => !item.dashboard || isSuperAdmin || accessibleDashboards.includes(item.dashboard)
  )

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className={cn(
        'fixed top-0 h-full bg-[var(--surface)] flex flex-col z-40 overflow-hidden',
        isRTL
          ? 'right-0 border-l border-[var(--border)]'
          : 'left-0 border-r border-[var(--border)]'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-[var(--border)] shrink-0">
        {collapsed ? (
          <Image
            src={isDark ? '/assets/logos/Logo Only Dark.svg' : '/assets/logos/Logo Only Light.svg'}
            alt="LOGIQ"
            width={36}
            height={36}
            className="shrink-0"
            priority
          />
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Image
              src={isDark ? '/assets/logos/Logo + LOGIQ Dark.svg' : '/assets/logos/Logo + LOGIQ Light.svg'}
              alt="LOGIQ"
              width={120}
              height={36}
              className="object-contain"
              priority
            />
          </motion.div>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {visibleNav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} label={t.nav[item.labelKey]} />
        ))}

        {/* Admin section */}
        {isSuperAdmin && (
          <>
            <div className={cn('pt-4 pb-1', collapsed ? 'hidden' : 'block')}>
              <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                {t.nav.adminSection}
              </p>
            </div>
            {collapsed && <div className="my-2 mx-3 h-px bg-[var(--surface-tertiary)]" />}
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} label={t.nav[item.labelKey]} />
            ))}
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-3 p-2 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-tertiary)] transition-colors flex items-center justify-center"
      >
        {isRTL
          ? (collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)
          : (collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)
        }
      </button>
    </motion.aside>
  )
}
