'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, UserCheck, UserX, LogOut,
  ChevronLeft, ChevronRight, X, Laptop, Smartphone, RefreshCw,
  Download, CheckCircle, AlertTriangle, Power,
} from 'lucide-react'
import { adminUsersApi, adminRolesApi, ApiError } from '@/lib/api'
import type { SyncResult } from '@/lib/api'
import type { User, Role, LoginSession } from '@/types/api'
type RoleType = Role
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

// Re-export the types we need
type UserType = User
type LoginSessionType = LoginSession

// ─── HRForce sync banner ──────────────────────────────────────────────────────

function SyncBanner({
  result,
  onDismiss,
  pu,
}: {
  result: SyncResult
  onDismiss: () => void
  pu: ReturnType<typeof useTranslation>['t']['pages']['users']
}) {
  const hasErrors = result.errors > 0
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border text-sm',
        hasErrors
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-200'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-200',
      )}
    >
      {hasErrors ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="font-semibold">
          {pu.syncComplete} — {result.total_fetched} {pu.syncFetched}
        </p>
        <p className="text-xs mt-1 opacity-80">
          {result.created} {pu.syncCreated} · {result.updated} {pu.syncUpdated} · {result.skipped} {pu.syncSkipped}
          {result.errors > 0 && ` · ${result.errors} ${pu.syncErrors}`}
        </p>
      </div>
      <button onClick={onDismiss} className="p-1 opacity-60 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </motion.div>
  )
}

// ─── User detail modal ────────────────────────────────────────────────────────

