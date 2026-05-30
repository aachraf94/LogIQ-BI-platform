"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, AlertCircle, Check, Moon, CalendarSearch } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { transportAnalyticsApi, type TransportAnalyticsFilters } from "@/lib/api";
import { useTransportStore } from "@/stores/transportStore";
import type { TransportKpiKey } from "@/lib/kpi-info/transport";
import type {
  TransportTablePage,
  TransportOpsRow,
  TransportCostRow,
  TransportPerfRow,
} from "@/types/transport_analytics";
import { cn } from "@/lib/utils";

// ─── Tab resolution ───────────────────────────────────────────────────────────

type TableTab = "ops" | "cost" | "perf";

function tabFromKey(key: TransportKpiKey): TableTab {
  if (key.startsWith("ops_"))  return "ops";
  if (key.startsWith("cost_")) return "cost";
  return "perf";
}

// ─── Small cell formatters ────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  "terminée": "bg-emerald-500/15 text-emerald-400",
  "annulée":  "bg-red-500/15 text-red-400",
  "en_cours": "bg-indigo-500/15 text-indigo-400",
};
const SERVICE_CLS: Record<string, string> = {
  "course_dediee": "bg-violet-500/15 text-violet-400",
  "courrier":      "bg-sky-500/15 text-sky-400",
  "manutention":   "bg-amber-500/15 text-amber-400",
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? "bg-[var(--surface-secondary)] text-[var(--text-secondary)]";
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap", cls)}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

function Num({ v, unit = "", dec = 1, colorize = false }: {
  v: number | null | undefined; unit?: string; dec?: number; colorize?: boolean;
}) {
  if (v === null || v === undefined) return <span className="text-[var(--text-muted)] text-xs">—</span>;
  const fmt = Number(v).toLocaleString("fr-DZ", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const color = colorize ? (v >= 0 ? "text-emerald-400" : "text-red-400") : "text-[var(--text-primary)]";
  return (
    <span className={cn("font-mono text-sm tabular-nums", color)}>
      {fmt}{unit ? <span className="text-[var(--text-muted)] text-xs ml-0.5">{unit}</span> : null}
    </span>
  );
}

function Stars({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="text-[var(--text-muted)] text-xs">—</span>;
  return <span className="font-mono text-sm text-amber-400">{Number(v).toFixed(1)}&nbsp;★</span>;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-[var(--border)]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-3.5 rounded bg-[var(--surface-secondary)] animate-pulse" style={{ width: `${48 + (i * 19) % 38}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Column header lists ──────────────────────────────────────────────────────

type LB = ReturnType<typeof useTranslation>["t"]["pages"]["common"]["kpiTable"];

function OpsHeaders({ lb }: { lb: LB }) {
  return (
    <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
      {[lb.colId, lb.colDate, lb.colService, lb.colStatus, lb.colOrigin, lb.colDestination, lb.colDistanceKm, lb.colStops].map((h, i) => (
        <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">
          {h}
        </th>
      ))}
    </tr>
  );
}

function CostHeaders({ lb }: { lb: LB }) {
  return (
    <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
      {[lb.colId, lb.colDate, lb.colService, lb.colStatus, lb.colRevenue, lb.colCost, lb.colMarginDzd, lb.colMarginPct, lb.colCostKm].map((h, i) => (
        <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">
          {h}
        </th>
      ))}
    </tr>
  );
}

function PerfHeaders({ lb }: { lb: LB }) {
  return (
    <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
      {[lb.colId, lb.colDate, lb.colService, lb.colVehicle, lb.colOnTime, lb.colDurationH, lb.colRating, lb.colDelayMin, lb.colNight].map((h, i) => (
        <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">
          {h}
        </th>
      ))}
    </tr>
  );
}

// ─── Data row renderers ───────────────────────────────────────────────────────

function OpsRow({ r, even }: { r: TransportOpsRow; even: boolean }) {
  return (
    <tr className={cn("border-b border-[var(--border)] hover:bg-[var(--surface-secondary)] transition-colors", even ? "" : "bg-[var(--surface-secondary)]/30")}>
      <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">{r.transport_key}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.date_creation}</td>
      <td className="px-3 py-2"><Badge value={r.type_service ?? ""} map={SERVICE_CLS} /></td>
      <td className="px-3 py-2"><Badge value={r.statut ?? ""} map={STATUS_CLS} /></td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.wilaya_depart ?? "—"}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.wilaya_arrivee ?? "—"}</td>
      <td className="px-3 py-2 text-right"><Num v={r.distance_km} unit=" km" /></td>
      <td className="px-3 py-2 text-right"><Num v={r.nbr_stops} dec={0} /></td>
    </tr>
  );
}

function CostRow({ r, even }: { r: TransportCostRow; even: boolean }) {
  return (
    <tr className={cn("border-b border-[var(--border)] hover:bg-[var(--surface-secondary)] transition-colors", even ? "" : "bg-[var(--surface-secondary)]/30")}>
      <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">{r.transport_key}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.date_creation}</td>
      <td className="px-3 py-2"><Badge value={r.type_service ?? ""} map={SERVICE_CLS} /></td>
      <td className="px-3 py-2"><Badge value={r.statut ?? ""} map={STATUS_CLS} /></td>
      <td className="px-3 py-2 text-right"><Num v={r.montant_facture} dec={0} /></td>
      <td className="px-3 py-2 text-right"><Num v={r.cout_total} dec={0} /></td>
      <td className="px-3 py-2 text-right"><Num v={r.marge_brute} dec={0} colorize /></td>
      <td className="px-3 py-2 text-right"><Num v={r.marge_pct} unit="%" colorize /></td>
      <td className="px-3 py-2 text-right"><Num v={r.cout_par_km} /></td>
    </tr>
  );
}

function PerfRow({ r, even, lb }: { r: TransportPerfRow; even: boolean; lb: LB }) {
  return (
    <tr className={cn("border-b border-[var(--border)] hover:bg-[var(--surface-secondary)] transition-colors", even ? "" : "bg-[var(--surface-secondary)]/30")}>
      <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">{r.transport_key}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.date_creation}</td>
      <td className="px-3 py-2"><Badge value={r.type_service ?? ""} map={SERVICE_CLS} /></td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.type_vehicule ?? "—"}</td>
      <td className="px-3 py-2">
        {r.a_l_heure === null || r.a_l_heure === undefined ? (
          <span className="text-[var(--text-muted)] text-xs">—</span>
        ) : r.a_l_heure ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400">
            <Check size={10} />{lb.onTime}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400">
            <X size={10} />{lb.late}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right"><Num v={r.duree_h} unit=" h" dec={2} /></td>
      <td className="px-3 py-2 text-right"><Stars v={r.note_client} /></td>
      <td className="px-3 py-2 text-right">
        {r.retard_min === null || r.retard_min === undefined ? (
          <span className="text-[var(--text-muted)] text-xs">—</span>
        ) : (
          <span className={cn("font-mono text-sm tabular-nums", r.retard_min > 0 ? "text-red-400" : "text-emerald-400")}>
            {r.retard_min > 0 ? "+" : ""}{r.retard_min} min
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {r.is_nuit ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/15 text-indigo-400">
            <Moon size={10} />{lb.yes}
          </span>
        ) : (
          <span className="text-[var(--text-muted)] text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface KpiDataTableModalProps {
  kpiKey: TransportKpiKey | null;
  kpiTitle: string;
  filters: TransportAnalyticsFilters;
  onClose: () => void;
  usingMock?: boolean;
}

const PAGE_SIZE = 20;

export function KpiDataTableModal({ kpiKey, kpiTitle, filters, onClose, usingMock = false }: KpiDataTableModalProps) {
  const { t, isRTL } = useTranslation();
  const lb = t.pages.common.kpiTable;

  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [opsData,  setOpsData]  = useState<TransportTablePage<TransportOpsRow>  | null>(null);
  const [costData, setCostData] = useState<TransportTablePage<TransportCostRow> | null>(null);
  const [perfData, setPerfData] = useState<TransportTablePage<TransportPerfRow> | null>(null);

  const tab         = kpiKey ? tabFromKey(kpiKey) : "ops";
  const currentPage = tab === "ops" ? opsData : tab === "cost" ? costData : perfData;
  const totalPages  = currentPage?.total_pages ?? 1;
  const totalCount  = currentPage?.count ?? 0;
  const colCount    = tab === "ops" ? 8 : 9;

  // Escape key
  useEffect(() => {
    if (!kpiKey) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [kpiKey, onClose]);

  // Reset page on KPI change
  useEffect(() => { if (kpiKey) setPage(1); }, [kpiKey]);

  const fetchData = useCallback(async () => {
    if (!kpiKey) return;
    setLoading(true);
    setError(null);
    const params = { ...filters, kpi: kpiKey, page, page_size: PAGE_SIZE };
    try {
      let result;
      if (tab === "ops") {
        result = await transportAnalyticsApi.opsTable(params);
        console.log("[KpiDataTableModal] ops response:", result);
        setOpsData(result);
      } else if (tab === "cost") {
        result = await transportAnalyticsApi.costTable(params);
        console.log("[KpiDataTableModal] cost response:", result);
        setCostData(result);
      } else {
        result = await transportAnalyticsApi.perfTable(params);
        console.log("[KpiDataTableModal] perf response:", result);
        setPerfData(result);
      }
    } catch (err) {
      console.error("[KpiDataTableModal] fetch error:", err);
      // Surface the full error object so date-range vs auth vs SQL issues are distinguishable
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [kpiKey, tab, filters.start_date, filters.end_date, filters.service_type, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Unified table body content ──────────────────────────────────────────────

  const rows = currentPage?.results ?? [];

  const emptyNode = usingMock ? (
    <td colSpan={colCount} className="py-16 text-center">
      <div className="inline-flex flex-col items-center gap-2 max-w-xs mx-auto">
        <span className="text-2xl">⚠️</span>
        <p className="text-sm font-medium text-amber-500">
          Données de démonstration
        </p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Les cartes KPI affichent des données mock (backend indisponible). Le tableau de données nécessite une connexion live au backend.
        </p>
      </div>
    </td>
  ) : (
    <td colSpan={colCount} className="py-16 text-center">
      <div className="inline-flex flex-col items-center gap-1.5">
        <p className="text-sm text-[var(--text-muted)]">{lb.noData}</p>
        <p className="text-xs text-[var(--text-muted)] opacity-60">
          {filters.start_date} → {filters.end_date}
        </p>
        <p className="text-[10px] text-[var(--text-muted)] opacity-40 mt-1">
          Vérifiez que la plage de dates correspond aux données chargées dans votre DW.
        </p>
      </div>
    </td>
  );

  const tableBody = loading ? (
    <tbody>
      {Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)}
    </tbody>
  ) : rows.length === 0 ? (
    <tbody>
      <tr>{emptyNode}</tr>
    </tbody>
  ) : tab === "ops" ? (
    <tbody>
      {(rows as TransportOpsRow[]).map((r, i) => <OpsRow key={r.transport_key} r={r} even={i % 2 === 0} />)}
    </tbody>
  ) : tab === "cost" ? (
    <tbody>
      {(rows as TransportCostRow[]).map((r, i) => <CostRow key={r.transport_key} r={r} even={i % 2 === 0} />)}
    </tbody>
  ) : (
    <tbody>
      {(rows as TransportPerfRow[]).map((r, i) => <PerfRow key={r.transport_key} r={r} even={i % 2 === 0} lb={lb} />)}
    </tbody>
  );

  const tableHead = tab === "ops"  ? <thead className="sticky top-0 z-10"><OpsHeaders  lb={lb} /></thead>
                  : tab === "cost" ? <thead className="sticky top-0 z-10"><CostHeaders lb={lb} /></thead>
                  :                  <thead className="sticky top-0 z-10"><PerfHeaders lb={lb} /></thead>;

  return (
    <AnimatePresence>
      {kpiKey && (
        <div key="kpi-table-modal">
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            dir={isRTL ? "rtl" : "ltr"}
            className="fixed inset-x-4 top-6 bottom-6 z-50 mx-auto max-w-6xl flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">
                  {lb.title}
                </p>
                <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">{kpiTitle}</h2>
              </div>
              {!loading && totalCount > 0 && (
                <span className="text-xs text-[var(--text-muted)] shrink-0 tabular-nums">
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
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <AlertCircle size={28} className="text-red-400" />
                  <p className="text-sm text-red-400 text-center px-4">{error}</p>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  {tableHead}
                  {tableBody}
                </table>
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
                {lb.page}{" "}
                <span className="font-semibold text-[var(--text-primary)]">{page}</span>
                {" "}{lb.of}{" "}
                <span className="font-semibold text-[var(--text-primary)]">{totalPages}</span>
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
        </div>
      )}
    </AnimatePresence>
  );
}
