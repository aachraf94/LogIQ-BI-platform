'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  User, Bell, Bookmark, Clock, Megaphone,
  Monitor, Save, Plus, Trash2, Share2, Laptop, Smartphone,
} from 'lucide-react'
import { meApi, announcementsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from '@/lib/i18n'
import type { UserPreferences, LoginSession, DashboardBookmark, Announcement } from '@/types/api'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'

type Tab = 'profile' | 'preferences' | 'sessions' | 'bookmarks' | 'announcements'

// ─── Profile ──────────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useAuthStore()
  const { t } = useTranslation()
  if (!user) return null

  const fields = [
    { label: t.settings.profile.username,   value: user.username },
    { label: t.settings.profile.email,      value: user.email || '—' },
    { label: t.settings.profile.firstName,  value: user.first_name || '—' },
    { label: t.settings.profile.lastName,   value: user.last_name || '—' },
    { label: t.settings.profile.phone,      value: user.phone || '—' },
    { label: t.settings.profile.department, value: user.department || '—' },
    { label: t.settings.profile.company,    value: user.company_name || '—' },
    { label: t.settings.profile.agency,     value: user.agence_name || '—' },
  ]

  const DASHBOARD_LABELS: Record<string, string> = {
    overview: t.dashboard.overview,
    transport: t.dashboard.transport,
    parcels: t.dashboard.parcels,
    routes: t.dashboard.routes,
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--border)]">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold">
            {[user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join('').toUpperCase() || user.username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-[var(--text-primary)] font-semibold">
              {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {user.role?.display_name ?? (user.is_superuser ? t.roles.superadmin : t.roles.noRole)}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {t.settings.profile.memberSince} {format(new Date(user.date_joined), 'MMM yyyy')}
            </p>
          </div>
        </div>
        <p className="text-xs text-amber-500 dark:text-amber-400 mb-4 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
          {t.settings.profile.hrforceManagedNotice}
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">{f.label}</p>
              <p className="text-sm text-[var(--text-primary)] font-medium">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{t.settings.profile.accessibleDashboards}</h4>
        <div className="flex flex-wrap gap-2">
          {user.accessible_dashboards.length === 0
            ? <p className="text-xs text-[var(--text-muted)]">{t.settings.profile.noDashboards}</p>
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
  const { setTheme } = useTheme()
  const { t } = useTranslation()
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
      setTheme(updated.theme ?? 'dark')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* silently ignore */ } finally { setSaving(false) }
  }

  const THEME_LABELS: Record<'dark' | 'light' | 'system', string> = {
    dark: t.settings.preferences.themeDark,
    light: t.settings.preferences.themeLight,
    system: t.settings.preferences.themeSystem,
  }

  const notifToggles: { key: keyof UserPreferences; label: string; desc: string }[] = [
    { key: 'notif_in_app',         label: t.settings.preferences.notifInApp,          desc: t.settings.preferences.notifInAppDesc },
    { key: 'notif_alert_triggered', label: t.settings.preferences.notifAlerts,        desc: t.settings.preferences.notifAlertsDesc },
    { key: 'notif_etl_status',     label: t.settings.preferences.notifEtl,            desc: t.settings.preferences.notifEtlDesc },
    { key: 'notif_announcements',  label: t.settings.preferences.notifAnnouncements,  desc: t.settings.preferences.notifAnnouncementsDesc },
    { key: 'notif_email',          label: t.settings.preferences.notifEmail,          desc: t.settings.preferences.notifEmailDesc },
  ]

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t.settings.preferences.display}</h4>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1.5">{t.settings.preferences.theme}</label>
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as const).map((themeKey) => (
                <button
                  key={themeKey}
                  onClick={() => {
                    setPrefs((p) => p ? { ...p, theme: themeKey } : p)
                  }}
                  className={cn(
                    'flex-1 py-2 text-xs font-medium rounded-lg border transition-colors',
                    prefs.theme === themeKey
                      ? 'bg-primary border-primary text-white'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  )}
                >
                  {THEME_LABELS[themeKey]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1.5">{t.settings.preferences.language}</label>
            <select
              value={prefs.language}
              onChange={(e) => {
                const lang = e.target.value
                setPrefs((p) => p ? { ...p, language: lang } : p)
              }}
              className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary"
            >
              <option value="fr">🇫🇷 Français</option>
              <option value="en">🇬🇧 English</option>
              <option value="ar">🇩🇿 العربية</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Bell size={14} className="text-primary" /> {t.settings.preferences.notifications}
        </h4>
        <div className="space-y-3">
          {notifToggles.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-3 bg-[var(--surface-secondary)] rounded-lg">
              <div>
                <p className="text-sm text-[var(--text-primary)] font-medium">{label}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => toggle(key)}
                className={cn('relative w-10 h-5 rounded-full transition-colors shrink-0 ml-4', prefs[key] ? 'bg-primary' : 'bg-[var(--toggle-off)]')}
              >
                <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', prefs[key] ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60"
      >
        {saving
          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <Save size={15} />}
        {saved ? t.settings.preferences.saved : saving ? t.settings.preferences.saving : t.settings.preferences.saveButton}
      </button>
    </div>
  )
}

// ─── Sessions ────────────────────────────────────────────────────────────────

function SessionsTab() {
  const [sessions, setSessions] = useState<LoginSession[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    meApi.getSessions().then(setSessions).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-3">
      {sessions.length === 0
        ? <p className="text-[var(--text-muted)] text-sm">{t.settings.sessions.noSessions}</p>
        : sessions.map((s) => (
          <div key={s.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4">
            <div className="p-2.5 bg-[var(--surface-secondary)] rounded-lg text-[var(--text-secondary)]">
              {s.device_type === 'mobile' ? <Smartphone size={18} /> : <Laptop size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">{s.browser} on {s.os}</p>
                {s.is_active && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 rounded-full">
                    {t.settings.sessions.current}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
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
  const { t } = useTranslation()
  const [bookmarks, setBookmarks] = useState<DashboardBookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', dashboard: 'overview', emoji: '📌', is_shared: false })

  const DASHBOARD_LABELS: Record<string, string> = {
    overview: t.dashboard.overview,
    transport: t.dashboard.transport,
    parcels: t.dashboard.parcels,
    routes: t.dashboard.routes,
  }

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
    try {
      await meApi.deleteBookmark(id)
      setBookmarks((b) => b.filter((bk) => bk.id !== id))
    } catch { /* ignore */ }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">{t.settings.bookmarks.title}</h4>
        <button
          onClick={() => setCreating((c) => !c)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Plus size={14} /> {t.settings.bookmarks.new}
        </button>
      </div>

      {creating && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleCreate}
          className="bg-[var(--surface)] border border-primary/30 rounded-xl p-4 space-y-3"
        >
          <div className="flex gap-3">
            <input
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              className="w-14 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-2 py-2 text-center text-sm focus:outline-none focus:border-primary"
              maxLength={2}
            />
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t.settings.bookmarks.namePlaceholder}
              required
              className="flex-1 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-3 items-center">
            <select
              value={form.dashboard}
              onChange={(e) => setForm((f) => ({ ...f, dashboard: e.target.value }))}
              className="flex-1 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary"
            >
              {Object.entries(DASHBOARD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={form.is_shared}
                onChange={(e) => setForm((f) => ({ ...f, is_shared: e.target.checked }))}
                className="accent-primary"
              />
              {t.settings.bookmarks.shareTeam}
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {t.settings.bookmarks.cancel}
            </button>
            <button type="submit" className="px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/80">
              {t.settings.bookmarks.save}
            </button>
          </div>
        </motion.form>
      )}

      {bookmarks.length === 0
        ? <p className="text-[var(--text-muted)] text-sm">{t.settings.bookmarks.noBookmarks}</p>
        : bookmarks.map((bk) => (
          <div key={bk.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
            <span className="text-xl">{bk.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">{bk.name}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {DASHBOARD_LABELS[bk.dashboard] ?? bk.dashboard}
                {bk.owner_name && bk.owner_name !== (user?.username ?? '') && ` · by ${bk.owner_name}`}
              </p>
            </div>
            {bk.is_shared && (
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 rounded-full flex items-center gap-1">
                <Share2 size={10} /> {t.settings.bookmarks.shared}
              </span>
            )}
            {(!bk.owner_name || bk.owner_name === (user?.username ?? '')) && (
              <button onClick={() => handleDelete(bk.id)} className="p-1.5 text-[var(--text-muted)] hover:text-red-500 transition-colors">
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
  const { t } = useTranslation()

  useEffect(() => {
    announcementsApi.list().then(setAnnouncements).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const LEVEL_STYLES: Record<string, string> = {
    info: 'border-l-blue-500', warning: 'border-l-amber-500', critical: 'border-l-red-500',
  }
  const LEVEL_BADGE: Record<string, string> = {
    info: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
    warning: 'bg-amber-500/10 text-amber-500 dark:text-amber-400',
    critical: 'bg-red-500/10 text-red-500 dark:text-red-400',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-3">
      {announcements.length === 0
        ? <p className="text-[var(--text-muted)] text-sm">{t.settings.announcements.noAnnouncements}</p>
        : announcements.map((a) => (
          <div key={a.id} className={cn('bg-[var(--surface)] border border-[var(--border)] border-l-4 rounded-xl p-5', LEVEL_STYLES[a.level])}>
            <div className="flex items-center gap-2 mb-1">
              {a.is_pinned && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                  {t.settings.announcements.pinned}
                </span>
              )}
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize', LEVEL_BADGE[a.level])}>
                {a.level}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{a.title}</h4>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{a.body}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-3">
              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
            </p>
          </div>
        ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const { t } = useTranslation()

  const TABS: { id: Tab; labelKey: keyof typeof t.settings.tabs; icon: React.ElementType }[] = [
    { id: 'profile',       labelKey: 'profile',       icon: User },
    { id: 'preferences',   labelKey: 'preferences',   icon: Monitor },
    { id: 'sessions',      labelKey: 'sessions',       icon: Clock },
    { id: 'bookmarks',     labelKey: 'bookmarks',      icon: Bookmark },
    { id: 'announcements', labelKey: 'announcements',  icon: Megaphone },
  ]

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1.5 w-fit overflow-x-auto">
        {TABS.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === id
                ? 'bg-primary text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <Icon size={14} />{t.settings.tabs[labelKey]}
          </button>
        ))}
      </div>
      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === 'profile'       && <ProfileTab />}
        {activeTab === 'preferences'   && <PreferencesTab />}
        {activeTab === 'sessions'      && <SessionsTab />}
        {activeTab === 'bookmarks'     && <BookmarksTab />}
        {activeTab === 'announcements' && <AnnouncementsTab />}
      </motion.div>
    </div>
  )
}
