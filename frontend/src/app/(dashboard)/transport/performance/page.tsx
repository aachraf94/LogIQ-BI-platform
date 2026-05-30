"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { Clock, Timer, Star, AlertTriangle, Moon } from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { InfoPanel } from "@/components/ui/InfoPanel";
import type { KpiInfo } from "@/components/ui/InfoPanel";
import { useTranslation } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chartTheme";
import { useTransportStore } from "@/stores/transportStore";
import { transportAnalyticsApi } from "@/lib/api";
import { formatPercent } from "@/lib/utils";
import { getTransportKpiInfo } from "@/lib/kpi-info/transport";
import {
  mockTransportPerfKpis,
  mockTransportOnTimeTrend,
  mockTransportDelayBuckets,
  mockTransportRatingBuckets,
  mockTransportVehiclePerf,
} from "@/lib/mock-data";
import type {
  TransportPerfKpis,
  TransportOnTimeTrendPoint,
  TransportDelayBucketItem,
  TransportRatingBucketItem,
  TransportVehiclePerfItem,
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

// ─── Monthly On-Time + Avg Duration dual-line ─────────────────────────────────

function buildOnTimeTrendOption(
  trend: TransportOnTimeTrendPoint[],
  labels: { onTimeRate: string; avgDuration: string },
  ct: ReturnType<typeof useChartTheme>
) {
  const rates = trend.map((d) => d.on_time_rate_pct);
  const durations = trend.map((d) => d.avg_duration_h);

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      axisPointer: { type: "cross" as const, label: { backgroundColor: "#6366F1" } },
      formatter: (params: Array<{ seriesName: string; value: number; marker: string; name: string }>) => {
        const lines = params.map((p) => {
          const unit = p.seriesName === labels.onTimeRate ? "%" : "h";
          return `${p.marker} ${p.seriesName}: <b>${p.value}${unit}</b>`;
        });
        return `${params[0]?.name ?? ""}<br/>${lines.join("<br/>")}`;
      },
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
        min: Math.max(0, Math.floor(Math.min(...rates) - 8)),
        max: 100,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
        axisLabel: { color: ct.labelColor, fontSize: 11, formatter: (v: number) => `${v}%` },
      },
      {
        type: "value" as const,
        min: Math.max(0, Math.floor(Math.min(...durations) - 1)),
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: ct.labelColor, fontSize: 10, formatter: (v: number) => `${v}h` },
      },
    ],
    series: [
      {
        name: labels.onTimeRate,
        type: "line" as const,
        yAxisIndex: 0,
        data: rates,
        smooth: true,
        symbol: "circle", symbolSize: 5,
        lineStyle: { color: "#10B981", width: 2 },
        itemStyle: { color: "#10B981" },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(16,185,129,0.18)" },
              { offset: 1, color: "rgba(16,185,129,0)" },
            ],
          },
        },
        markLine: {
          silent: true,
          data: [{ yAxis: 80 }],
          lineStyle: { color: "#EF4444", type: "dashed" as const, width: 1.5 },
          label: { formatter: "Seuil 80%", color: "#EF4444", fontSize: 10 },
        },
      },
      {
        name: labels.avgDuration,
        type: "line" as const,
        yAxisIndex: 1,
        data: durations,
        smooth: true,
        symbol: "circle", symbolSize: 5,
        lineStyle: { color: "#F59E0B", width: 2, type: "dashed" as const },
        itemStyle: { color: "#F59E0B" },
      },
    ],
  };
}

// ─── Delay distribution bar ───────────────────────────────────────────────────

const DELAY_COLORS: Record<string, string> = {
  "Avance":    "#10B981",
  "0–15 min":  "#6366F1",
  "15–30 min": "#F59E0B",
  "30–60 min": "#EF4444",
  "> 60 min":  "#9F1239",
};

function buildDelayBucketsOption(
  buckets: TransportDelayBucketItem[],
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
        data: sorted.map((b) => ({
          value: b.nbr_requests,
          itemStyle: {
            color: DELAY_COLORS[b.bucket] ?? "#6366F1",
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barMaxWidth: 56,
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

// ─── Rating distribution bar ──────────────────────────────────────────────────

function buildRatingDistOption(
  buckets: TransportRatingBucketItem[],
  ct: ReturnType<typeof useChartTheme>
) {
  const sorted = [...buckets].sort((a, b) => a.rating - b.rating);
  const RATING_COLORS = ["#EF4444", "#F59E0B", "#EAB308", "#10B981", "#059669"];

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
        return `${p.marker} ${p.name}★<br/><b>${p.value}</b> avis`;
      },
    },
    grid: { left: 16, right: 16, top: 16, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: sorted.map((b) => `${b.rating}★`),
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 12 },
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
        data: sorted.map((b, i) => ({
          value: b.nbr_requests,
          itemStyle: { color: RATING_COLORS[i], borderRadius: [4, 4, 0, 0] },
        })),
        barMaxWidth: 56,
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

// ─── On-Time by vehicle type horizontal bar ───────────────────────────────────

function buildVehiclePerfOption(
  data: TransportVehiclePerfItem[],
  ct: ReturnType<typeof useChartTheme>
) {
  const sorted = [...data].sort((a, b) => a.on_time_rate_pct - b.on_time_rate_pct);
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
        return `${p.marker} ${p.name}<br/>Ponctualité: <b>${p.value}%</b><br/>Durée moy.: ${item?.avg_duration_h}h`;
      },
    },
    grid: { left: 16, right: 36, top: 8, bottom: 0, containLabel: true },
    xAxis: {
      type: "value" as const,
      min: 0,
      max: 100,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
      axisLabel: { color: ct.labelColor, fontSize: 10, formatter: (v: number) => `${v}%` },
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
        data: sorted.map((d) => d.on_time_rate_pct),
        itemStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: "rgba(16,185,129,0.3)" },
              { offset: 1, color: "#10B981" },
            ],
          },
          borderRadius: [0, 4, 4, 0],
        },
        barMaxWidth: 26,
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
  kpis: TransportPerfKpis
  onTimeTrend: TransportOnTimeTrendPoint[]
  delayBuckets: TransportDelayBucketItem[]
  ratingBuckets: TransportRatingBucketItem[]
  vehiclePerf: TransportVehiclePerfItem[]
}

