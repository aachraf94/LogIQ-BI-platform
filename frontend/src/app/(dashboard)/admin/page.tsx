'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, ShieldAlert, Bell, Database, Activity, TrendingUp, CheckCircle2 } from 'lucide-react'
import { adminUsersApi, healthApi, etlApi } from '@/lib/api'
import type { UserStats, PlatformStats, DataFreshness } from '@/types/api'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

function StatCard({
  icon: Icon, label, value, sub, color = 'text-primary',
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('p-2 rounded-lg bg-[var(--surface-secondary)]', color)}>
          <Icon size={16} />
        </div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { t } = useTranslation()
  const p = t.pages.admin
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null)
  const [freshness, setFreshness] = useState<DataFreshness | null>(null)
  const [loading, setLoading] = useState(true)

  // Guard
  useEffect(() => {
    if (user && !user.is_superuser) router.replace('/overview')
  }, [user, router])

  useEffect(() => {
    if (!user?.is_superuser) return
    Promise.all([
      adminUsersApi.stats(),
      healthApi.stats(),
      etlApi.freshness(),
    ]).then(([u, p, f]) => {
      setUserStats(u)
      setPlatformStats(p)
      setFreshness(f)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  if (!user?.is_superuser) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  const etlStatusColor: Record<string, string> = {
    success: 'text-emerald-400',
    failure: 'text-red-400',
    running: 'text-amber-400',
    partial: 'text-amber-400',
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{p.title}</h2>
        <p className="text-sm text-slate-400 mt-0.5">{p.subtitle}</p>
      </div>

      {/* User stats */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{p.sectionUsers}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label={p.labelTotalUsers} value={userStats?.total ?? '—'} color="text-primary" />
          <StatCard icon={CheckCircle2} label={p.labelActive} value={userStats?.active ?? '—'} sub={`${userStats?.inactive ?? 0} ${p.inactive}`} color="text-emerald-400" />
          <StatCard icon={Activity} label={p.labelNewMonth} value={userStats?.new_this_month ?? '—'} color="text-cyan-400" />
          <StatCard icon={ShieldAlert} label={p.labelWithoutRole} value={userStats?.without_role ?? '—'} sub={p.needRole} color="text-amber-400" />
        </div>
      </div>

      {/* Role breakdown */}
      {userStats && userStats.by_role.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{p.usersByRole}</h3>
          <div className="space-y-3">
            {userStats.by_role.map((r) => (
              <div key={r.role__display_name} className="flex items-center gap-3">
                <p className="text-sm text-[var(--text-primary)] w-48 truncate">{r.role__display_name}</p>
                <div className="flex-1 h-2 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(r.count / (userStats.total || 1)) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
                <span className="text-xs text-slate-400 w-8 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform stats */}
      {platformStats && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{p.sectionPlatform}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Activity} label={p.labelOnline} value={platformStats.users_online_now} color="text-emerald-400" />
            <StatCard icon={ShieldAlert} label={p.labelUnackAlerts} value={platformStats.unacknowledged_alerts} color="text-red-400" />
            <StatCard icon={Bell} label={p.labelUnreadNotifs} value={platformStats.unread_notifications_total} color="text-amber-400" />
            <StatCard icon={Database} label={p.labelEtlToday} value={platformStats.etl_runs_today}
              sub={platformStats.last_etl_status ? `${p.labelLastEtl} ${platformStats.last_etl_status}` : undefined}
              color={etlStatusColor[platformStats.last_etl_status ?? ''] ?? 'text-slate-400'} />
          </div>
        </div>
      )}

      {/* ETL freshness */}
      {freshness && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{p.dataFreshness}</h3>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
              freshness.is_stale ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400')}>
              {freshness.is_stale ? p.stale : p.fresh}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">{p.lastSuccess}</p>
              <p className="text-[var(--text-primary)] font-medium mt-0.5">{freshness.lag_display}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{p.runs7Days}</p>
              <p className="text-[var(--text-primary)] font-medium mt-0.5">{freshness.runs_last_7_days}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{p.successRate}</p>
              <p className="text-[var(--text-primary)] font-medium mt-0.5">{freshness.success_rate_pct.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{p.lastJob}</p>
              <p className="text-[var(--text-primary)] font-medium mt-0.5">{freshness.last_run?.job_name ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { href: '/admin/users', label: p.manageUsers, desc: p.manageUsersDesc, icon: Users },
          { href: '/admin/roles', label: p.manageRoles, desc: p.manageRolesDesc, icon: TrendingUp },
          { href: '/admin/etl', label: p.etlRuns, desc: p.etlRunsDesc, icon: Database },
        ].map(({ href, label, desc, icon: Icon }) => (
          <a key={href} href={href}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:border-primary/40 transition-colors group">
            <Icon size={20} className="text-primary mb-3" />
            <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-primary transition-colors">{label}</p>
            <p className="text-xs text-slate-400 mt-1">{desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
