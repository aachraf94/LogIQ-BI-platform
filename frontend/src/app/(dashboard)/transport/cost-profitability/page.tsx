"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { DollarSign, Receipt, TrendingUp, Percent, Gauge } from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { useTranslation } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chartTheme";
import { useTransportStore } from "@/stores/transportStore";
import { transportAnalyticsApi } from "@/lib/api";
import { formatDZD } from "@/lib/utils";
import {
  mockTransportCostKpis,
  mockTransportRevCostTrend,
  mockTransportCostCategories,
  mockTransportCostPerKm,
  mockTransportTopCorridors,
} from "@/lib/mock-data";
import type {
  TransportCostKpis,
  TransportRevCostTrendPoint,
  TransportCostCategoryItem,
  TransportCostPerKmItem,
  TransportCorridorItem,
} from "@/types/transport_analytics";

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

// ─── Revenue vs Cost monthly trend ───────────────────────────────────────────

function buildRevCostTrendOption(
  trend: TransportRevCostTrendPoint[],
  labels: { revenue: string; cost: string; marginPct: string },
  ct: ReturnType<typeof useChartTheme>
) {
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      axisPointer: { type: "shadow" as const },
    },
    legend: {
      top: 0, right: 0,
      textStyle: { color: ct.legendColor, fontSize: 11 },
      itemWidth: 10, itemHeight: 10,
    },
    grid: { left: 16, right: 52, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: trend.map((d) => d.period),
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 10 },
    },
    yAxis: [
      {
        type: "value" as const,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
        axisLabel: {
          color: ct.labelColor, fontSize: 10,
          formatter: (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}k`,
        },
      },
      {
        type: "value" as const,
        name: "%",
        nameTextStyle: { color: ct.labelColor, fontSize: 10 },
        min: 0, max: 50,
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: ct.labelColor, fontSize: 10, formatter: (v: number) => `${v}%` },
      },
    ],
    series: [
      {
        name: labels.revenue,
        type: "bar" as const,
        yAxisIndex: 0,
        data: trend.map((d) => d.total_revenue),
        itemStyle: { color: "#10B981", borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 20,
      },
      {
        name: labels.cost,
        type: "bar" as const,
        yAxisIndex: 0,
        data: trend.map((d) => d.total_cost),
        itemStyle: { color: "#EF4444", borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 20,
      },
      {
        name: labels.marginPct,
        type: "line" as const,
        yAxisIndex: 1,
        data: trend.map((d) => d.marge_brute_pct),
        smooth: true,
        symbol: "circle", symbolSize: 5,
        lineStyle: { color: "#F59E0B", width: 2 },
        itemStyle: { color: "#F59E0B" },
      },
    ],
  };
}

// ─── Cost categories horizontal bar ──────────────────────────────────────────

function buildCostCategoriesOption(
  data: TransportCostCategoryItem[],
  ct: ReturnType<typeof useChartTheme>
) {
  const sorted = [...data].sort((a, b) => a.total_dzd - b.total_dzd);
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      axisPointer: { type: "shadow" as const },
      formatter: (params: Array<{ name: string; value: number; marker: string }>) => {
        const p = params[0];
        return `${p.marker} ${p.name}<br/><b>${p.value.toLocaleString("fr-DZ")} DZD</b>`;
      },
    },
    grid: { left: 16, right: 24, top: 8, bottom: 0, containLabel: true },
    xAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
      axisLabel: {
        color: ct.labelColor, fontSize: 10,
        formatter: (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}k`,
      },
    },
    yAxis: {
      type: "category" as const,
      data: sorted.map((d) => d.label),
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 11 },
    },
    series: [
      {
        type: "bar" as const,
        data: sorted.map((d) => d.total_dzd),
        itemStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: "rgba(239,68,68,0.3)" },
              { offset: 1, color: "#EF4444" },
            ],
          },
          borderRadius: [0, 4, 4, 0],
        },
        barMaxWidth: 24,
        label: {
          show: true,
          position: "right" as const,
          color: ct.legendColor,
          fontSize: 10,
          formatter: (p: { value: number }) =>
            p.value >= 1_000_000
              ? `${(p.value / 1_000_000).toFixed(1)}M`
              : `${(p.value / 1_000).toFixed(0)}k`,
        },
      },
    ],
  };
}

