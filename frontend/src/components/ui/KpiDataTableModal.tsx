"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, AlertCircle, Check, Moon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { transportAnalyticsApi, type TransportAnalyticsFilters } from "@/lib/api";
import type { TransportKpiKey } from "@/lib/kpi-info/transport";
import type {
  TransportTablePage,
  TransportOpsRow,
  TransportCostRow,
  TransportPerfRow,
} from "@/types/transport_analytics";
import { cn } from "@/lib/utils";

// ─── Determine which table to query from the KPI key ─────────────────────────

type TableTab = "ops" | "cost" | "perf";

function tabFromKey(key: TransportKpiKey): TableTab {
  if (key.startsWith("ops_"))  return "ops";
  if (key.startsWith("cost_")) return "cost";
  return "perf";
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  "terminée": "bg-emerald-500/15 text-emerald-400",
  "annulée":  "bg-red-500/15 text-red-400",
  "en_cours": "bg-indigo-500/15 text-indigo-400",
};

function StatusBadge({ value }: { value: string }) {
  const cls = STATUS_STYLE[value] ?? "bg-[var(--surface-secondary)] text-[var(--text-secondary)]";
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap", cls)}>
      {value}
    </span>
  );
}

// ─── Service badge ─────────────────────────────────────────────────────────────

const SERVICE_STYLE: Record<string, string> = {
  "course_dediee": "bg-violet-500/15 text-violet-400",
  "courrier":      "bg-sky-500/15 text-sky-400",
  "manutention":   "bg-amber-500/15 text-amber-400",
};

function ServiceBadge({ value }: { value: string }) {
  const cls = SERVICE_STYLE[value] ?? "bg-[var(--surface-secondary)] text-[var(--text-secondary)]";
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap", cls)}>
      {value.replace("_", " ")}
    </span>
  );
}

// ─── Boolean chip ─────────────────────────────────────────────────────────────

function BoolChip({ value, trueLabel, falseLabel }: { value: boolean | null; trueLabel: string; falseLabel: string }) {
  if (value === null || value === undefined) return <span className="text-[var(--text-muted)] text-xs">—</span>;
  return value ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400">
      <Check size={10} />{trueLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400">
      <X size={10} />{falseLabel}
    </span>
  );
}

// ─── Number cell ─────────────────────────────────────────────────────────────

