'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Info, CheckCircle, Bell, Clock, RefreshCw,
  Plus, Trash2, Edit2, X, BellOff, BellRing, ShieldAlert,
} from 'lucide-react'
import {
  alertsApi, alertRulesApi, myAlertRulesApi, ApiError,
} from '@/lib/api'
import type {
  Alert, AlertRule, AlertRuleWithPreference, AlertSeverity, KpiCategory,
} from '@/types/api'
import ReactECharts from 'echarts-for-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { useChartTheme } from '@/lib/chartTheme'
import { useAuthStore } from '@/stores/authStore'

type SeverityFilter = 'all' | AlertSeverity
type StatusFilter = 'all' | 'acknowledged' | 'unacknowledged'
type PageTab = 'alerts' | 'my-rules'

const SEV_ICON: Record<AlertSeverity, React.ReactNode> = {
  critical: <AlertTriangle size={16} className="text-red-400" />,
  warning:  <AlertTriangle size={16} className="text-amber-400" />,
  info:     <Info          size={16} className="text-blue-400" />,
}

const SEV_BORDER: Record<AlertSeverity, string> = {
  critical: 'border-red-500/30',
  warning:  'border-amber-500/30',
  info:     'border-blue-500/30',
}

const SEV_BADGE: Record<AlertSeverity, string> = {
  critical: 'bg-red-500/10 text-red-400',
  warning:  'bg-amber-500/10 text-amber-400',
  info:     'bg-blue-500/10 text-blue-400',
}