// ─── Cost per KM by vehicle type ─────────────────────────────────────────────

function buildCostPerKmOption(
  data: TransportCostPerKmItem[],
  ct: ReturnType<typeof useChartTheme>
) {
  const sorted = [...data].sort((a, b) => a.cout_par_km - b.cout_par_km);

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      axisPointer: { type: "shadow" as const },
      formatter: (params: Array<{ name: string; value: number; marker: string }>) => {
        const p = params[0];
        const item = data.find((d) => d.vehicle_type === p.name);
        return [
          `${p.marker} ${p.name}`,
          `Coût/km: <b>${p.value} DZD</b>`,
          `Distance totale: ${item ? (item.total_km / 1000).toFixed(1) : 0}k km`,
          `${item?.nbr_requests ?? 0} demandes`,
        ].join("<br/>");
      },
    },
    grid: { left: 16, right: 48, top: 8, bottom: 0, containLabel: true },
    xAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
      axisLabel: { color: ct.labelColor, fontSize: 10, formatter: (v: number) => `${v} DZD` },
    },
    yAxis: {
      type: "category" as const,
      data: sorted.map((d) => d.vehicle_type),
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 11 },
    },
    series: [
      {
        type: "bar" as const,
        data: sorted.map((d) => d.cout_par_km),
        itemStyle: {
          color: (params: { dataIndex: number }) => {
            const item = sorted[params.dataIndex];
            const ratio = item ? item.cout_par_km / 50 : 0;
            const r = Math.round(16 + ratio * (239 - 16));
            const g = Math.round(185 - ratio * (185 - 68));
            const b = Math.round(129 - ratio * (129 - 68));
            return `rgb(${r},${g},${b})`;
          },
          borderRadius: [0, 4, 4, 0],
        },
        barMaxWidth: 28,
        label: {
          show: true,
          position: "right" as const,
          color: ct.legendColor,
          fontSize: 11,
          fontWeight: 600,
          formatter: (p: { value: number }) => `${p.value} DZD`,
        },
      },
    ],
  };
}

// ─── Top corridors horizontal bar ────────────────────────────────────────────

function buildTopCorridorsOption(
  data: TransportCorridorItem[],
  ct: ReturnType<typeof useChartTheme>
) {
  const sorted = [...data].sort((a, b) => a.taux_marge_pct - b.taux_marge_pct);
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      axisPointer: { type: "shadow" as const },
      formatter: (params: Array<{ name: string; value: number; marker: string }>) => {
        const p = params[0];
        const item = data.find((d) => d.corridor === p.name);
        return `${p.marker} ${p.name}<br/>Marge: <b>${p.value}%</b><br/>${item?.nbr_requests ?? 0} demandes`;
      },
    },
    grid: { left: 16, right: 36, top: 8, bottom: 0, containLabel: true },
    xAxis: {
      type: "value" as const,
      min: 0, max: 40,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
      axisLabel: { color: ct.labelColor, fontSize: 10, formatter: (v: number) => `${v}%` },
    },
    yAxis: {
      type: "category" as const,
      data: sorted.map((d) => d.corridor),
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 10 },
    },
    series: [
      {
        type: "bar" as const,
        data: sorted.map((d) => d.taux_marge_pct),
        itemStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: "rgba(99,102,241,0.3)" },
              { offset: 1, color: "#6366F1" },
            ],
          },
          borderRadius: [0, 4, 4, 0],
        },
        barMaxWidth: 22,
        label: {
          show: true,
          position: "right" as const,
          color: ct.legendColor,
          fontSize: 10,
          formatter: (p: { value: number }) => `${p.value}%`,
        },
      },
    ],
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageData {
  kpis: TransportCostKpis
  revCostTrend: TransportRevCostTrendPoint[]
  costCategories: TransportCostCategoryItem[]
  costPerKm: TransportCostPerKmItem[]
  topCorridors: TransportCorridorItem[]
}

