"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, ShieldCheck, Clock, FileWarning } from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import { useTranslation } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chartTheme";
import { useParcelDeliveryStore } from "@/stores/parcelDeliveryStore";
import { parcelDeliveryApi } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";
import {
  mockParcelPerfKpis,
  mockParcelPerfTrend,
  mockParcelDurationBuckets,
  mockParcelAgencyPCC,
  mockParcelClaimsTypes,
} from "@/lib/mock-data";
import type {
  ParcelPerfKpis,
  ParcelPerfTrendPoint,
  ParcelDurationBucket,
  ParcelAgencyPCC,
  ParcelClaimsType,
} from "@/types/parcel_delivery";

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionCard({ title, children, className = "" }: {
  title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 ${className}`}>
      <div className="border-l-2 border-primary/40 pl-2 mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="h-[280px] flex flex-col items-center justify-center gap-2 text-[var(--text-muted)] select-none">
      <svg width="48" height="36" viewBox="0 0 48 36" fill="none" className="opacity-25">
        <rect x="0" y="22" width="8" height="14" rx="2" fill="currentColor"/>
        <rect x="10" y="14" width="8" height="22" rx="2" fill="currentColor"/>
        <rect x="20" y="18" width="8" height="18" rx="2" fill="currentColor"/>
        <rect x="30" y="6" width="8" height="30" rx="2" fill="currentColor"/>
        <rect x="40" y="10" width="8" height="26" rx="2" fill="currentColor"/>
      </svg>
      <p className="text-xs font-medium">Aucune donnée disponible</p>
    </div>
  );
}

// ─── Delivery rate + PCC dual-line trend ──────────────────────────────────────

function buildPerfTrendOption(
  trend: ParcelPerfTrendPoint[],
  labels: { deliveryRate: string; underTariff: string },
  ct: ReturnType<typeof useChartTheme>
) {
  const cats = trend.map((d) => d.period);
  const allValues = trend.flatMap((d) => [d.taux_livraison_pct, d.taux_sous_tarif_pct]);
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const yMin = Math.max(0, Math.floor(minVal - 10));

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      axisPointer: { type: "cross" as const, label: { backgroundColor: "#6366F1" } },
    },
    legend: {
      top: 0, right: 0,
      textStyle: { color: ct.legendColor, fontSize: 11 },
      itemWidth: 10, itemHeight: 10,
    },
    grid: { left: 16, right: 16, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: cats,
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 10 },
    },
    yAxis: {
      type: "value" as const,
      min: yMin,
      max: 100,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
      axisLabel: { color: ct.labelColor, fontSize: 11, formatter: (v: number) => `${v}%` },
    },
    series: [
      {
        name: labels.deliveryRate,
        type: "line" as const,
        data: trend.map((d) => d.taux_livraison_pct),
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#10B981", width: 2 },
        itemStyle: { color: "#10B981" },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: "rgba(16,185,129,0.2)" }, { offset: 1, color: "rgba(16,185,129,0)" }],
          },
        },
      },
      {
        name: labels.underTariff,
        type: "line" as const,
        data: trend.map((d) => d.taux_sous_tarif_pct),
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#F59E0B", width: 2, type: "dashed" as const },
        itemStyle: { color: "#F59E0B" },
      },
    ],
  };
}

// ─── Duration distribution histogram ─────────────────────────────────────────

function buildDurationDistOption(
  buckets: ParcelDurationBucket[],
  label: string,
  ct: ReturnType<typeof useChartTheme>
) {
  const sorted = [...buckets].sort((a, b) => a.bucket_order - b.bucket_order);
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      axisPointer: { type: "shadow" as const },
    },
    grid: { left: 16, right: 16, top: 16, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: sorted.map((b) => b.bucket),
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 10, rotate: 15 },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
      axisLabel: { color: ct.labelColor, fontSize: 11 },
    },
    series: [
      {
        name: label,
        type: "bar" as const,
        data: sorted.map((b) => b.nbr_colis),
        itemStyle: { color: "#22D3EE", borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 50,
        label: {
          show: true,
          position: "top" as const,
          color: ct.legendColor,
          fontSize: 10,
          formatter: (p: { value: number }) => `${p.value}`,
        },
      },
    ],
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PageData {
  kpis: ParcelPerfKpis
  perfTrend: ParcelPerfTrendPoint[]
  durationBuckets: ParcelDurationBucket[]
  agencyPCC: ParcelAgencyPCC[]
  claimsTypes: ParcelClaimsType[]
}

const MOCK: PageData = {
  kpis: mockParcelPerfKpis,
  perfTrend: mockParcelPerfTrend,
  durationBuckets: mockParcelDurationBuckets,
  agencyPCC: mockParcelAgencyPCC,
  claimsTypes: mockParcelClaimsTypes,
};

export default function PerformancePage() {
  const [data, setData] = useState<PageData>(MOCK);
  const [usingMock, setUsingMock] = useState(false);
  const [fetching, setFetching] = useState(false);
  // Defer all ECharts initialization until after first paint
  const [chartsReady, setChartsReady] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    // Two frames to let KPI cards paint first, then mount heavy charts
    raf.current = requestAnimationFrame(() =>
      requestAnimationFrame(() => setChartsReady(true))
    );
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  const { t } = useTranslation();
  const p = t.pages.parcelDelivery;
  const ct = useChartTheme();

  const { startDate, endDate, deliveryType, rangeDays } = useParcelDeliveryStore();
  const days = rangeDays();
  const trendLabel = `vs ${days} j précédents`;

  const filters = {
    start_date: startDate,
    end_date: endDate,
    delivery_type: deliveryType !== "all" ? deliveryType : undefined,
  };

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [kpis, perfTrend, durationBuckets, agencyPCC, claimsTypes] = await Promise.all([
        parcelDeliveryApi.perfKpis(filters),
        parcelDeliveryApi.perfTrend(filters),
        parcelDeliveryApi.durationDistribution(filters),
        parcelDeliveryApi.agencyPCCRanking(filters),
        parcelDeliveryApi.claimsTypes(filters),
      ]);
      setData({ kpis, perfTrend, durationBuckets, agencyPCC, claimsTypes });
      setUsingMock(false);
    } catch {
      setData(MOCK);
      setUsingMock(true);
    } finally {
      setFetching(false);
    }
  }, [startDate, endDate, deliveryType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const { kpis, perfTrend, durationBuckets, agencyPCC, claimsTypes } = data;

  const agencyBarData = [...agencyPCC]
    .sort((a, b) => b.taux_sous_tarif_pct - a.taux_sous_tarif_pct)
    .map((a) => ({ name: a.agence_name, value: a.taux_sous_tarif_pct }));

  const claimsPieData = claimsTypes
    .filter((c) => c.nbr_sinistres > 0)
    .map((c) => ({ name: c.sinistre_type, value: c.nbr_sinistres }));

  return (
    <div className="space-y-5">
      {/* Animated progress bar during background fetch */}
      {fetching && (
        <div className="h-0.5 rounded-full overflow-hidden bg-[var(--surface-secondary)]">
          <motion.div
            className="h-full bg-gradient-to-r from-primary/40 via-primary to-primary/40"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      {usingMock && !fetching && (
        <div className="sticky top-0 z-10 text-xs text-amber-400/80 border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 rounded-lg w-fit">
          {p.demoData}
        </div>
      )}

      {/* ── Row 1: KPI cards — paint immediately, no deferral needed ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard title={p.kpiDeliveryRatePerf}  value={formatPercent(kpis.taux_livraison_pct)}                    trend={kpis.pop_livraison}   trendLabel={trendLabel} icon={<TrendingUp size={15} />}  index={0} />
        <KpiCard title={p.kpiUnderTariff}        value={formatPercent(kpis.taux_sous_tarif_pct)}                   trend={-kpis.pop_sous_tarif} trendLabel={trendLabel} icon={<AlertTriangle size={15} />} index={1} />
        <KpiCard title={p.kpiCompliance}         value={formatPercent(kpis.taux_compliance_pct)}                   trend={kpis.pop_compliance}  trendLabel={trendLabel} icon={<ShieldCheck size={15} />}  index={2} />
        <KpiCard title={p.kpiAvgDurationPerf}    value={`${kpis.avg_duree_livraison_h.toFixed(1)} ${p.durationUnit}`} trend={-kpis.pop_duree}  trendLabel={trendLabel} icon={<Clock size={15} />}        index={3} />
        <KpiCard title={p.kpiClaimsCount}        value={formatNumber(kpis.nbr_sinistres)}                          trend={-kpis.pop_sinistres}  trendLabel={trendLabel} icon={<FileWarning size={15} />}   index={4} />
      </div>

      {/* ── Row 2: Perf trend + Duration distribution ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionDeliveryPCCTrend}>
          {!chartsReady ? <div className="h-[280px]" /> : perfTrend.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildPerfTrendOption(perfTrend, { deliveryRate: p.seriesDeliveryRate, underTariff: p.seriesUnderTariff }, ct)}
              style={{ height: 280 }}
              notMerge
              lazyUpdate
            />
          )}
        </SectionCard>

        <SectionCard title={p.sectionDurationDist}>
          {!chartsReady ? <div className="h-[280px]" /> : durationBuckets.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildDurationDistOption(durationBuckets, p.kpiAvgDurationPerf, ct)}
              style={{ height: 280 }}
              notMerge
              lazyUpdate
            />
          )}
        </SectionCard>
      </div>

      {/* ── Row 3: Agency PCC Ranking + Claims by Type ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionAgencyPCCRanking}>
          {!chartsReady ? <div className="h-[280px]" /> : (
            <BarChart
              data={agencyBarData}
              height={280}
              color="#F59E0B"
              horizontal
              label="%"
              markLine={{ value: 15, label: "Seuil 15%", color: "#EF4444" }}
            />
          )}
        </SectionCard>

        <SectionCard title={p.sectionClaimsType}>
          {!chartsReady ? <div className="h-[280px]" /> : <PieChart data={claimsPieData} height={280} />}
        </SectionCard>
      </div>
    </div>
  );
}
