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
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  dashboard?: string // restricts to users whose role has this dashboard
}

const MAIN_NAV: NavItem[] = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard, dashboard: 'overview' },
  { href: '/transport', label: 'Transport', icon: Truck, dashboard: 'transport' },
  { href: '/parcel-costs', label: 'Parcel Costs', icon: Package, dashboard: 'parcels' },
  { href: '/routes', label: 'Route Analysis', icon: Route, dashboard: 'routes' },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Admin Overview', icon: ShieldCheck },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/roles', label: 'Roles', icon: KeyRound },
  { href: '/admin/etl', label: 'ETL Runs', icon: Database },
]

function NavLink({
  item,
  collapsed,
}: {
  item: NavItem
  collapsed: boolean
}) {
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
          : 'text-slate-400 hover:bg-[#252840] hover:text-slate-200'
      )}
      title={collapsed ? item.label : undefined}
    >
      <item.icon size={18} className="shrink-0" />
      {!collapsed && (
        <span className="text-sm font-medium truncate">{item.label}</span>
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

  const accessibleDashboards = user?.accessible_dashboards ?? []
  const isSuperAdmin = user?.is_superuser ?? false

  const visibleNav = MAIN_NAV.filter(
    (item) => !item.dashboard || isSuperAdmin || accessibleDashboards.includes(item.dashboard)
  )

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full bg-[#1E2030] border-r border-[#2D3050] flex flex-col z-40 overflow-hidden"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-[#2D3050] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-white font-bold text-lg tracking-tight"
            >
              LOGIQ
            </motion.span>
          )}
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {visibleNav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}

        {/* Admin section */}
        {isSuperAdmin && (
          <>
            <div className={cn('pt-4 pb-1', collapsed ? 'hidden' : 'block')}>
              <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                Admin
              </p>
            </div>
            {collapsed && <div className="my-2 mx-3 h-px bg-[#2D3050]" />}
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-3 p-2 rounded-lg bg-[#252840] text-slate-400 hover:text-white hover:bg-[#2D3050] transition-colors flex items-center justify-center"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </motion.aside>
  )
}
