"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, AlertCircle, Check, CalendarSearch } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { parcelDeliveryApi, type ParcelDeliveryFilters } from "@/lib/api";
import { useParcelDeliveryStore } from "@/stores/parcelDeliveryStore";
import type { ParcelDeliveryKpiKey } from "@/lib/kpi-info/parcel-delivery";
import type {
  ParcelTablePage,
  ParcelOpsRow,
  ParcelCostRow,
  ParcelPerfRow,
} from "@/types/parcel_delivery";
import { cn } from "@/lib/utils";

// ─── Tab resolution ───────────────────────────────────────────────────────────

type TableTab = "ops" | "cost" | "perf";

function tabFromKey(key: ParcelDeliveryKpiKey): TableTab {
  if (key.startsWith("ops_"))  return "ops";
  if (key.startsWith("cost_")) return "cost";
  return "perf";
}

// ─── Cell components ──────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  "Livré":               "bg-emerald-500/15 text-emerald-400",
  "Retourné au vendeur": "bg-amber-500/15 text-amber-400",
  "Echèc livraison":     "bg-red-500/15 text-red-400",
};
const TYPE_CLS: Record<string, string> = {
  "HD": "bg-violet-500/15 text-violet-400",
  "SD": "bg-sky-500/15 text-sky-400",
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? "bg-[var(--surface-secondary)] text-[var(--text-secondary)]";
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap", cls)}>
      {value}
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

// ─── Column headers ───────────────────────────────────────────────────────────

type LB = ReturnType<typeof useTranslation>["t"]["pages"]["common"]["kpiTable"];

function OpsHeaders({ lb }: { lb: LB }) {
  const cols = [lb.colId, lb.colDate, lb.colDeliveryType, lb.colStatus, lb.colDepartCenter, lb.colDestCenter, lb.colDurationH, lb.colAttempts];
  return (
    <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
      {cols.map((h, i) => (
        <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">
          {h}
        </th>
      ))}
    </tr>
  );
}

function CostHeaders({ lb }: { lb: LB }) {
  const cols = [lb.colId, lb.colDate, lb.colDeliveryType, lb.colStatus, lb.colZone, lb.colFee, lb.colTarifRef, lb.colEcartTarif];
  return (
    <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
      {cols.map((h, i) => (
        <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">
          {h}
        </th>
      ))}
    </tr>
  );
}

function PerfHeaders({ lb }: { lb: LB }) {
  const cols = [lb.colId, lb.colDate, lb.colDeliveryType, lb.colStatus, lb.colDepartCenter, lb.colAttempts, lb.colDurationH, lb.colFirstAttempt];
  return (
    <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
      {cols.map((h, i) => (
        <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">
          {h}
        </th>
      ))}
    </tr>
  );
}

// ─── Row renderers ────────────────────────────────────────────────────────────

function OpsRow({ r, even }: { r: ParcelOpsRow; even: boolean }) {
  return (
    <tr className={cn("border-b border-[var(--border)] hover:bg-[var(--surface-secondary)] transition-colors", even ? "" : "bg-[var(--surface-secondary)]/30")}>
      <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">{r.tracking}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.date_creation}</td>
      <td className="px-3 py-2">{r.type_livraison ? <Badge value={r.type_livraison} map={TYPE_CLS} /> : <span className="text-[var(--text-muted)] text-xs">—</span>}</td>
      <td className="px-3 py-2">{r.statut ? <Badge value={r.statut} map={STATUS_CLS} /> : <span className="text-[var(--text-muted)] text-xs">—</span>}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] font-mono">{r.code_depart ?? "—"}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] font-mono">{r.code_destination ?? "—"}</td>
      <td className="px-3 py-2 text-right"><Num v={r.duree_h} unit=" h" /></td>
      <td className="px-3 py-2 text-right"><Num v={r.nbr_tentatives} dec={0} /></td>
    </tr>
  );
}

function CostRow({ r, even }: { r: ParcelCostRow; even: boolean }) {
  return (
    <tr className={cn("border-b border-[var(--border)] hover:bg-[var(--surface-secondary)] transition-colors", even ? "" : "bg-[var(--surface-secondary)]/30")}>
      <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">{r.tracking}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.date_terminal}</td>
      <td className="px-3 py-2">{r.type_livraison ? <Badge value={r.type_livraison} map={TYPE_CLS} /> : <span className="text-[var(--text-muted)] text-xs">—</span>}</td>
      <td className="px-3 py-2">{r.statut ? <Badge value={r.statut} map={STATUS_CLS} /> : <span className="text-[var(--text-muted)] text-xs">—</span>}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">
        {r.zone_num != null ? `Zone ${r.zone_num}` : "—"}
      </td>
      <td className="px-3 py-2 text-right"><Num v={r.frais_livraison} dec={0} /></td>
      <td className="px-3 py-2 text-right"><Num v={r.tarif_reference} dec={0} /></td>
      <td className="px-3 py-2 text-right"><Num v={r.ecart_tarif} dec={0} colorize /></td>
    </tr>
  );
}