function UserModal({
  user,
  roles,
  onClose,
  onUpdate,
  pu,
}: {
  user: UserType
  roles: RoleType[]
  onClose: () => void
  onUpdate: (updated: UserType) => void
  pu: ReturnType<typeof useTranslation>['t']['pages']['users']
}) {
  const [sessions, setSessions] = useState<LoginSessionType[]>([])
  const [sessionsLoading, setSessLoading] = useState(true)
  const [roleId, setRoleId] = useState<number | ''>(user.role?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [localUser, setLocalUser] = useState(user)

  useEffect(() => {
    adminUsersApi
      .getSessions(user.id)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setSessLoading(false))
  }, [user.id])

  const handleSaveRole = async () => {
    setSaving(true)
    try {
      const updated = await adminUsersApi.update(user.id, {
        role: roleId === '' ? null : (roleId as number),
      })
      setLocalUser(updated)
      onUpdate(updated)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const handleToggleActive = async () => {
    setToggling(true)
    try {
      const updated = await adminUsersApi.update(user.id, {
        is_active: !localUser.is_active,
      })
      setLocalUser(updated)
      onUpdate(updated)
    } catch { /* ignore */ } finally { setToggling(false) }
  }

  const handleForceLogout = async () => {
    if (!confirm(`Force logout ${localUser.username}?`)) return
    setLoggingOut(true)
    try {
      await adminUsersApi.forceLogout(localUser.id)
      setSessions((s) => s.map((sess) => ({ ...sess, is_active: false })))
    } catch { /* ignore */ } finally { setLoggingOut(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-end bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="h-full w-full max-w-lg bg-[var(--surface)] border-l border-[var(--border)] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
              {[localUser.first_name?.[0], localUser.last_name?.[0]].filter(Boolean).join('').toUpperCase() || localUser.username[0].toUpperCase()}
            </div>
            <div>
              <p className="text-[var(--text-primary)] font-semibold text-sm">
                {[localUser.first_name, localUser.last_name].filter(Boolean).join(' ') || localUser.username}
              </p>
              <p className="text-xs text-slate-400">@{localUser.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-[var(--text-primary)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Status badges + activate/deactivate */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
              localUser.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
              {localUser.is_active ? pu.active : pu.inactive}
            </span>
            {localUser.is_superuser && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Superadmin</span>
            )}
            {localUser.hrforce_role && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400">
                {localUser.hrforce_role}
              </span>
            )}
            {localUser.hrforce_id && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 font-mono">
                #{localUser.hrforce_id}
              </span>
            )}

            {/* Activate / deactivate toggle — superadmin cannot be deactivated */}
            {!localUser.is_superuser && (
              <button
                onClick={handleToggleActive}
                disabled={toggling}
                className={cn(
                  'ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-60',
                  localUser.is_active
                    ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
                )}
              >
                <Power size={12} />
                {toggling ? '…' : localUser.is_active ? pu.deactivate : pu.activate}
              </button>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              { label: 'Email', value: localUser.email || '—' },
              { label: 'Phone', value: localUser.phone || '—' },
              { label: 'Occupation', value: localUser.occupation || '—' },
              { label: 'Department', value: localUser.department || '—' },
              { label: 'Company', value: localUser.company_name || '—' },
              { label: 'Agency', value: localUser.agence_name ? `${localUser.agence_name}${localUser.agence_code ? ` (${localUser.agence_code})` : ''}` : '—' },
              { label: 'Employee Code', value: localUser.hrforce_code || '—' },
              { label: 'Last Login', value: localUser.last_login_display || '—' },
            ].map((f) => (
              <div key={f.label}>
                <p className="text-xs text-slate-500 mb-0.5">{f.label}</p>
                <p className="text-[var(--text-primary)] text-xs">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Role assignment */}
          <div className="bg-[var(--surface-secondary)] rounded-xl p-4">
            <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-2">{pu.assignRole}</label>
            <div className="flex gap-2">
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : '')}
                className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary"
              >
                <option value="">—</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.display_name}</option>
                ))}
              </select>
              <button
                onClick={handleSaveRole}
                disabled={saving}
                className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-60"
              >
                {saving ? '…' : pu.saveRole}
              </button>
            </div>
            {localUser.role && (
              <p className="text-xs text-slate-500 mt-2">
                <span style={{ color: localUser.role.color }} className="font-semibold">{localUser.role.display_name}</span>
              </p>
            )}
          </div>

          {/* Danger zone */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <button
              onClick={handleForceLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-60"
            >
              <LogOut size={13} />
              {loggingOut ? '…' : pu.forceLogout}
            </button>
          </div>

          {/* Sessions */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{pu.sessions}</h4>
            {sessionsLoading ? (
              <div className="flex items-center justify-center h-16">
                <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-slate-500">{pu.noSessions}</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-[var(--surface-secondary)] rounded-lg">
                    <div className="text-slate-500">
                      {s.device_type === 'mobile' ? <Smartphone size={14} /> : <Laptop size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--text-secondary)]">{s.browser} · {s.os}</p>
                      <p className="text-[11px] text-slate-600">
                        {s.ip_address} · {formatDistanceToNow(new Date(s.logged_in_at), { addSuffix: true })}
                      </p>
                    </div>
                    {s.is_active && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                        {pu.active}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function AdminUsersPage() {
  const router = useRouter()
  const { user: me } = useAuthStore()
  const { t } = useTranslation()
  const pu = t.pages.users

  const [users, setUsers] = useState<UserType[]>([])
  const [roles, setRoles] = useState<RoleType[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined)
  const [filterRole, setFilterRole] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  useEffect(() => {
    if (me && !me.is_superuser) router.replace('/overview')
  }, [me, router])

  useEffect(() => {
    adminRolesApi.list().then(setRoles).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminUsersApi.list({
        search: search || undefined,
        is_active: filterActive,
        role: filterRole,
        page,
      })
      setUsers(data.results)
      setCount(data.count)
    } catch { /* silently ignore */ } finally { setLoading(false) }
  }, [search, filterActive, filterRole, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, filterActive, filterRole])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await adminUsersApi.syncHRForce()
      setSyncResult(result)
      load() // refresh list after sync
    } catch (err) {
      setSyncResult({ total_fetched: 0, created: 0, updated: 0, skipped: 0, errors: 1 })
    } finally {
      setSyncing(false)
    }
  }

  const toggleSelect = (id: string) =>
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])

  const selectAll = () =>
    setSelected(selected.length === users.length ? [] : users.map((u) => u.id))

  const bulkActivate = async (isActive: boolean) => {
    if (selected.length === 0) return
    setBulkLoading(true)
    try {
      await adminUsersApi.bulkActivate(selected, isActive)
      setUsers((u) => u.map((usr) => selected.includes(usr.id) ? { ...usr, is_active: isActive } : usr))
      setSelected([])
    } catch { /* ignore */ } finally { setBulkLoading(false) }
  }

  const bulkAssignRole = async (roleId: number | null) => {
    if (selected.length === 0) return
    setBulkLoading(true)
    try {
      await adminUsersApi.bulkAssignRole(selected, roleId)
      const role = roles.find((r) => r.id === roleId) ?? null
      setUsers((u) => u.map((usr) => selected.includes(usr.id) ? { ...usr, role } : usr))
      setSelected([])
    } catch { /* ignore */ } finally { setBulkLoading(false) }
  }

  const handleUserUpdate = (updated: UserType) => {
    setUsers((u) => u.map((usr) => usr.id === updated.id ? { ...usr, ...updated } : usr))
    setSelectedUser(updated)
  }

  if (!me?.is_superuser) return null

  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{t.nav.users}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{count}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-primary text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
          >
            {syncing
              ? <span className="w-4 h-4 border-2 border-slate-500/30 border-t-slate-400 rounded-full animate-spin" />
              : <Download size={15} />}
            {pu.syncHrforce}
          </button>
        </div>
      </div>

      {/* Sync result banner */}
      <AnimatePresence>
        {syncResult && (
          <SyncBanner result={syncResult} onDismiss={() => setSyncResult(null)} pu={pu} />
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={pu.searchPlaceholder}
            className="pl-9 pr-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-primary w-56"
          />
        </div>

        <select
          value={filterActive === undefined ? '' : String(filterActive)}
          onChange={(e) => setFilterActive(e.target.value === '' ? undefined : e.target.value === 'true')}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary"
        >
          <option value="">—</option>
          <option value="true">{pu.active}</option>
          <option value="false">{pu.inactive}</option>
        </select>

        <select
          value={filterRole ?? ''}
          onChange={(e) => setFilterRole(e.target.value ? Number(e.target.value) : undefined)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary"
        >
          <option value="">—</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.display_name}</option>)}
        </select>
      </div>

      {/* Bulk actions */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-xl flex-wrap"
          >
            <span className="text-sm text-primary font-semibold">{selected.length}</span>
            <div className="flex gap-2 ml-auto flex-wrap">
              <button
                onClick={() => bulkActivate(true)}
                disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-60"
              >
                <UserCheck size={12} /> {pu.activate}
              </button>
              <button
                onClick={() => bulkActivate(false)}
                disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-60"
              >
                <UserX size={12} /> {pu.deactivate}
              </button>
              <select
                onChange={(e) => {
                  if (e.target.value !== '') {
                    bulkAssignRole(e.target.value === 'null' ? null : Number(e.target.value))
                    e.target.value = ''
                  }
                }}
                disabled={bulkLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-primary disabled:opacity-60"
              >
                <option value="">{pu.assignRole}…</option>
                <option value="null">—</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.display_name}</option>)}
              </select>
              <button onClick={() => setSelected([])} className="px-2 text-slate-500 hover:text-[var(--text-primary)]">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.length === users.length && users.length > 0}
                    onChange={selectAll}
                    className="accent-primary"
                  />
                </th>
                <th className="px-4 py-3 text-left">{pu.colUser}</th>
                <th className="px-4 py-3 text-left">{pu.colOccupation}</th>
                <th className="px-4 py-3 text-left">{pu.colRole}</th>
                <th className="px-4 py-3 text-left">{pu.colCompany}</th>
                <th className="px-4 py-3 text-left">{pu.colStatus}</th>
                <th className="px-4 py-3 text-left">{pu.colLastLogin}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 text-sm">{pu.noUsers}</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="hover:bg-[var(--surface-secondary-60)] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {[u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join('').toUpperCase() || u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[var(--text-primary)] font-medium">
                            {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}
                          </p>
                          <p className="text-xs text-slate-500">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[160px] truncate" title={u.occupation || undefined}>
                      {u.occupation || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {u.role ? (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: u.role.color + '20', color: u.role.color }}
                        >
                          {u.role.display_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{u.company_name || '—'}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          if (u.is_superuser) return
                          adminUsersApi.update(u.id, { is_active: !u.is_active }).then((updated) => {
                            setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_active: updated.is_active } : x))
                          }).catch(() => {})
                        }}
                        disabled={u.is_superuser}
                        title={u.is_superuser ? 'Superadmin cannot be deactivated' : (u.is_active ? 'Click to deactivate' : 'Click to activate')}
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full transition-opacity',
                          u.is_superuser ? 'cursor-default' : 'hover:opacity-70 cursor-pointer',
                          u.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400',
                        )}
                      >
                        {u.is_active ? pu.active : pu.inactive}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{u.last_login_display || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-slate-500">{page} / {totalPages}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 text-slate-500 hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 text-slate-500 hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User detail slide-in */}
      <AnimatePresence>
        {selectedUser && (
          <UserModal
            user={selectedUser}
            roles={roles}
            onClose={() => setSelectedUser(null)}
            onUpdate={handleUserUpdate}
            pu={pu}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