const MOCK: PageData = {
  kpis: mockTransportPerfKpis,
  onTimeTrend: mockTransportOnTimeTrend,
  delayBuckets: mockTransportDelayBuckets,
  ratingBuckets: mockTransportRatingBuckets,
  vehiclePerf: mockTransportVehiclePerf,
};

export default function TransportPerformancePage() {
  const [data, setData] = useState<PageData>(MOCK);
  const [fetching, setFetching] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [activeKpiInfo, setActiveKpiInfo] = useState<KpiInfo | null>(null);
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
      const [kpis, onTimeTrend, delayBuckets, ratingBuckets, vehiclePerf] = await Promise.all([
        transportAnalyticsApi.perfKpis(filters),
        transportAnalyticsApi.onTimeTrend(filters),
        transportAnalyticsApi.delayBuckets(filters),
        transportAnalyticsApi.ratingBuckets(filters),
        transportAnalyticsApi.vehiclePerf(filters),
      ]);
      setData({ kpis, onTimeTrend, delayBuckets, ratingBuckets, vehiclePerf });
      setUsingMock(false);
    } catch {
      setData(MOCK);
      setUsingMock(true);
    } finally {
      setFetching(false);
    }
  }, [startDate, endDate, serviceType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const { kpis, onTimeTrend, delayBuckets, ratingBuckets, vehiclePerf } = data;

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
        <KpiCard title={p.kpiPunctuality}    value={formatPercent(kpis.on_time_rate_pct)}                       trend={kpis.pop_on_time}     trendLabel={trendLabel} icon={<Clock size={15} />}         index={0} onInfoClick={() => setActiveKpiInfo(kpiInfo.perf_on_time_rate)} />
        <KpiCard title={p.kpiAvgDuration}    value={`${kpis.avg_duration_h.toFixed(1)} ${p.durationUnit}`}     trend={-kpis.pop_duration}   trendLabel={trendLabel} icon={<Timer size={15} />}         index={1} onInfoClick={() => setActiveKpiInfo(kpiInfo.perf_avg_duration)} />
        <KpiCard title={p.kpiAvgNote}        value={`${kpis.avg_client_rating.toFixed(1)} / 5`}                trend={kpis.pop_rating}      trendLabel={trendLabel} icon={<Star size={15} />}          index={2} onInfoClick={() => setActiveKpiInfo(kpiInfo.perf_avg_rating)} />
        <KpiCard title={p.kpiAvgDelay}       value={`${kpis.avg_arrival_delay_min.toFixed(0)} ${p.minuteUnit}`} trend={-kpis.pop_delay}     trendLabel={trendLabel} icon={<AlertTriangle size={15} />} index={3} onInfoClick={() => setActiveKpiInfo(kpiInfo.perf_avg_delay)} />
        <KpiCard title={p.kpiNightShiftRate} value={formatPercent(kpis.night_shift_rate_pct)}                  trend={kpis.pop_night_shift} trendLabel={trendLabel} icon={<Moon size={15} />}          index={4} onInfoClick={() => setActiveKpiInfo(kpiInfo.perf_night_shift_rate)} />
      </div>

      <InfoPanel info={activeKpiInfo} onClose={() => setActiveKpiInfo(null)} />

      {/* ── Row 2: On-Time Trend + Delay Distribution ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionOnTimeTrend}>
          {!chartsReady ? <div className="h-[280px]" /> : onTimeTrend.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildOnTimeTrendOption(onTimeTrend, {
                onTimeRate: p.seriesOnTimeRate,
                avgDuration: p.seriesAvgDuration,
              }, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>

        <SectionCard title={p.sectionDelayBuckets}>
          {!chartsReady ? <div className="h-[280px]" /> : delayBuckets.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildDelayBucketsOption(delayBuckets, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>
      </div>

      {/* ── Row 3: Rating Distribution + Vehicle On-Time ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionRatingDist}>
          {!chartsReady ? <div className="h-[280px]" /> : ratingBuckets.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildRatingDistOption(ratingBuckets, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>

        <SectionCard title={p.sectionVehiclePerf}>
          {!chartsReady ? <div className="h-[280px]" /> : vehiclePerf.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildVehiclePerfOption(vehiclePerf, ct)}
              style={{ height: 280 }}
              notMerge lazyUpdate
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