function Num({ v, unit = "", decimals = 1, colorize = false }: {
  v: number | null; unit?: string; decimals?: number; colorize?: boolean;
}) {
  if (v === null || v === undefined) return <span className="text-[var(--text-muted)] text-xs">—</span>;
  const formatted = Number(v).toLocaleString("fr-DZ", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const color = colorize
    ? v >= 0 ? "text-emerald-400" : "text-red-400"
    : "text-[var(--text-primary)]";
  return (
    <span className={cn("font-mono text-sm tabular-nums", color)}>
      {formatted}{unit ? <span className="text-[var(--text-muted)] text-xs ml-0.5">{unit}</span> : null}
    </span>
  );
}

// ─── Star rating ─────────────────────────────────────────────────────────────

function StarRating({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-[var(--text-muted)] text-xs">—</span>;
  return (
    <span className="font-mono text-sm tabular-nums text-amber-400">
      {Number(value).toFixed(1)}&nbsp;★
    </span>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────

function SkeletonRows({ cols, rows = 10 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className="border-b border-[var(--border)]">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-3 py-2.5">
              <div className="h-3.5 rounded-md bg-[var(--surface-secondary)] animate-pulse" style={{ width: `${50 + (ci * 17 + ri * 11) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Ops table ────────────────────────────────────────────────────────────────

function OpsTable({ rows, lb }: { rows: TransportOpsRow[]; lb: ReturnType<typeof useTranslation>["t"]["pages"]["common"]["kpiTable"] }) {
  const cols = [lb.colId, lb.colDate, lb.colService, lb.colStatus, lb.colOrigin, lb.colDestination, lb.colDistanceKm, lb.colStops];
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
          {cols.map((c) => (
            <th key={c} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap sticky top-0 bg-[var(--surface)] z-10">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.transport_key} className={cn("border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-secondary)]", i % 2 === 0 ? "" : "bg-[var(--surface-secondary)]/40")}>
            <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-muted)]">{r.transport_key}</td>
            <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.date_creation}</td>
            <td className="px-3 py-2.5"><ServiceBadge value={r.type_service} /></td>
            <td className="px-3 py-2.5"><StatusBadge value={r.statut} /></td>
            <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.wilaya_depart ?? "—"}</td>
            <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.wilaya_arrivee ?? "—"}</td>
            <td className="px-3 py-2.5 text-right"><Num v={r.distance_km} unit=" km" /></td>
            <td className="px-3 py-2.5 text-right"><Num v={r.nbr_stops} decimals={0} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Cost table ───────────────────────────────────────────────────────────────

function CostTable({ rows, lb }: { rows: TransportCostRow[]; lb: ReturnType<typeof useTranslation>["t"]["pages"]["common"]["kpiTable"] }) {
  const cols = [lb.colId, lb.colDate, lb.colService, lb.colStatus, lb.colRevenue, lb.colCost, lb.colMarginDzd, lb.colMarginPct, lb.colCostKm];
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
          {cols.map((c) => (
            <th key={c} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap sticky top-0 bg-[var(--surface)] z-10">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.transport_key} className={cn("border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-secondary)]", i % 2 === 0 ? "" : "bg-[var(--surface-secondary)]/40")}>
            <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-muted)]">{r.transport_key}</td>
            <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.date_creation}</td>
            <td className="px-3 py-2.5"><ServiceBadge value={r.type_service} /></td>
            <td className="px-3 py-2.5"><StatusBadge value={r.statut} /></td>
            <td className="px-3 py-2.5 text-right"><Num v={r.montant_facture} decimals={0} /></td>
            <td className="px-3 py-2.5 text-right"><Num v={r.cout_total} decimals={0} /></td>
            <td className="px-3 py-2.5 text-right"><Num v={r.marge_brute} decimals={0} colorize /></td>
            <td className="px-3 py-2.5 text-right"><Num v={r.marge_pct} unit="%" colorize /></td>
            <td className="px-3 py-2.5 text-right"><Num v={r.cout_par_km} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Perf table ───────────────────────────────────────────────────────────────

function PerfTable({ rows, lb }: { rows: TransportPerfRow[]; lb: ReturnType<typeof useTranslation>["t"]["pages"]["common"]["kpiTable"] }) {
  const cols = [lb.colId, lb.colDate, lb.colService, lb.colVehicle, lb.colOnTime, lb.colDurationH, lb.colRating, lb.colDelayMin, lb.colNight];
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
          {cols.map((c) => (
            <th key={c} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap sticky top-0 bg-[var(--surface)] z-10">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.transport_key} className={cn("border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-secondary)]", i % 2 === 0 ? "" : "bg-[var(--surface-secondary)]/40")}>
            <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-muted)]">{r.transport_key}</td>
            <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.date_creation}</td>
            <td className="px-3 py-2.5"><ServiceBadge value={r.type_service} /></td>
            <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.type_vehicule ?? "—"}</td>
            <td className="px-3 py-2.5"><BoolChip value={r.a_l_heure} trueLabel={lb.onTime} falseLabel={lb.late} /></td>
            <td className="px-3 py-2.5 text-right"><Num v={r.duree_h} unit=" h" decimals={2} /></td>
            <td className="px-3 py-2.5 text-right"><StarRating value={r.note_client} /></td>
            <td className="px-3 py-2.5 text-right">
              {r.retard_min === null ? <span className="text-[var(--text-muted)] text-xs">—</span> : (
                <span className={cn("font-mono text-sm tabular-nums", r.retard_min > 0 ? "text-red-400" : "text-emerald-400")}>
                  {r.retard_min > 0 ? "+" : ""}{r.retard_min}&nbsp;min
                </span>
              )}
            </td>
            <td className="px-3 py-2.5">
              {r.is_nuit ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/15 text-indigo-400">
                  <Moon size={10} />{lb.yes}
                </span>
              ) : (
                <span className="text-[var(--text-muted)] text-xs">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface KpiDataTableModalProps {
  kpiKey: TransportKpiKey | null;
  kpiTitle: string;
  filters: TransportAnalyticsFilters;
  onClose: () => void;
}

const PAGE_SIZE = 20;

export function KpiDataTableModal({ kpiKey, kpiTitle, filters, onClose }: KpiDataTableModalProps) {
  const { t, isRTL } = useTranslation();
  const lb = t.pages.common.kpiTable;

  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [opsData,  setOpsData]  = useState<TransportTablePage<TransportOpsRow>  | null>(null);
  const [costData, setCostData] = useState<TransportTablePage<TransportCostRow> | null>(null);
  const [perfData, setPerfData] = useState<TransportTablePage<TransportPerfRow> | null>(null);

  const tab = kpiKey ? tabFromKey(kpiKey) : "ops";

  const currentPage  = tab === "ops" ? opsData  : tab === "cost" ? costData  : perfData;
  const totalPages   = currentPage?.total_pages ?? 1;
  const totalCount   = currentPage?.count ?? 0;

  // close on Escape
  useEffect(() => {
    if (!kpiKey) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [kpiKey, onClose]);

  // reset page when kpiKey changes
  useEffect(() => { setPage(1); }, [kpiKey]);

  const fetch = useCallback(async () => {
    if (!kpiKey) return;
    setLoading(true);
    setError(null);
    const params = { ...filters, kpi: kpiKey, page, page_size: PAGE_SIZE };
    try {
      if (tab === "ops")  { setOpsData(await transportAnalyticsApi.opsTable(params));   }
      if (tab === "cost") { setCostData(await transportAnalyticsApi.costTable(params));  }
      if (tab === "perf") { setPerfData(await transportAnalyticsApi.perfTable(params));  }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [kpiKey, tab, filters, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  const colCount = tab === "ops" ? 8 : tab === "cost" ? 9 : 9;

  return (
    <AnimatePresence>
      {kpiKey && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            dir={isRTL ? "rtl" : "ltr"}
            className="fixed inset-x-4 top-8 bottom-8 z-50 mx-auto max-w-6xl flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">{lb.title}</p>
                <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">{kpiTitle}</h2>
              </div>
              {!loading && totalCount > 0 && (
                <span className="text-xs text-[var(--text-muted)] shrink-0">
                  {totalCount.toLocaleString()} {lb.rowsTotal}
                </span>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            {/* Table body */}
            <div className="flex-1 overflow-auto min-h-0">
              {error ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
                  <AlertCircle size={28} className="text-red-400" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  {/* Sticky column headers rendered inside each sub-table */}
                  {loading ? (
                    <>
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          {Array.from({ length: colCount }).map((_, i) => (
                            <th key={i} className="px-3 py-2.5">
                              <div className="h-3 w-16 rounded bg-[var(--surface-secondary)] animate-pulse" />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody><SkeletonRows cols={colCount} /></tbody>
                    </>
                  ) : currentPage?.results.length === 0 ? (
                    <tbody>
                      <tr><td colSpan={colCount} className="py-20 text-center text-sm text-[var(--text-muted)]">{lb.noData}</td></tr>
                    </tbody>
                  ) : null}
                </table>
              )}

              {/* Actual data tables (rendered outside the loading skeleton table) */}
              {!loading && !error && currentPage && currentPage.results.length > 0 && (
                tab === "ops"  ? <OpsTable  rows={opsData!.results}  lb={lb} /> :
                tab === "cost" ? <CostTable rows={costData!.results} lb={lb} /> :
                                 <PerfTable rows={perfData!.results} lb={lb} />
              )}
            </div>

            {/* Footer — pagination */}
            <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)]/40">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={13} />
                {lb.prev}
              </button>

              <p className="text-xs text-[var(--text-muted)]">
                {lb.page} <span className="font-semibold text-[var(--text-primary)]">{page}</span> {lb.of} <span className="font-semibold text-[var(--text-primary)]">{totalPages}</span>
              </p>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {lb.next}
                <ChevronRight size={13} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
