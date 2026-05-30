"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { Truck, CheckCircle2, XCircle, Route, MapPin } from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { InfoPanel } from "@/components/ui/InfoPanel";
import type { KpiInfo } from "@/components/ui/InfoPanel";
import { KpiDataTableModal } from "@/components/ui/KpiDataTableModal";
import { useTranslation } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chartTheme";
import { useTransportStore } from "@/stores/transportStore";
import { transportAnalyticsApi } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { getTransportKpiInfo } from "@/lib/kpi-info/transport";
import {
  mockTransportOpsKpis,
  mockTransportMonthlyTrend,
  mockTransportServiceBreakdown,
  mockTransportODMatrix,
  mockTransportDistanceCategory,
} from "@/lib/mock-data";
import type {
  TransportOpsKpis,
  TransportMonthlyTrendPoint,
  TransportServiceBreakdownItem,
  TransportODItem,
  TransportDistanceCategoryItem,
} from "@/types/transport_analytics";

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

// ─── Monthly Volume stacked bar ───────────────────────────────────────────────

function buildMonthlyVolumeOption(
  trend: TransportMonthlyTrendPoint[],
  labels: { terminees: string; enCours: string; annulees: string },
  ct: ReturnType<typeof useChartTheme>
) {
  const cats = trend.map((d) => d.period);
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
      axisLine: { show: false },
      splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
      axisLabel: { color: ct.labelColor, fontSize: 11 },
    },
    series: [
      {
        name: labels.terminees,
        type: "bar" as const,
        stack: "total",
        data: trend.map((d) => d.nbr_terminees),
        itemStyle: { color: "#10B981" },
        barMaxWidth: 36,
      },
      {
        name: labels.enCours,
        type: "bar" as const,
        stack: "total",
        data: trend.map((d) => d.nbr_en_cours),
        itemStyle: { color: "#6366F1" },
      },
      {
        name: labels.annulees,
        type: "bar" as const,
        stack: "total",
        data: trend.map((d) => d.nbr_annulees),
        itemStyle: { color: "#EF4444" },
        barMaxWidth: 36,
      },
    ],
  };
}

// ─── Service type pie ─────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  course_dediee: "Course dédiée",
  courrier:      "Courrier",
  manutention:   "Manutention",
};

const SERVICE_COLORS = ["#6366F1", "#10B981", "#F59E0B"];