const MOCK: PageData = {
  kpis: mockTransportCostKpis,
  revCostTrend: mockTransportRevCostTrend,
  costCategories: mockTransportCostCategories,
  costPerKm: mockTransportCostPerKm,
  topCorridors: mockTransportTopCorridors,
};

export default function TransportCostPage() {
  const [data, setData] = useState<PageData>(MOCK);
  const [fetching, setFetching] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    raf.current = requestAnimationFrame(() =>
      requestAnimationFrame(() => setChartsReady(true))
    );
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  const { t } = useTranslation();
  const p = t.pages.transport;
  const ct = useChartTheme();

  const { startDate, endDate, serviceType, rangeDays, setUsingMock } = useTransportStore();
  const days = rangeDays();
  const trendLabel = `vs ${days} j précédents`;

  const filters = {
    start_date: startDate,
    end_date: endDate,
    service_type: serviceType !== "all" ? serviceType : undefined,
  };

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [kpis, revCostTrend, costCategories, costPerKm, topCorridors] = await Promise.all([
        transportAnalyticsApi.costKpis(filters),
        transportAnalyticsApi.revCostTrend(filters),
        transportAnalyticsApi.costCategories(filters),
        transportAnalyticsApi.costPerKm(filters),
        transportAnalyticsApi.topCorridors({ ...filters, limit: 8 }),
      ]);
      setData({ kpis, revCostTrend, costCategories, costPerKm, topCorridors });
      setUsingMock(false);
    } catch {
      setData(MOCK);
      setUsingMock(true);
    } finally {
      setFetching(false);
    }
  }, [startDate, endDate, serviceType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const { kpis, revCostTrend, costCategories, costPerKm, topCorridors } = data;

  return (
    <div className="space-y-5">
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

      {/* ── Row 1: KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard title={p.kpiTotalRevenue} value={formatDZD(kpis.total_revenue)}              trend={kpis.pop_revenue}      trendLabel={trendLabel} icon={<DollarSign size={15} />} index={0} />
        <KpiCard title={p.kpiTotalCost}    value={formatDZD(kpis.total_cost)}                 trend={-kpis.pop_cost}        trendLabel={trendLabel} icon={<Receipt size={15} />}    index={1} />
        <KpiCard title={p.kpiGrossMargin}  value={formatDZD(kpis.marge_brute_dzd)}            trend={kpis.pop_margin_dzd}   trendLabel={trendLabel} icon={<TrendingUp size={15} />} index={2} />
        <KpiCard title={p.kpiMarginPct}    value={`${kpis.marge_brute_pct.toFixed(1)}%`}      trend={kpis.pop_margin_pct}   trendLabel={trendLabel} icon={<Percent size={15} />}    index={3} />
        <KpiCard title={p.kpiCostPerKm}    value={`${kpis.cout_par_km.toFixed(1)} DZD/km`}   trend={-kpis.pop_cout_par_km} trendLabel={trendLabel} icon={<Gauge size={15} />}      index={4} />
      </div>

      {/* ── Row 2: Rev vs Cost trend + Cost categories ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionRevCostTrend}>
          {!chartsReady ? <div className="h-[280px]" /> : revCostTrend.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildRevCostTrendOption(revCostTrend, {
                revenue: p.seriesRevenue, cost: p.seriesCost, marginPct: p.seriesMarginPct,
              }, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>

        <SectionCard title={p.sectionCostCategories}>
          {!chartsReady ? <div className="h-[280px]" /> : costCategories.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildCostCategoriesOption(costCategories, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>
      </div>

      {/* ── Row 3: Cost per KM + Top corridors ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionCostPerKm}>
          {!chartsReady ? <div className="h-[280px]" /> : costPerKm.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildCostPerKmOption(costPerKm, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>

        <SectionCard title={p.sectionTopCorridors}>
          {!chartsReady ? <div className="h-[280px]" /> : topCorridors.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildTopCorridorsOption(topCorridors, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
