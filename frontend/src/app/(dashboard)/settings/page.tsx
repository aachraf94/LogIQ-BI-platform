'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  User, Bell, Bookmark, Clock, Megaphone,
  Monitor, Save, Plus, Trash2, Share2, Laptop, Smartphone,
} from 'lucide-react'
import { meApi, announcementsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type { UserPreferences, LoginSession, DashboardBookmark, Announcement } from '@/types/api'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'

type Tab = 'profile' | 'preferences' | 'sessions' | 'bookmarks' | 'announcements'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'preferences', label: 'Preferences', icon: Monitor },
  { id: 'sessions', label: 'Sessions', icon: Clock },
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
]

const DASHBOARD_LABELS: Record<string, string> = {
  overview: 'Overview', transport: 'Transport', parcels: 'Parcel Costs', routes: 'Routes',
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useAuthStore()
  if (!user) return null
  const fields = [
    { label: 'Username', value: user.username },
    { label: 'Email', value: user.email || '—' },
    { label: 'First Name', value: user.first_name || '—' },
    { label: 'Last Name', value: user.last_name || '—' },
    { label: 'Phone', value: user.phone || '—' },
    { label: 'Department', value: user.department || '—' },
    { label: 'Company', value: user.company_name || '—' },
    { label: 'Agency', value: user.agence_name || '—' },
  ]
  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#2D3050]">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold">
            {[user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join('').toUpperCase() || user.username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-white font-semibold">
              {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
            </p>
            <p className="text-sm text-slate-400 mt-0.5">
              {user.role?.display_name ?? (user.is_superuser ? 'Superadmin' : 'No role assigned')}
            </p>
            <p className="text-xs text-slate-600 mt-1">Member since {format(new Date(user.date_joined), 'MMM yyyy')}</p>
          </div>
        </div>
        <p className="text-xs text-amber-400/80 mb-4 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Profile is managed by HRForce and cannot be edited here.
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-slate-500 mb-0.5">{f.label}</p>
              <p className="text-sm text-slate-200 font-medium">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
        <h4 className="text-sm font-semibold text-white mb-3">Accessible Dashboards</h4>
        <div className="flex flex-wrap gap-2">
          {user.accessible_dashboards.length === 0
            ? <p className="text-xs text-slate-500">No dashboards assigned</p>
            : user.accessible_dashboards.map((d) => (
                <span key={d} className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
                  {DASHBOARD_LABELS[d] ?? d}
                </span>
              ))}
        </div>
      </div>
    </div>
  )
}

// ─── Preferences ─────────────────────────────────────────────────────────────

function PreferencesTab() {
  const { updateUser } = useAuthStore()
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { meApi.getPreferences().then(setPrefs).catch(() => {}) }, [])

  if (!prefs) return (
    <div className="flex items-center justify-center h-40">
      <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  )

  const toggle = (key: keyof UserPreferences) =>
    setPrefs((p) => p ? { ...p, [key]: !p[key as keyof UserPreferences] } : p)

  const handleSave = async () => {
    if (!prefs) return
    setSaving(true)
    try {
      const updated = await meApi.updatePreferences(prefs)
      setPrefs(updated)
      updateUser({ preferences: updated })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* silently ignore */ } finally { setSaving(false) }
  }

  const notifToggles: { key: keyof UserPreferences; label: string; desc: string }[] = [
    { key: 'notif_in_app', label: 'In-App Notifications', desc: 'Show notifications inside the platform' },
    { key: 'notif_alert_triggered', label: 'Alert Notifications', desc: 'In-app alerts when KPI thresholds are breached' },
    { key: 'notif_etl_status', label: 'ETL Status', desc: 'Notify when data pipelines complete or fail' },
    { key: 'notif_announcements', label: 'Announcements', desc: 'Platform announcements from the admin team' },
    { key: 'notif_email', label: 'Email Digest', desc: 'Daily summary via email' },
  ]

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
        <h4 className="text-sm font-semibold text-white mb-4">Display</h4>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Theme</label>
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button key={t} onClick={() => setPrefs((p) => p ? { ...p, theme: t } : p)}
                  className={cn('flex-1 py-2 text-xs font-medium rounded-lg border transition-colors capitalize',
                    prefs.theme === t ? 'bg-primary border-primary text-white' : 'border-[#2D3050] text-slate-400 hover:text-slate-200')}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Language</label>
            <select value={prefs.language} onChange={(e) => setPrefs((p) => p ? { ...p, language: e.target.value } : p)}
              className="w-full bg-[#252840] border border-[#2D3050] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-primary">
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </div>
      </div>
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
        <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Bell size={14} className="text-primary" /> Notification Channels
        </h4>
        <div className="space-y-3">
          {notifToggles.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-3 bg-[#252840] rounded-lg">
              <div>
                <p className="text-sm text-white font-medium">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
              <button onClick={() => toggle(key)}
                className={cn('relative w-10 h-5 rounded-full transition-colors shrink-0 ml-4', prefs[key] ? 'bg-primary' : 'bg-[#3D4267]')}>
                <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', prefs[key] ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60">
        {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
        {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Preferences'}
      </button>
    </div>
  )
}

// ─── Sessions ────────────────────────────────────────────────────────────────

function SessionsTab() {
  const [sessions, setSessions] = useState<LoginSession[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    meApi.getSessions().then(setSessions).catch(() => {}).finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="flex items-center justify-center h-40"><span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
  return (
    <div className="max-w-2xl space-y-3">
      {sessions.length === 0 ? <p className="text-slate-500 text-sm">No sessions found.</p>
        : sessions.map((s) => (
          <div key={s.id} className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-4 flex items-center gap-4">
            <div className="p-2.5 bg-[#252840] rounded-lg text-slate-400">
              {s.device_type === 'mobile' ? <Smartphone size={18} /> : <Laptop size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{s.browser} on {s.os}</p>
                {s.is_active && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">Current</span>}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {s.ip_address} · {format(new Date(s.logged_in_at), 'dd MMM yyyy, HH:mm')}
                {s.duration_minutes != null && ` · ${s.duration_minutes}m`}
              </p>
            </div>
          </div>
        ))}
    </div>
  )
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

function BookmarksTab() {
  const { user } = useAuthStore()
  const [bookmarks, setBookmarks] = useState<DashboardBookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', dashboard: 'overview', emoji: '📌', is_shared: false })

  const load = useCallback(() => {
    meApi.getBookmarks().then(setBookmarks).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const bk = await meApi.createBookmark({ ...form, filters: {} })
      setBookmarks((b) => [bk, ...b])
      setCreating(false)
      setForm({ name: '', dashboard: 'overview', emoji: '📌', is_shared: false })
    } catch { /* silently ignore */ }
  }

  const handleDelete = async (id: number) => {
    try { await meApi.deleteBookmark(id); setBookmarks((b) => b.filter((bk) => bk.id !== id)) } catch { /* ignore */ }
  }

  if (loading) return <div className="flex items-center justify-center h-40"><span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">Saved Bookmarks</h4>
        <button onClick={() => setCreating((c) => !c)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          <Plus size={14} /> New Bookmark
        </button>
      </div>
      {creating && (
        <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleCreate}
          className="bg-[#1E2030] border border-primary/30 rounded-xl p-4 space-y-3">
          <div className="flex gap-3">
            <input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              className="w-14 bg-[#252840] border border-[#2D3050] rounded-lg px-2 py-2 text-center text-sm focus:outline-none focus:border-primary" maxLength={2} />
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Bookmark name" required
              className="flex-1 bg-[#252840] border border-[#2D3050] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-3 items-center">
            <select value={form.dashboard} onChange={(e) => setForm((f) => ({ ...f, dashboard: e.target.value }))}
              className="flex-1 bg-[#252840] border border-[#2D3050] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary">
              {Object.entries(DASHBOARD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={form.is_shared} onChange={(e) => setForm((f) => ({ ...f, is_shared: e.target.checked }))} className="accent-primary" />
              Share with team
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
            <button type="submit" className="px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/80">Save</button>
          </div>
        </motion.form>
      )}
      {bookmarks.length === 0 ? <p className="text-slate-500 text-sm">No bookmarks yet.</p>
        : bookmarks.map((bk) => (
          <div key={bk.id} className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-4 flex items-center gap-3">
            <span className="text-xl">{bk.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{bk.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {DASHBOARD_LABELS[bk.dashboard] ?? bk.dashboard}
                {bk.owner_name && bk.owner_name !== (user?.username ?? '') && ` · by ${bk.owner_name}`}
              </p>
            </div>
            {bk.is_shared && (
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center gap-1">
                <Share2 size={10} /> Shared
              </span>
            )}
            {(!bk.owner_name || bk.owner_name === (user?.username ?? '')) && (
              <button onClick={() => handleDelete(bk.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
    </div>
  )
}

// ─── Announcements ────────────────────────────────────────────────────────────

function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    announcementsApi.list().then(setAnnouncements).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const LEVEL_STYLES: Record<string, string> = {
    info: 'border-l-blue-500', warning: 'border-l-amber-500', critical: 'border-l-red-500',
  }
  const LEVEL_BADGE: Record<string, string> = {
    info: 'bg-blue-500/10 text-blue-400', warning: 'bg-amber-500/10 text-amber-400', critical: 'bg-red-500/10 text-red-400',
  }

  if (loading) return <div className="flex items-center justify-center h-40"><span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>

  return (
    <div className="max-w-2xl space-y-3">
      {announcements.length === 0 ? <p className="text-slate-500 text-sm">No active announcements.</p>
        : announcements.map((a) => (
          <div key={a.id} className={cn('bg-[#1E2030] border border-[#2D3050] border-l-4 rounded-xl p-5', LEVEL_STYLES[a.level])}>
            <div className="flex items-center gap-2 mb-1">
              {a.is_pinned && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">Pinned</span>}
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize', LEVEL_BADGE[a.level])}>{a.level}</span>
            </div>
            <h4 className="text-sm font-semibold text-white">{a.title}</h4>
            <p className="text-xs text-slate-400 mt-1">{a.body}</p>
            <p className="text-[11px] text-slate-600 mt-3">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
          </div>
        ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-[#1E2030] border border-[#2D3050] rounded-xl p-1.5 w-fit overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === id ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200')}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>
      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'preferences' && <PreferencesTab />}
        {activeTab === 'sessions' && <SessionsTab />}
        {activeTab === 'bookmarks' && <BookmarksTab />}
        {activeTab === 'announcements' && <AnnouncementsTab />}
      </motion.div>
    </div>
  )
}