function PerfRow({ r, even, lb }: { r: ParcelPerfRow; even: boolean; lb: LB }) {
  return (
    <tr className={cn("border-b border-[var(--border)] hover:bg-[var(--surface-secondary)] transition-colors", even ? "" : "bg-[var(--surface-secondary)]/30")}>
      <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">{r.tracking}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">{r.date_creation}</td>
      <td className="px-3 py-2">{r.type_livraison ? <Badge value={r.type_livraison} map={TYPE_CLS} /> : <span className="text-[var(--text-muted)] text-xs">—</span>}</td>
      <td className="px-3 py-2">{r.statut ? <Badge value={r.statut} map={STATUS_CLS} /> : <span className="text-[var(--text-muted)] text-xs">—</span>}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] font-mono">{r.code_depart ?? "—"}</td>
      <td className="px-3 py-2 text-right"><Num v={r.nbr_tentatives} dec={0} /></td>
      <td className="px-3 py-2 text-right"><Num v={r.duree_h} unit=" h" /></td>
      <td className="px-3 py-2">
        {r.premier_essai ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400">
            <Check size={10} />{lb.yes}
          </span>
        ) : (
          <span className="text-[var(--text-muted)] text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ParcelKpiDataTableModalProps {
  kpiKey: ParcelDeliveryKpiKey | null;
  kpiTitle: string;
  filters: ParcelDeliveryFilters;
  onClose: () => void;
  usingMock?: boolean;
}

const PAGE_SIZE = 20;

export function ParcelKpiDataTableModal({
  kpiKey, kpiTitle, filters, onClose, usingMock = false,
}: ParcelKpiDataTableModalProps) {
  const { t, isRTL } = useTranslation();
  const lb = t.pages.common.kpiTable;

  const { setStartDate, setEndDate } = useParcelDeliveryStore();

  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [opsData,  setOpsData]  = useState<ParcelTablePage<ParcelOpsRow>  | null>(null);
  const [costData, setCostData] = useState<ParcelTablePage<ParcelCostRow> | null>(null);
  const [perfData, setPerfData] = useState<ParcelTablePage<ParcelPerfRow> | null>(null);

  const [dwRange, setDwRange] = useState<{
    min_date: string; max_date: string; total_count: number;
    min_terminal_date: string | null; max_terminal_date: string | null; terminal_count: number;
  } | null>(null);
  const [probingRange,  setProbingRange]  = useState(false);
  const [effectiveDates, setEffectiveDates] = useState<{ start: string; end: string } | null>(null);

  const tab         = kpiKey ? tabFromKey(kpiKey) : "ops";
  const currentPage = tab === "ops" ? opsData : tab === "cost" ? costData : perfData;
  const totalPages  = currentPage?.total_pages ?? 1;
  const totalCount  = currentPage?.count ?? 0;
  const colCount    = 8;

  // Escape key
  useEffect(() => {
    if (!kpiKey) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [kpiKey, onClose]);

  // Reset on KPI change
  useEffect(() => {
    if (kpiKey) { setPage(1); setDwRange(null); setEffectiveDates(null); }
  }, [kpiKey]);

  const fetchStart = effectiveDates?.start ?? filters.start_date;
  const fetchEnd   = effectiveDates?.end   ?? filters.end_date;

  const fetchData = useCallback(async () => {
    if (!kpiKey) return;
    setLoading(true);
    setError(null);
    const params = {
      ...filters,
      start_date: fetchStart,
      end_date:   fetchEnd,
      kpi: kpiKey, page, page_size: PAGE_SIZE,
    };
    try {
      let result;
      if (tab === "ops") {
        result = await parcelDeliveryApi.opsTable(params);
        setOpsData(result);
      } else if (tab === "cost") {
        result = await parcelDeliveryApi.costTable(params);
        setCostData(result);
      } else {
        result = await parcelDeliveryApi.perfTable(params);
        setPerfData(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [kpiKey, tab, fetchStart, fetchEnd, filters.delivery_type, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  // DW range probe when results are empty and backend is live
  const hasResults = (currentPage?.count ?? 0) > 0;
  useEffect(() => {
    if (!kpiKey || loading || hasResults || usingMock || dwRange || probingRange) return;
    if (currentPage === null) return;
    setProbingRange(true);
    parcelDeliveryApi.dateRange()
      .then((r) => {
        if (r.min_date && r.max_date) setDwRange({
          min_date:          r.min_date,
          max_date:          r.max_date,
          total_count:       r.total_count,
          min_terminal_date: r.min_terminal_date ?? null,
          max_terminal_date: r.max_terminal_date ?? null,
          terminal_count:    r.terminal_count ?? 0,
        });
      })
      .catch(() => { /* silent */ })
      .finally(() => setProbingRange(false));
  }, [kpiKey, loading, hasResults, usingMock, dwRange, probingRange, currentPage]);

  function getSuggestedRange(r: NonNullable<typeof dwRange>): { start: string; end: string; count: number } {
    if (tab === "cost" && r.min_terminal_date && r.max_terminal_date) {
      return { start: r.min_terminal_date, end: r.max_terminal_date, count: r.terminal_count };
    }
    return { start: r.min_date, end: r.max_date, count: r.total_count };
  }

  function applyDwRange() {
    if (!dwRange) return;
    const { start, end } = getSuggestedRange(dwRange);
    setStartDate(start);
    setEndDate(end);
    setEffectiveDates({ start, end });
    setDwRange(null);
    setPage(1);
  }

  // ─── Table content ───────────────────────────────────────────────────────────

  const rows = currentPage?.results ?? [];

  const emptyNode = usingMock ? (
    <td colSpan={colCount} className="py-16 text-center">
      <div className="inline-flex flex-col items-center gap-2 max-w-xs mx-auto">
        <AlertCircle size={24} className="text-amber-400" />
        <p className="text-sm font-medium text-amber-500">Données de démonstration</p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Les cartes KPI affichent des données mock (backend indisponible). Le tableau nécessite une connexion live au backend.
        </p>
      </div>
    </td>
  ) : (
    <td colSpan={colCount} className="py-12 text-center">
      <div className="inline-flex flex-col items-center gap-3 max-w-sm mx-auto">
        <CalendarSearch size={28} className="text-[var(--text-muted)] opacity-40" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Aucune donnée pour cette période</p>
          <p className="text-xs font-mono text-[var(--text-muted)]">
            {fetchStart} → {fetchEnd}
          </p>
        </div>

        {probingRange && (
          <p className="text-xs text-[var(--text-muted)] animate-pulse">Recherche de données disponibles…</p>
        )}
        {dwRange && (() => {
          const { start, end, count } = getSuggestedRange(dwRange);
          return count > 0 ? (
            <div className="mt-1 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 text-left space-y-2 w-full max-w-xs">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary/70">
                Données disponibles dans le DW
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                <span className="font-mono font-semibold text-[var(--text-primary)]">{start}</span>
                {" "}→{" "}
                <span className="font-mono font-semibold text-[var(--text-primary)]">{end}</span>
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {count.toLocaleString()} enregistrements au total
              </p>
              <button
                onClick={applyDwRange}
                className="w-full mt-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                Appliquer cette période et réessayer
              </button>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] opacity-60">Le DW ne contient aucune donnée de colis.</p>
          );
        })()}
      </div>
    </td>
  );

  const tableBody = loading ? (
    <tbody>
      {Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)}
    </tbody>
  ) : rows.length === 0 ? (
    <tbody><tr>{emptyNode}</tr></tbody>
  ) : tab === "ops" ? (
    <tbody>
      {(rows as ParcelOpsRow[]).map((r, i) => <OpsRow key={r.tracking + i} r={r} even={i % 2 === 0} />)}
    </tbody>
  ) : tab === "cost" ? (
    <tbody>
      {(rows as ParcelCostRow[]).map((r, i) => <CostRow key={r.tracking + i} r={r} even={i % 2 === 0} />)}
    </tbody>
  ) : (
    <tbody>
      {(rows as ParcelPerfRow[]).map((r, i) => <PerfRow key={r.tracking + i} r={r} even={i % 2 === 0} lb={lb} />)}
    </tbody>
  );

  const tableHead = tab === "ops"  ? <thead className="sticky top-0 z-10"><OpsHeaders  lb={lb} /></thead>
                  : tab === "cost" ? <thead className="sticky top-0 z-10"><CostHeaders lb={lb} /></thead>
                  :                  <thead className="sticky top-0 z-10"><PerfHeaders lb={lb} /></thead>;

  return (
    <AnimatePresence>
      {kpiKey && (
        <div key="parcel-table-modal">
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

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
                <p className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                  {fetchStart} → {fetchEnd}
                  {filters.delivery_type ? <span className="ml-2 text-primary/70">· {filters.delivery_type}</span> : null}
                </p>
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

            {/* Table */}
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

            {/* Pagination */}
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