function buildServicePieOption(
  data: TransportServiceBreakdownItem[],
  ct: ReturnType<typeof useChartTheme>
) {
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/><b>${p.value}</b> demandes (${p.percent}%)`,
    },
    legend: {
      orient: "vertical" as const,
      right: 0,
      top: "center",
      textStyle: { color: ct.legendColor, fontSize: 11 },
      itemWidth: 10, itemHeight: 10,
    },
    series: [
      {
        type: "pie" as const,
        radius: ["38%", "68%"],
        center: ["38%", "50%"],
        data: data.map((d, i) => ({
          name: SERVICE_LABELS[d.service_type] ?? d.service_type,
          value: d.nbr_requests,
          itemStyle: { color: SERVICE_COLORS[i % SERVICE_COLORS.length] },
        })),
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.3)" },
        },
      },
    ],
  };
}

// ─── OD heatmap ───────────────────────────────────────────────────────────────

const OD_WILAYAS = ["Alger", "Oran", "Constantine", "Annaba", "Sétif", "Blida", "Batna"];

function buildODHeatmapOption(
  items: TransportODItem[],
  ct: ReturnType<typeof useChartTheme>
) {
  const lookup: Record<string, number> = {};
  items.forEach((d) => { lookup[`${d.origin}|${d.destination}`] = d.nbr_requests; });

  const matrixData: [number, number, number][] = [];
  let maxVal = 0;
  OD_WILAYAS.forEach((origin, xi) => {
    OD_WILAYAS.forEach((dest, yi) => {
      const v = lookup[`${origin}|${dest}`] ?? 0;
      matrixData.push([xi, yi, v]);
      if (v > maxVal) maxVal = v;
    });
  });

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      formatter: (p: { data: [number, number, number] }) => {
        const [xi, yi, v] = p.data;
        return `${OD_WILAYAS[xi]} → ${OD_WILAYAS[yi]}<br/><b>${v}</b> demandes`;
      },
    },
    grid: { left: 8, right: 80, top: 8, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: OD_WILAYAS,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisLabel: { color: ct.labelColor, fontSize: 10, rotate: 25 },
      splitArea: { show: true, areaStyle: { color: ["transparent", "transparent"] } },
    },
    yAxis: {
      type: "category" as const,
      data: OD_WILAYAS,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisLabel: { color: ct.labelColor, fontSize: 10 },
      splitArea: { show: true, areaStyle: { color: ["transparent", "transparent"] } },
    },
    visualMap: {
      min: 0,
      max: maxVal || 1,
      calculable: false,
      orient: "vertical" as const,
      right: 4,
      top: "center",
      inRange: { color: ["#1e293b", "#6366F1", "#A5B4FC"] },
      textStyle: { color: ct.legendColor, fontSize: 10 },
    },
    series: [
      {
        type: "heatmap" as const,
        data: matrixData,
        label: {
          show: true,
          color: "#fff",
          fontSize: 9,
          formatter: (p: { data: [number, number, number] }) => p.data[2] || "",
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" } },
      },
    ],
  };
}

// ─── Distance category bar ────────────────────────────────────────────────────

function buildDistanceCategoryOption(
  data: TransportDistanceCategoryItem[],
  ct: ReturnType<typeof useChartTheme>
) {
  const DIST_COLORS: Record<string, string> = {
    local: "#10B981", regional: "#6366F1", national: "#F59E0B",
  };
  const total = data.reduce((s, d) => s + d.nbr_requests, 0) || 1;

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
        return `${p.marker} ${p.name}<br/><b>${p.value}</b> demandes (${((p.value / total) * 100).toFixed(1)}%)`;
      },
    },
    grid: { left: 16, right: 16, top: 24, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: data.map((d) => `${d.distance_category}\n${d.km_range}`),
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 10 },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
      axisLabel: { color: ct.labelColor, fontSize: 11 },
    },
    series: [
      {
        type: "bar" as const,
        data: data.map((d) => ({
          value: d.nbr_requests,
          itemStyle: { color: DIST_COLORS[d.distance_category] ?? "#6366F1", borderRadius: [4, 4, 0, 0] },
        })),
        barMaxWidth: 72,
        label: {
          show: true,
          position: "top" as const,
          color: ct.legendColor,
          fontSize: 10,
          formatter: (p: { value: number }) =>
            `${p.value}\n(${((p.value / total) * 100).toFixed(0)}%)`,
        },
      },
    ],
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageData {
  kpis: TransportOpsKpis
  trend: TransportMonthlyTrendPoint[]
  serviceBreakdown: TransportServiceBreakdownItem[]
  odMatrix: TransportODItem[]
  distanceCategory: TransportDistanceCategoryItem[]
}

const MOCK: PageData = {
  kpis: mockTransportOpsKpis,
  trend: mockTransportMonthlyTrend,
  serviceBreakdown: mockTransportServiceBreakdown,
  odMatrix: mockTransportODMatrix,
  distanceCategory: mockTransportDistanceCategory,
};

export default function TransportOperationsPage() {
  const [data, setData] = useState<PageData>(MOCK);
  const [fetching, setFetching] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [activeKpi, setActiveKpi] = useState<{ key: import("@/lib/kpi-info/transport").TransportKpiKey; info: KpiInfo } | null>(null);
  const [tableKpiKey, setTableKpiKey] = useState<import("@/lib/kpi-info/transport").TransportKpiKey | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    raf.current = requestAnimationFrame(() =>
      requestAnimationFrame(() => setChartsReady(true))
    );
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  const { t, locale } = useTranslation();
  const p = t.pages.transport;
  const ct = useChartTheme();
  const kpiInfo = getTransportKpiInfo(locale);

  const { startDate, endDate, serviceType, rangeDays, setUsingMock, usingMock } = useTransportStore();
  const days = rangeDays();
  const trendLabel = `vs ${days} j précédents`;

  const filters = useMemo(() => ({
    start_date: startDate,
    end_date: endDate,
    service_type: serviceType !== "all" ? serviceType : undefined,
  }), [startDate, endDate, serviceType]);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [kpis, trend, serviceBreakdown, odMatrix, distanceCategory] = await Promise.all([
        transportAnalyticsApi.opsKpis(filters),
        transportAnalyticsApi.monthlyTrend(filters),
        transportAnalyticsApi.serviceBreakdown(filters),
        transportAnalyticsApi.odMatrix(filters),
        transportAnalyticsApi.distanceCategory(filters),
      ]);
      setData({ kpis, trend, serviceBreakdown, odMatrix, distanceCategory });
      setUsingMock(false);
    } catch {
      setData(MOCK);
      setUsingMock(true);
    } finally {
      setFetching(false);
    }
  }, [startDate, endDate, serviceType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const { kpis, trend, serviceBreakdown, odMatrix, distanceCategory } = data;

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
        <KpiCard title={p.kpiTotalRequests}    value={formatNumber(kpis.nbr_requests)}              trend={kpis.pop_requests}           trendLabel={trendLabel} icon={<Truck size={15} />}       index={0} onInfoClick={() => setActiveKpi({ key: "ops_total_requests",    info: kpiInfo.ops_total_requests })} />
        <KpiCard title={p.kpiCompletionRate}   value={`${kpis.completion_rate_pct.toFixed(1)}%`}    trend={kpis.pop_completion_rate}    trendLabel={trendLabel} icon={<CheckCircle2 size={15} />} index={1} onInfoClick={() => setActiveKpi({ key: "ops_completion_rate",   info: kpiInfo.ops_completion_rate })} />
        <KpiCard title={p.kpiCancellationRate} value={`${kpis.cancellation_rate_pct.toFixed(1)}%`}  trend={-kpis.pop_cancellation_rate} trendLabel={trendLabel} icon={<XCircle size={15} />}     index={2} onInfoClick={() => setActiveKpi({ key: "ops_cancellation_rate", info: kpiInfo.ops_cancellation_rate })} />
        <KpiCard title={p.kpiAvgDistance}      value={`${kpis.avg_distance_km.toFixed(1)} km`}      trend={kpis.pop_distance}           trendLabel={trendLabel} icon={<Route size={15} />}        index={3} onInfoClick={() => setActiveKpi({ key: "ops_avg_distance",      info: kpiInfo.ops_avg_distance })} />
        <KpiCard title={p.kpiAvgStops}         value={kpis.avg_stops.toFixed(1)}                    trend={kpis.pop_stops}              trendLabel={trendLabel} icon={<MapPin size={15} />}       index={4} onInfoClick={() => setActiveKpi({ key: "ops_avg_stops",          info: kpiInfo.ops_avg_stops })} />
      </div>

      <InfoPanel
        info={activeKpi?.info ?? null}
        onClose={() => setActiveKpi(null)}
        onViewDataTable={() => { if (activeKpi) { setTableKpiKey(activeKpi.key); setActiveKpi(null); } }}
      />
      <KpiDataTableModal
        kpiKey={tableKpiKey}
        kpiTitle={tableKpiKey ? kpiInfo[tableKpiKey].title : ""}
        filters={filters}
        usingMock={usingMock}
        onClose={() => setTableKpiKey(null)}
      />

      {/* ── Row 2: Monthly Volume + Service Breakdown ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionMonthlyVolume}>
          {!chartsReady ? <div className="h-[280px]" /> : trend.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildMonthlyVolumeOption(trend, {
                terminees: p.seriesTerminees,
                enCours: p.seriesEnCours,
                annulees: p.seriesAnnulees,
              }, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>

        <SectionCard title={p.sectionServicePie}>
          {!chartsReady ? <div className="h-[280px]" /> : serviceBreakdown.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildServicePieOption(serviceBreakdown, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>
      </div>

      {/* ── Row 3: OD Matrix + Distance Category ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionODMatrix}>
          {!chartsReady ? <div className="h-[280px]" /> : odMatrix.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildODHeatmapOption(odMatrix, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>

        <SectionCard title={p.sectionDistanceCategory}>
          {!chartsReady ? <div className="h-[280px]" /> : distanceCategory.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildDistanceCategoryOption(distanceCategory, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
