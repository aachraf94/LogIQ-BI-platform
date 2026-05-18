'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Shield, X, Save, Lock } from 'lucide-react'
import { adminRolesApi, ApiError } from '@/lib/api'
import type { Role } from '@/types/api'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const DASHBOARD_OPTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'transport', label: 'Transport' },
  { key: 'parcels', label: 'Parcel Costs' },
  { key: 'routes', label: 'Route Analysis' },
]

const PALETTE = [
  '#6366F1', '#22D3EE', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#64748B',
]

function RoleForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Role
  onSave: (role: Role) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [displayName, setDisplayName] = useState(initial?.display_name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [dashboards, setDashboards] = useState<string[]>(initial?.dashboards ?? [])
  const [color, setColor] = useState(initial?.color ?? '#6366F1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleDashboard = (key: string) =>
    setDashboards((d) => d.includes(key) ? d.filter((x) => x !== key) : [...d, key])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let role: Role
      if (initial) {
        role = await adminRolesApi.update(initial.id, { display_name: displayName, description, dashboards, color })
      } else {
        role = await adminRolesApi.create({ name, display_name: displayName, description, dashboards, color })
      }
      onSave(role)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{initial ? 'Edit Role' : 'New Role'}</h3>
        <button type="button" onClick={onCancel} className="p-1 text-slate-500 hover:text-slate-300"><X size={15} /></button>
      </div>

      {!initial && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">Role Key (snake_case, unique)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. responsable_finance"
            required pattern="[a-z_]+" className="w-full bg-[#252840] border border-[#2D3050] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary" />
        </div>
      )}

      <div>
        <label className="text-xs text-slate-400 block mb-1">Display Name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required
          placeholder="e.g. Responsable Finance"
          className="w-full bg-[#252840] border border-[#2D3050] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary" />
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-1">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this role"
          className="w-full bg-[#252840] border border-[#2D3050] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary" />
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-2">Dashboard Access</label>
        <div className="flex flex-wrap gap-2">
          {DASHBOARD_OPTIONS.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => toggleDashboard(key)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                dashboards.includes(key)
                  ? 'bg-primary border-primary text-white'
                  : 'border-[#2D3050] text-slate-400 hover:text-slate-200')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-2">Color</label>
        <div className="flex gap-2 flex-wrap">
          {PALETTE.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={cn('w-7 h-7 rounded-full transition-transform', color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1E2030] scale-110' : 'hover:scale-105')} />
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/80 disabled:opacity-60">
          {saving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={13} />}
          {saving ? 'Saving…' : 'Save Role'}
        </button>
      </div>
    </form>
  )
}

export default function AdminRolesPage() {
  const router = useRouter()
  const { user: me } = useAuthStore()
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)

  useEffect(() => {
    if (me && !me.is_superuser) router.replace('/overview')
  }, [me, router])

  useEffect(() => {
    adminRolesApi.list().then(setRoles).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleDelete = async (role: Role) => {
    if (role.is_system) return
    if (!confirm(`Delete role "${role.display_name}"? All users will be unassigned.`)) return
    try {
      await adminRolesApi.delete(role.id)
      setRoles((r) => r.filter((x) => x.id !== role.id))
    } catch { /* ignore */ }
  }

  const handleSaved = (role: Role) => {
    if (editing) {
      setRoles((r) => r.map((x) => x.id === role.id ? role : x))
      setEditing(null)
    } else {
      setRoles((r) => [...r, role])
      setCreating(false)
    }
  }

  if (!me?.is_superuser) return null

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Role Management</h2>
          <p className="text-sm text-slate-400 mt-0.5">{roles.length} roles — system roles cannot be deleted</p>
        </div>
        <button onClick={() => { setCreating(true); setEditing(null) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/80 transition-colors">
          <Plus size={15} /> New Role
        </button>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <RoleForm onSave={handleSaved} onCancel={() => setCreating(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id}>
              <AnimatePresence>
                {editing?.id === role.id ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <RoleForm initial={role} onSave={handleSaved} onCancel={() => setEditing(null)} />
                  </motion.div>
                ) : (
                  <motion.div layout className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: role.color + '20' }}>
                      <Shield size={18} style={{ color: role.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white">{role.display_name}</h3>
                        {role.is_system && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                            <Lock size={9} /> System
                          </span>
                        )}
                        <span className="text-xs text-slate-600">key: {role.name}</span>
                      </div>
                      {role.description && <p className="text-xs text-slate-400 mt-1">{role.description}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {role.dashboards.map((d) => (
                          <span key={d} className="text-[10px] px-2 py-0.5 bg-[#252840] text-slate-400 rounded-full capitalize">{d}</span>
                        ))}
                      </div>
                      {role.user_count !== undefined && (
                        <p className="text-xs text-slate-600 mt-1">{role.user_count} user{role.user_count !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditing(role)}
                        className="p-2 text-slate-500 hover:text-slate-300 transition-colors">
                        <Pencil size={14} />
                      </button>
                      {!role.is_system && (
                        <button onClick={() => handleDelete(role)}
                          className="p-2 text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