const COND_LABEL: Record<string, string> = { gt: '>', lt: '<', gte: '≥', lte: '≤' }

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({ alert, onAcknowledge }: { alert: Alert; onAcknowledge: (id: number) => void }) {
  const [acknowledging, setAcknowledging] = useState(false)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const { t } = useTranslation()
  const p = t.pages.alerts

  const handleAck = async () => {
    setAcknowledging(true)
    try {
      await alertsApi.acknowledge(alert.id, note)
      onAcknowledge(alert.id)
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
    } finally {
      setAcknowledging(false)
      setShowNote(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.22 }}
      className={cn('bg-[var(--surface)] border rounded-xl p-5', SEV_BORDER[alert.severity])}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5">{SEV_ICON[alert.severity]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-[var(--text-primary)] text-sm">{alert.rule.name}</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {p.metricLabels[alert.rule.metric] ?? alert.rule.metric}
                {' '}{COND_LABEL[alert.rule.condition]}{' '}{alert.rule.threshold}
              </p>
            </div>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0', SEV_BADGE[alert.severity])}>
              {alert.severity}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 text-xs">
            <div>
              <span className="text-slate-500">{p.triggeredValue}</span>
              <p className="text-red-400 font-bold">{alert.triggered_value.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-slate-500">{p.threshold}</span>
              <p className="text-slate-300 font-medium">{alert.rule.threshold}</p>
            </div>
            <div className="flex items-center gap-1 text-slate-500">
              <Clock size={11} />
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
            </div>
          </div>

          {alert.is_acknowledged && (
            <p className="mt-3 text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle size={12} />
              {p.acknowledgedBy} {alert.acknowledged_by}
              {alert.note && <> — "{alert.note}"</>}
            </p>
          )}

          {!alert.is_acknowledged && (
            <div className="mt-3">
              {showNote ? (
                <div className="flex gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={p.optionalNote}
                    className="flex-1 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary"
                  />
                  <button onClick={handleAck} disabled={acknowledging}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-60">
                    {acknowledging ? '…' : p.confirm}
                  </button>
                  <button onClick={() => setShowNote(false)} className="px-2 text-xs text-slate-500 hover:text-slate-300">×</button>
                </div>
              ) : (
                <button onClick={() => setShowNote(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">
                  <CheckCircle size={12} /> {p.acknowledge}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── KPI tree: dashboard → category → metric keys ─────────────────────────────

const KPI_TREE: Record<string, Record<KpiCategory, string[]>> = {
  parcels: {
    operations:        ['pd_ops_total_parcels','pd_ops_delivered','pd_ops_returns','pd_ops_in_transit','pd_ops_avg_duration'],
    cost_profitability:['pd_cost_fees_collected','pd_cost_total_cost','pd_cost_gross_margin','pd_cost_avg_fee','pd_cost_per_delivery'],
    performance:       ['pd_perf_delivery_rate','pd_perf_avg_attempts','pd_perf_first_attempt_rate','pd_perf_avg_duration','pd_perf_claims_count'],
  },
  transport: {
    operations:        ['tr_ops_total_requests','tr_ops_completion_rate','tr_ops_cancellation_rate','tr_ops_avg_distance','tr_ops_avg_stops'],
    cost_profitability:['tr_cost_total_revenue','tr_cost_total_cost','tr_cost_gross_margin','tr_cost_margin_pct','tr_cost_per_km'],
    performance:       ['tr_perf_on_time_rate','tr_perf_avg_duration','tr_perf_avg_rating','tr_perf_avg_delay','tr_perf_night_shift_rate'],
  },
}

const KPI_CATEGORIES: KpiCategory[] = ['operations', 'cost_profitability', 'performance']

// ─── Rule form (admin only) ────────────────────────────────────────────────────

interface RuleFormData {
  name: string
  description: string
  dashboard: string
  kpi_category: KpiCategory
  metric: string
  operator: string
  threshold: string
  severity: string
  cooldown_minutes: string
  is_active: boolean
}

function makeEmptyForm(dashboard = 'parcels'): RuleFormData {
  const cat: KpiCategory = 'operations'
  return {
    name: '', description: '',
    dashboard, kpi_category: cat,
    metric: KPI_TREE[dashboard][cat][0] ?? '',
    operator: 'lt', threshold: '', severity: 'warning',
    cooldown_minutes: '10080', is_active: true,
  }
}

function RuleFormModal({
  rule, onClose, onSaved,
}: {
  rule: AlertRule | null
  onClose: () => void
  onSaved: (r: AlertRule) => void
}) {
  const { t } = useTranslation()
  const p = t.pages.alerts

  const [form, setForm] = useState<RuleFormData>(
    rule ? {
      name: rule.name, description: rule.description,
      dashboard: rule.dashboard,
      kpi_category: rule.kpi_category,
      metric: rule.metric,
      operator: rule.operator, threshold: String(rule.threshold),
      severity: rule.severity,
      cooldown_minutes: String(rule.cooldown_minutes), is_active: rule.is_active,
    } : makeEmptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof RuleFormData>(k: K, v: RuleFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  // Cascade: dashboard change → reset category + metric
  const handleDashboardChange = (dash: string) => {
    const cat: KpiCategory = 'operations'
    const metric = KPI_TREE[dash]?.[cat]?.[0] ?? ''
    setForm((f) => ({ ...f, dashboard: dash, kpi_category: cat, metric }))
  }

  // Cascade: category change → reset metric
  const handleCategoryChange = (cat: KpiCategory) => {
    const metric = KPI_TREE[form.dashboard]?.[cat]?.[0] ?? ''
    setForm((f) => ({ ...f, kpi_category: cat, metric }))
  }

  const availableMetrics = KPI_TREE[form.dashboard]?.[form.kpi_category] ?? []

  const handleSave = async () => {
    if (!form.name.trim() || !form.threshold || !form.metric) return
    setSaving(true)
    setError(null)
    try {
      const payload: Partial<AlertRule> = {
        name: form.name,
        description: form.description,
        dashboard: form.dashboard,
        kpi_category: form.kpi_category,
        metric: form.metric,
        operator: form.operator,
        threshold: parseFloat(form.threshold),
        severity: form.severity as AlertSeverity,
        is_active: form.is_active,
        cooldown_minutes: parseInt(form.cooldown_minutes, 10) || 10080,
        notify_roles: [],
      }
      const saved = rule
        ? await alertRulesApi.update(rule.id, payload)
        : await alertRulesApi.create(payload)
      onSaved(saved)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary"
  const labelCls = "block text-xs text-slate-400 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-[var(--text-primary)]">
            {rule ? p.editRule : p.createRule}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Row 1: Dashboard (first, drives cascade) */}
          <div>
            <label className={labelCls}>{p.ruleDashboard}</label>
            <div className="flex gap-2">
              {Object.entries(p.dashboardLabels).map(([k, v]) => (
                <button
                  key={k} type="button"
                  onClick={() => handleDashboardChange(k)}
                  className={cn(
                    'flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-colors',
                    form.dashboard === k
                      ? 'bg-primary border-primary text-white'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: KPI Category (depends on dashboard) */}
          <div>
            <label className={labelCls}>{p.ruleMetric} — Catégorie</label>
            <div className="flex gap-2">
              {KPI_CATEGORIES.map((cat) => (
                <button
                  key={cat} type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={cn(
                    'flex-1 py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-colors',
                    form.kpi_category === cat
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {p.kpiCategories[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: KPI Metric (depends on dashboard + category) */}
          <div>
            <label className={labelCls}>{p.ruleMetric}</label>
            <select
              value={form.metric}
              onChange={(e) => set('metric', e.target.value)}
              className={inputCls}
            >
              {availableMetrics.map((m) => (
                <option key={m} value={m}>{p.metricLabels[m] ?? m}</option>
              ))}
            </select>
          </div>

          {/* Row 4: Name */}
          <div>
            <label className={labelCls}>{p.ruleName}</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={p.ruleNamePlaceholder}
              className={inputCls}
            />
          </div>

          {/* Row 5: Description */}
          <div>
            <label className={labelCls}>{p.ruleDescription}</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className={cn(inputCls, 'resize-none')}
            />
          </div>

          {/* Row 6: Operator + Threshold + Severity */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{p.ruleOperator}</label>
              <select value={form.operator} onChange={(e) => set('operator', e.target.value)} className={inputCls}>
                {Object.entries(p.operatorLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{p.ruleThreshold}</label>
              <input
                type="number" step="any"
                value={form.threshold}
                onChange={(e) => set('threshold', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{p.ruleSeverity}</label>
              <select value={form.severity} onChange={(e) => set('severity', e.target.value)} className={inputCls}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Row 7: Cooldown + Active */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{p.ruleCooldownMin}</label>
              <input
                type="number"
                value={form.cooldown_minutes}
                onChange={(e) => set('cooldown_minutes', e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => set('is_active', !form.is_active)}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors cursor-pointer',
                    form.is_active ? 'bg-primary' : 'bg-slate-600',
                  )}
                >
                  <div className={cn(
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    form.is_active ? 'translate-x-5' : 'translate-x-0.5',
                  )} />
                </div>
                <span className="text-sm text-[var(--text-secondary)]">{p.ruleActive}</span>
              </label>
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
            {p.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.threshold || !form.metric}
            className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? '…' : p.save}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── My rules tab ─────────────────────────────────────────────────────────────

function MyRulesTab({
  isSuperAdmin, onEditRule,
}: {
  isSuperAdmin: boolean
  onEditRule: (r: AlertRule) => void
}) {
  const { t } = useTranslation()
  const p = t.pages.alerts
  const [rules, setRules] = useState<AlertRuleWithPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRules(await myAlertRulesApi.list())
    } catch { /* silently degrade */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (rule: AlertRuleWithPreference) => {
    setToggling(rule.id)
    try {
      const pref = await myAlertRulesApi.setSubscription(rule.id, !rule.is_subscribed)
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_subscribed: pref.is_subscribed } : r))
    } catch { /* ignore */ } finally { setToggling(null) }
  }

  const handleDelete = async (rule: AlertRule) => {
    if (!confirm(p.deleteConfirm)) return
    setDeleting(rule.id)
    try {
      await alertRulesApi.delete(rule.id)
      setRules((prev) => prev.filter((r) => r.id !== rule.id))
    } catch { /* ignore */ } finally { setDeleting(null) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-14 text-slate-500">
        <Bell size={32} className="mx-auto mb-3 opacity-30" />
        <p>{p.noRules}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 mb-4">{p.subscriptionNote}</p>
      {rules.map((rule) => (
        <motion.div
          key={rule.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'bg-[var(--surface)] border rounded-xl p-4 transition-opacity',
            !rule.is_subscribed && 'opacity-50',
            SEV_BORDER[rule.severity],
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{SEV_ICON[rule.severity]}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-[var(--text-primary)] text-sm">{rule.name}</h4>
                    {rule.is_default && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {p.defaultRule}
                      </span>
                    )}
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize', SEV_BADGE[rule.severity])}>
                      {rule.severity}
                    </span>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      rule.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400')}>
                      {rule.is_active ? p.ruleActive : p.rulePaused}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {p.dashboardLabels[rule.dashboard] ?? rule.dashboard}
                    {' · '}{p.kpiCategories[rule.kpi_category] ?? rule.kpi_category}
                    {' · '}{p.metricLabels[rule.metric] ?? rule.metric}
                    {' '}{COND_LABEL[rule.operator]}{' '}{rule.threshold}
                    {' · '}{p.cooldown} {rule.cooldown_minutes}m
                  </p>
                  {rule.description && (
                    <p className="text-xs text-slate-600 mt-1">{rule.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Subscribe toggle */}
                  <button
                    onClick={() => handleToggle(rule)}
                    disabled={toggling === rule.id}
                    title={rule.is_subscribed ? p.unsubscribe : p.subscribe}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                      rule.is_subscribed
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20',
                      toggling === rule.id && 'opacity-60 pointer-events-none',
                    )}
                  >
                    {toggling === rule.id
                      ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      : rule.is_subscribed
                        ? <BellRing size={12} />
                        : <BellOff size={12} />
                    }
                    {rule.is_subscribed ? p.subscribed : p.unsubscribed}
                  </button>

                  {/* Admin actions */}
                  {isSuperAdmin && (
                    <>
                      <button onClick={() => onEditRule(rule)}
                        className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors" title={p.editRule}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(rule)}
                        disabled={deleting === rule.id}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors" title={p.deleteRule}>
                        {deleting === rule.id
                          ? <span className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                          : <Trash2 size={13} />
                        }
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.is_superuser ?? false

  const [tab, setTab] = useState<PageTab>('alerts')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [sevFilter, setSevFilter] = useState<SeverityFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unacknowledged')
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const { t } = useTranslation()
  const p = t.pages.alerts
  const chartT = useChartTheme()

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    try {
      setAlerts(await alertsApi.list())
    } catch { /* silently degrade */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAlerts() }, [loadAlerts])

  const handleAcknowledge = (id: number) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_acknowledged: true } : a))
  }

  const handleRuleSaved = (rule: AlertRule) => {
    setShowForm(false)
    setEditingRule(null)
    // Switch to rules tab after creating/editing
    setTab('my-rules')
  }

  const filtered = alerts.filter((a) => {
    const sev = sevFilter === 'all' || a.severity === sevFilter
    const st =
      statusFilter === 'all' ||
      (statusFilter === 'acknowledged' && a.is_acknowledged) ||
      (statusFilter === 'unacknowledged' && !a.is_acknowledged)
    return sev && st
  })

  const sevCounts = { critical: 0, warning: 0, info: 0 }
  alerts.forEach((a) => { sevCounts[a.severity as AlertSeverity]++ })

  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: chartT.tooltipBg,
      borderColor: chartT.borderColor,
      textStyle: { color: chartT.textColor, fontSize: 12 },
    },
    series: [{
      type: 'pie',
      radius: ['50%', '75%'],
      data: [
        { value: sevCounts.critical, name: 'Critical', itemStyle: { color: '#EF4444' } },
        { value: sevCounts.warning,  name: 'Warning',  itemStyle: { color: '#F59E0B' } },
        { value: sevCounts.info,     name: 'Info',     itemStyle: { color: '#3B82F6' } },
      ],
      label: { show: true, color: chartT.legendColor, fontSize: 11 },
    }],
  }

  const SEV_FILTER_LABELS: Record<SeverityFilter, string> = {
    all: p.allSeverity, critical: 'Critical', warning: 'Warning', info: 'Info',
  }
  const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
    all: p.allSeverity, unacknowledged: p.unacknowledged, acknowledged: p.acknowledged,
  }

  return (
    <div className="space-y-6">
      {/* Header tabs + create button */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-0.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
          {(['alerts', 'my-rules'] as PageTab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5',
                tab === t ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200',
              )}>
              {t === 'alerts'
                ? <><ShieldAlert size={12} />{p.tabAlerts}</>
                : <><Bell size={12} />{p.tabMyRules}</>
              }
            </button>
          ))}
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => { setEditingRule(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> {p.createRule}
          </button>
        )}
      </div>

      {/* ── Alerts tab ────────────────────────────────────────────────── */}
      {tab === 'alerts' && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: p.allSeverity,    value: alerts.length,                                  color: 'text-white' },
              { label: 'Critical',       value: sevCounts.critical,                             color: 'text-red-400' },
              { label: 'Warning',        value: sevCounts.warning,                              color: 'text-amber-400' },
              { label: p.unacknowledged, value: alerts.filter((a) => !a.is_acknowledged).length, color: 'text-primary' },
            ].map((stat) => (
              <div key={stat.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs text-slate-400">{stat.label}</p>
                <p className={cn('text-2xl font-bold mt-1', stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 max-w-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{p.distribution}</h3>
            {alerts.length > 0
              ? <ReactECharts option={chartOption} style={{ height: 180 }} notMerge />
              : <div className="h-[180px] flex items-center justify-center text-slate-600 text-sm">{p.noAlerts}</div>
            }
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-0.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
              {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map((s) => (
                <button key={s} onClick={() => setSevFilter(s)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors',
                    sevFilter === s ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200')}>
                  {SEV_FILTER_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
              {(['all', 'unacknowledged', 'acknowledged'] as StatusFilter[]).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors',
                    statusFilter === s ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200')}>
                  {STATUS_FILTER_LABELS[s]}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500 ml-auto">{filtered.length}</span>
            <button onClick={loadAlerts} disabled={loading}
              className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Alert cards */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <AnimatePresence>
                {filtered.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} onAcknowledge={handleAcknowledge} />
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-14 text-slate-500">
                    <Bell size={32} className="mx-auto mb-3 opacity-30" />
                    <p>{p.noAlerts}</p>
                  </div>
                )}
              </AnimatePresence>
            )}
          </div>
        </>
      )}

      {/* ── My rules tab ──────────────────────────────────────────────── */}
      {tab === 'my-rules' && (
        <MyRulesTab
          isSuperAdmin={isSuperAdmin}
          onEditRule={(rule) => { setEditingRule(rule); setShowForm(true) }}
        />
      )}

      {/* ── Rule create/edit modal ────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <RuleFormModal
            rule={editingRule}
            onClose={() => { setShowForm(false); setEditingRule(null) }}
            onSaved={handleRuleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
