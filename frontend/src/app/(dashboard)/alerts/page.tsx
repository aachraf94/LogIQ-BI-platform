'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Info, CheckCircle, Bell, Clock, RefreshCw } from 'lucide-react'
import { alertsApi, alertRulesApi, ApiError } from '@/lib/api'
import type { Alert, AlertRule, AlertSeverity } from '@/types/api'
import ReactECharts from 'echarts-for-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { useChartTheme } from '@/lib/chartTheme'

type SeverityFilter = 'all' | AlertSeverity
type StatusFilter = 'all' | 'acknowledged' | 'unacknowledged'

const SEV_ICON: Record<AlertSeverity, React.ReactNode> = {
  critical: <AlertTriangle size={16} className="text-red-400" />,
  warning: <AlertTriangle size={16} className="text-amber-400" />,
  info: <Info size={16} className="text-blue-400" />,
}

const SEV_BORDER: Record<AlertSeverity, string> = {
  critical: 'border-red-500/30',
  warning: 'border-amber-500/30',
  info: 'border-blue-500/30',
}

const SEV_BADGE: Record<AlertSeverity, string> = {
  critical: 'bg-red-500/10 text-red-400',
  warning: 'bg-amber-500/10 text-amber-400',
  info: 'bg-blue-500/10 text-blue-400',
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

// ─── Rules table ──────────────────────────────────────────────────────────────

function RulesSection({ rules }: { rules: AlertRule[] }) {
  const { t } = useTranslation()
  const p = t.pages.alerts
  if (rules.length === 0) return null
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{p.alertRules}</h3>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-4 px-5 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-primary)] font-medium">{r.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {p.metricLabels[r.metric] ?? r.metric} {COND_LABEL[r.condition]} {r.threshold}
                {' · '}{p.cooldown} {r.cooldown_minutes}m
              </p>
            </div>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', SEV_BADGE[r.severity])}>
              {r.severity}
            </span>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
              r.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400')}>
              {r.is_active ? p.ruleActive : p.rulePaused}
            </span>
            <span className="text-xs text-slate-600">
              {r.trigger_count}{p.fired}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [sevFilter, setSevFilter] = useState<SeverityFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unacknowledged')
  const { t } = useTranslation()
  const p = t.pages.alerts
  const chartT = useChartTheme()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, r] = await Promise.all([alertsApi.list(), alertRulesApi.list()])
      setAlerts(a)
      setRules(r)
    } catch { /* silently degrade */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAcknowledge = (id: number) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_acknowledged: true } : a))
  }

  const filtered = alerts.filter((a) => {
    const sev = sevFilter === 'all' || a.severity === sevFilter
    const status =
      statusFilter === 'all' ||
      (statusFilter === 'acknowledged' && a.is_acknowledged) ||
      (statusFilter === 'unacknowledged' && !a.is_acknowledged)
    return sev && status
  })

  const sevCounts = { critical: 0, warning: 0, info: 0 }
  alerts.forEach((a) => { sevCounts[a.severity]++ })

  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: chartT.tooltipBg, borderColor: chartT.borderColor, textStyle: { color: chartT.textColor, fontSize: 12 } },
    series: [{
      type: 'pie',
      radius: ['50%', '75%'],
      data: [
        { value: sevCounts.critical, name: 'Critical', itemStyle: { color: '#EF4444' } },
        { value: sevCounts.warning, name: 'Warning', itemStyle: { color: '#F59E0B' } },
        { value: sevCounts.info, name: 'Info', itemStyle: { color: '#3B82F6' } },
      ],
      label: { show: true, color: chartT.legendColor, fontSize: 11 },
    }],
  }

  const SEV_FILTER_LABELS: Record<SeverityFilter, string> = {
    all: p.allSeverity,
    critical: 'Critical',
    warning: 'Warning',
    info: 'Info',
  }

  const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
    all: p.allSeverity,
    unacknowledged: p.unacknowledged,
    acknowledged: p.acknowledged,
  }

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: p.allSeverity, value: alerts.length, color: 'text-white' },
          { label: 'Critical', value: sevCounts.critical, color: 'text-red-400' },
          { label: 'Warning', value: sevCounts.warning, color: 'text-amber-400' },
          { label: p.unacknowledged, value: alerts.filter((a) => !a.is_acknowledged).length, color: 'text-primary' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs text-slate-400">{stat.label}</p>
            <p className={cn('text-2xl font-bold mt-1', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Chart + rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{p.distribution}</h3>
          {alerts.length > 0
            ? <ReactECharts option={chartOption} style={{ height: 180 }} notMerge />
            : <div className="h-[180px] flex items-center justify-center text-slate-600 text-sm">{p.noAlerts}</div>}
        </div>
        <div className="lg:col-span-2">
          <RulesSection rules={rules} />
        </div>
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
        <button onClick={load} disabled={loading} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
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
    </div>
  )
}
