'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Filter, UserCheck, UserX, KeyRound, LogOut,
  ChevronLeft, ChevronRight, X, Laptop, Smartphone, RefreshCw,
} from 'lucide-react'
import { adminUsersApi, adminRolesApi, ApiError } from '@/lib/api'
import type { User, Role, LoginSession } from '@/types/api'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

// ─── User detail modal ────────────────────────────────────────────────────────

function UserModal({
  user, roles, onClose, onUpdate,
}: {
  user: User
  roles: Role[]
  onClose: () => void
  onUpdate: (updated: User) => void
}) {
  const [sessions, setSessions] = useState<LoginSession[]>([])
  const [sessionsLoading, setSessLoading] = useState(true)
  const [roleId, setRoleId] = useState<number | ''>(user.role?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    adminUsersApi.getSessions(user.id)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setSessLoading(false))
  }, [user.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await adminUsersApi.update(user.id, {
        role: roleId ? { id: roleId as number } as Role : null,
      })
      onUpdate(updated)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const handleForceLogout = async () => {
    if (!confirm(`Force logout ${user.username}?`)) return
    setLoggingOut(true)
    try {
      await adminUsersApi.forceLogout(user.id)
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
        className="h-full w-full max-w-lg bg-[#1E2030] border-l border-[#2D3050] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D3050] sticky top-0 bg-[#1E2030] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
              {[user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join('').toUpperCase() || user.username[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">
                {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
              </p>
              <p className="text-xs text-slate-400">@{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
              user.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
              {user.is_active ? 'Active' : 'Inactive'}
            </span>
            {user.is_superuser && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Superadmin</span>}
            {user.hrforce_id && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400">HRForce #{user.hrforce_id}</span>}
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              { label: 'Email', value: user.email || '—' },
              { label: 'Phone', value: user.phone || '—' },
              { label: 'Department', value: user.department || '—' },
              { label: 'Company', value: user.company_name || '—' },
              { label: 'Agency', value: user.agence_name || '—' },
              { label: 'Last Login', value: user.last_login_display || '—' },
            ].map((f) => (
              <div key={f.label}>
                <p className="text-xs text-slate-500 mb-0.5">{f.label}</p>
                <p className="text-slate-200">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Role assignment */}
          <div className="bg-[#252840] rounded-xl p-4">
            <label className="text-xs font-semibold text-slate-400 block mb-2">Assign Role</label>
            <div className="flex gap-2">
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : '')}
                className="flex-1 bg-[#1E2030] border border-[#2D3050] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary"
              >
                <option value="">— No role —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.display_name}</option>
                ))}
              </select>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-60">
                {saving ? '…' : 'Save'}
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-red-400 mb-3">Danger Zone</h4>
            <button onClick={handleForceLogout} disabled={loggingOut}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-60">
              <LogOut size={13} />
              {loggingOut ? 'Logging out…' : 'Force Logout All Sessions'}
            </button>
          </div>

          {/* Sessions */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Recent Sessions</h4>
            {sessionsLoading ? (
              <div className="flex items-center justify-center h-16">
                <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-slate-500">No sessions.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-[#252840] rounded-lg">
                    <div className="text-slate-500">
                      {s.device_type === 'mobile' ? <Smartphone size={14} /> : <Laptop size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300">{s.browser} · {s.os}</p>
                      <p className="text-[11px] text-slate-600">{s.ip_address} · {formatDistanceToNow(new Date(s.logged_in_at), { addSuffix: true })}</p>
                    </div>
                    {s.is_active && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Active</span>}
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

  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined)
  const [filterRole, setFilterRole] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

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

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [search, filterActive, filterRole])

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

  const handleUserUpdate = (updated: User) => {
    setUsers((u) => u.map((usr) => usr.id === updated.id ? updated : usr))
    setSelectedUser(updated)
  }

  if (!me?.is_superuser) return null

  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">User Management</h2>
          <p className="text-sm text-slate-400 mt-0.5">{count} users total</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 text-slate-500 hover:text-slate-300 transition-colors">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="pl-9 pr-4 py-2 bg-[#1E2030] border border-[#2D3050] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary w-56"
          />
        </div>

        <select
          value={filterActive === undefined ? '' : String(filterActive)}
          onChange={(e) => setFilterActive(e.target.value === '' ? undefined : e.target.value === 'true')}
          className="bg-[#1E2030] border border-[#2D3050] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <select
          value={filterRole ?? ''}
          onChange={(e) => setFilterRole(e.target.value ? Number(e.target.value) : undefined)}
          className="bg-[#1E2030] border border-[#2D3050] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary"
        >
          <option value="">All Roles</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.display_name}</option>)}
        </select>
      </div>

      {/* Bulk actions */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-xl"
          >
            <span className="text-sm text-primary font-semibold">{selected.length} selected</span>
            <div className="flex gap-2 ml-auto flex-wrap">
              <button onClick={() => bulkActivate(true)} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-60">
                <UserCheck size={12} /> Activate
              </button>
              <button onClick={() => bulkActivate(false)} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-60">
                <UserX size={12} /> Deactivate
              </button>
              <select
                onChange={(e) => { if (e.target.value !== '') { bulkAssignRole(e.target.value === 'null' ? null : Number(e.target.value)); e.target.value = '' } }}
                disabled={bulkLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-[#252840] text-slate-300 border border-[#2D3050] rounded-lg focus:outline-none focus:border-primary disabled:opacity-60"
              >
                <option value="">Assign Role…</option>
                <option value="null">— Remove role —</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.display_name}</option>)}
              </select>
              <button onClick={() => setSelected([])} className="px-2 text-slate-500 hover:text-slate-300">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2D3050] text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={selected.length === users.length && users.length > 0}
                    onChange={selectAll} className="accent-primary" />
                </th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D3050]">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500">
                  <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block" />
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">No users found</td></tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="hover:bg-[#252840]/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(u.id)}
                        onChange={() => toggleSelect(u.id)} className="accent-primary" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {[u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join('').toUpperCase() || u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}</p>
                          <p className="text-xs text-slate-500">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: u.role.color + '20', color: u.role.color }}>
                          {u.role.display_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{u.company_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                        u.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#2D3050]">
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors">
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
          />
        )}
      </AnimatePresence>
    </div>
  )
}
