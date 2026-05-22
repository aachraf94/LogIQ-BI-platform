'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, XCircle, Clock, Loader, AlertTriangle, Database, ChevronDown, ChevronUp } from 'lucide-react'
import { etlApi } from '@/lib/api'
import type { ETLRun, ETLStatus } from '@/types/api'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

const STATUS_ICON: Record<ETLStatus, React.ReactNode> = {
  success: <CheckCircle size={15} className="text-emerald-400" />,
  failure: <XCircle size={15} className="text-red-400" />,
  running: <Loader size={15} className="text-amber-400 animate-spin" />,
  partial: <AlertTriangle size={15} className="text-amber-400" />,
}

const STATUS_COLOR: Record<ETLStatus, string> = {
  success: 'bg-emerald-500/10 text-emerald-400',
  failure: 'bg-red-500/10 text-red-400',
  running: 'bg-amber-500/10 text-amber-400',
  partial: 'bg-amber-500/10 text-amber-400',
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function RunRow({ run, pe }: { run: ETLRun; pe: ReturnType<typeof useTranslation>['t']['pages']['etl'] }) {
  const [expanded, setExpanded] = useState(false)
  const assets = Object.entries(run.assets_materialized ?? {})

  return (
    <div className="border-b border-[#2D3050] last:border-0">
      <div
        className="flex items-center gap-4 px-5 py-4 hover:bg-[#252840]/40 cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div>{STATUS_ICON[run.status]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{run.job_name}</span>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', STATUS_COLOR[run.status])}>
              {run.status}
            </span>
            <span className="text-xs text-slate-500 capitalize">{run.triggered_by}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {format(new Date(run.started_at), 'dd MMM yyyy, HH:mm')}
            </span>
            <span>{formatDuration(run.duration_seconds)}</span>
            {run.total_rows_loaded > 0 && (
              <span className="flex items-center gap-1">
                <Database size={11} />
                {run.total_rows_loaded.toLocaleString()} {pe.rows}
              </span>
            )}
          </div>
        </div>
        <div className="text-slate-600">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 bg-[#252840]/20">
          {run.error_message && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {run.error_message}
            </div>
          )}
          {assets.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">{pe.assetsMaterialized} ({assets.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {assets.map(([asset, rows]) => (
                  <div key={asset} className="flex items-center justify-between p-2 bg-[#1E2030] rounded-lg">
                    <span className="text-xs text-slate-400 truncate">{asset}</span>
                    <span className="text-xs font-mono text-primary ml-2 shrink-0">
                      {rows.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-600 mt-3">Run ID: {run.dagster_run_id}</p>
        </div>
      )}
    </div>
  )
}

export default function AdminEtlPage() {
  const router = useRouter()
  const { user: me } = useAuthStore()
  const { t } = useTranslation()
  const pe = t.pages.etl
  const [runs, setRuns] = useState<ETLRun[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ETLStatus | ''>('')
  const [jobFilter, setJobFilter] = useState('')

  useEffect(() => {
    if (me && !me.is_superuser) router.replace('/overview')
  }, [me, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await etlApi.runs({
        status: statusFilter || undefined,
        job_name: jobFilter || undefined,
      })
      setRuns(data)
    } catch { /* silently ignore */ } finally { setLoading(false) }
  }, [statusFilter, jobFilter])

  useEffect(() => { load() }, [load])

  if (!me?.is_superuser) return null

  const jobNames = Array.from(new Set(runs.map((r) => r.job_name)))

  // Summary counts
  const counts = runs.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc }, {} as Record<string, number>)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{pe.title}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{pe.subtitle}</p>
        </div>
        <button onClick={load} disabled={loading} title={pe.refresh} className="p-2 text-slate-500 hover:text-slate-300 transition-colors">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: pe.labelTotal,   value: runs.length,           color: 'text-white' },
          { label: pe.labelSuccess, value: counts.success ?? 0,   color: 'text-emerald-400' },
          { label: pe.labelFailed,  value: counts.failure ?? 0,   color: 'text-red-400' },
          { label: pe.labelPartial, value: counts.partial ?? 0,   color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ETLStatus | '')}
          className="bg-[#1E2030] border border-[#2D3050] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary">
          <option value="">{pe.statusAll}</option>
          <option value="success">{pe.statusSuccess}</option>
          <option value="failure">{pe.statusFailure}</option>
          <option value="running">{pe.statusRunning}</option>
          <option value="partial">{pe.statusPartial}</option>
        </select>
        {jobNames.length > 1 && (
          <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}
            className="bg-[#1E2030] border border-[#2D3050] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary">
            <option value="">{pe.labelAllJobs}</option>
            {jobNames.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        )}
      </div>

      {/* Runs list */}
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500">
            <Database size={28} className="mb-2 opacity-30" />
            <p className="text-sm">{pe.noRuns}</p>
          </div>
        ) : (
          runs.map((run) => <RunRow key={run.id} run={run} pe={pe} />)
        )}
      </div>
    </div>
  )
}
