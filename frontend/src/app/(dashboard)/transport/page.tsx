"use client";

import { useEffect, useState, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import {
  Truck, TrendingUp, DollarSign, Gauge, Star, Ban,
  Route, PackageCheck, ChevronDown,
} from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { DataTable } from "@/components/ui/DataTable";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { AreaChart } from "@/components/charts/AreaChart";
import type { Column } from "@/components/ui/DataTable";
import { useTranslation } from "@/lib/i18n"
import { useChartTheme } from "@/lib/chartTheme";

import { transportApi } from "@/lib/api";
import { formatDZD, formatNumber, formatPercent } from "@/lib/utils";
import {
  mockTransportSummary,
  mockTransportTrends,
  mockTransportCostBreakdown,
  mockTransportByService,
  mockTransportByVehicle,
  mockTransportCorridors,
  mockODMatrix,
  mockTransportByAgency,
  mockDelayDistribution,
} from "@/lib/mock-data";

import type {
  TransportSummary,
  TransportTrendPoint,
  TransportCostBreakdown,
  TransportServiceData,
  TransportVehicleData,
  TransportCorridor,
  ODMatrixCell,
  TransportAgencyData,
  DelayBucket,
} from "@/types/transport";

// ─── Constants ────────────────────────────────────────────────────────────────

const YEARS = [2023, 2024, 2025];
// MONTHS, SERVICE_TYPES, COST_LABELS, REGION_ORDER are built inside the component from translations

// ─── Chart theme type ─────────────────────────────────────────────────────────

interface CT {
  tooltip: { backgroundColor: string; borderColor: string; textStyle: { color: string; fontSize: number } }
  splitLine: { lineStyle: { color: string; type: "dashed" } }
  axisLabel: { color: string; fontSize: number }
  axisColor: string; legendColor: string; labelColor: string; textColor: string; surface: string; bgColor: string;
}

// ─── Page state ───────────────────────────────────────────────────────────────

interface PageData {
  summary: TransportSummary;
  trends: TransportTrendPoint[];
  costBreakdown: TransportCostBreakdown;
  byService: TransportServiceData[];
  byVehicle: TransportVehicleData[];
  corridors: TransportCorridor[];
  odMatrix: ODMatrixCell[];
  byAgency: TransportAgencyData[];
  delays: DelayBucket[];
}

const MOCK_DATA: PageData = {
  summary: mockTransportSummary,
  trends: mockTransportTrends,
  costBreakdown: mockTransportCostBreakdown,
  byService: mockTransportByService,
  byVehicle: mockTransportByVehicle,
  corridors: mockTransportCorridors,
  odMatrix: mockODMatrix,
  byAgency: mockTransportByAgency,
  delays: mockDelayDistribution,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Select({
  value,
  onChange,
  options,
}: {
  value: string | number | null;
  onChange: (v: string | number | null) => void;
  options: { label: string; value: string | number | null }[];
}) {
  return (
    <div className="relative">
      <select
        value={value === null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") { onChange(null); return; }
          const num = Number(raw);
          onChange(isNaN(num) ? raw : num);
        }}
        className="appearance-none bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-primary/60 cursor-pointer"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value === null ? "" : String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

function SectionCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Skeleton({ h = "h-64" }: { h?: string }) {
  return <div className={`${h} bg-[var(--surface-secondary)] animate-pulse rounded-lg`} />;
}

// ─── OD Matrix chart option ───────────────────────────────────────────────────

function buildODOption(
  cells: ODMatrixCell[],
  regionOrder: string[],
  labels: { requests: string; margin: string; destination: string; origin: string },
  ct: CT,
) {
  const regions = regionOrder;
  const data: [number, number, number][] = [];
  let max = 0;

  cells.forEach((c) => {
    const xi = regions.indexOf(c.destination);
    const yi = regions.indexOf(c.origin);
    if (xi === -1 || yi === -1) return;
    data.push([xi, yi, c.nbr_requests]);
    if (c.nbr_requests > max) max = c.nbr_requests;
  });

  return {
    backgroundColor: "transparent",
    tooltip: {
      ...ct.tooltip,
      position: "top",
      formatter: (p: { data: [number, number, number] }) => {
        const cell = cells.find(
          (c) => regions.indexOf(c.destination) === p.data[0] && regions.indexOf(c.origin) === p.data[1]
        );
        return cell
          ? `${cell.origin} → ${cell.destination}<br/>${cell.nbr_requests} ${labels.requests}<br/>${labels.margin}: ${cell.taux_marge_pct ?? "—"}%`
          : "";
      },
    },
    grid: { left: 100, right: 20, top: 10, bottom: 40 },
    xAxis: {
      type: "category" as const,
      data: regions,
      name: labels.destination,
      nameLocation: "middle" as const,
      nameGap: 25,
      nameTextStyle: { color: ct.labelColor, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ct.legendColor, fontSize: 11 },
    },
    yAxis: {
      type: "category" as const,
      data: regions,
      name: labels.origin,
      nameLocation: "middle" as const,
      nameGap: 80,
      nameTextStyle: { color: ct.labelColor, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ct.legendColor, fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max: max || 1,
      show: false,
      inRange: { color: [ct.surface, "#6366F1"] },
    },
    series: [{
      type: "heatmap" as const,
      data,
      label: {
        show: true,
        formatter: (p: { data: [number, number, number] }) => p.data[2] > 0 ? String(p.data[2]) : "",
        color: ct.textColor,
        fontSize: 13,
        fontWeight: "bold" as const,
      },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(99,102,241,0.5)" } },
      itemStyle: { borderRadius: 6, borderColor: ct.bgColor, borderWidth: 3 },
    }],
  };
}

// ─── Request status stacked bar ───────────────────────────────────────────────

function buildStatusStackedOption(
  trends: TransportTrendPoint[],
  cats: string[],
  series: { completed: string; inProgress: string; cancelled: string },
  ct: CT,
) {
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" as const, ...ct.tooltip, axisPointer: { type: "shadow" as const } },
    legend: { top: 0, right: 0, textStyle: { color: ct.legendColor, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    grid: { left: 16, right: 16, top: 40, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: cats,
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { ...ct.axisLabel, rotate: 30 },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: ct.splitLine,
      axisLabel: ct.axisLabel,
    },
    series: [
      { name: series.completed,  type: "bar" as const, stack: "s", data: trends.map((t) => t.nbr_terminees), itemStyle: { color: "#10B981" } },
      { name: series.inProgress, type: "bar" as const, stack: "s", data: trends.map((t) => t.nbr_requests - t.nbr_terminees - t.nbr_annulees), itemStyle: { color: "#F59E0B" } },
      { name: series.cancelled,  type: "bar" as const, stack: "s", data: trends.map((t) => t.nbr_annulees), itemStyle: { color: "#EF4444", borderRadius: [4, 4, 0, 0] } },
    ],
  };
}

// ─── On-time gauge ────────────────────────────────────────────────────────────

function buildOnTimeGaugeOption(value: number, gaugeLabel: string, ct: CT) {
  return {
    backgroundColor: "transparent",
    series: [{
      type: "gauge" as const,
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      splitNumber: 5,
      radius: "85%",
      center: ["50%", "60%"],
      axisLine: {
        lineStyle: {
          width: 18,
          color: [[0.7, "#EF4444"], [0.85, "#F59E0B"], [1, "#10B981"]] as [number, string][],
        },
      },
      pointer: {
        icon: "path://M12.8,0.7l12.3,42H0.5L12.8,0.7z",
        length: "12%",
        width: 20,
        offsetCenter: [0, "-60%"],
        itemStyle: { color: "auto" },
      },
      axisTick: { length: 8, lineStyle: { color: "auto", width: 2 } },
      splitLine: { length: 14, lineStyle: { color: "auto", width: 3 } },
      axisLabel: { color: ct.legendColor, fontSize: 11, distance: -48, formatter: (v: number) => `${v}%` },
      title: { offsetCenter: [0, "30%"], fontSize: 12, color: ct.legendColor },
      detail: {
        valueAnimation: true,
        fontSize: 30,
        fontWeight: "bold" as const,
        offsetCenter: [0, "5%"],
        color: ct.textColor,
        formatter: "{value}%",
      },
      data: [{ value: Math.round(value * 10) / 10, name: gaugeLabel }],
    }],
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TransportPage() {
  const [year, setYear] = useState<number>(2025);
  const [month, setMonth] = useState<number | null>(null);
  const [serviceType, setServiceType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [data, setData] = useState<PageData>(MOCK_DATA);

  const { t } = useTranslation();
  const p = t.pages.transport;
  const pc = t.pages.common;
  const chartT = useChartTheme();
  const ct: CT = {
    tooltip: { backgroundColor: chartT.tooltipBg, borderColor: chartT.borderColor, textStyle: { color: chartT.textColor, fontSize: 12 } },
    splitLine: { lineStyle: { color: chartT.splitColor, type: "dashed" } },
    axisLabel: { color: chartT.labelColor, fontSize: 11 },
    axisColor: chartT.axisColor,
    legendColor: chartT.legendColor,
    labelColor: chartT.labelColor,
    textColor: chartT.textColor,
    surface: chartT.surface,
    bgColor: chartT.bgColor,
  };

  const MONTHS = [
    { label: pc.monthAll, value: null },
    ...pc.months.map((name, i) => ({ label: name, value: i + 1 })),
  ];
  const SERVICE_TYPES = [
    { label: p.allServices, value: "all" },
    { label: p.dedicatedTrip, value: "course_dediee" },
    { label: p.courier, value: "courrier" },
    { label: p.handling, value: "manutention" },
  ];
  const COST_LABELS = p.costLabels;
  const REGION_ORDER = ["Nord", "Hauts Plateaux", "Sud"];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const f = { year, month: month ?? undefined, service_type: serviceType !== "all" ? serviceType : undefined };
    try {
      const [summary, trends, costBreakdown, byService, byVehicle, corridors, odMatrix, byAgency, delays] =
        await Promise.all([
          transportApi.summary({ year, month, service_type: serviceType }),
          transportApi.trends({ service_type: serviceType }),
          transportApi.costBreakdown(f),
          transportApi.byService({ year, month }),
          transportApi.byVehicle({ year, month }),
          transportApi.corridors({ year, month, service_type: serviceType, limit: 10 }),
          transportApi.odMatrix({ year, month }),
          transportApi.byAgency({ year, month, service_type: serviceType }),
          transportApi.delayDistribution(f),
        ]);
      setData({ summary, trends, costBreakdown, byService, byVehicle, corridors, odMatrix, byAgency, delays });
      setUsingMock(false);
    } catch {
      setData(MOCK_DATA);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [year, month, serviceType]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { summary, trends, costBreakdown, byService, byVehicle, corridors, odMatrix, byAgency, delays } = data;
  const { current: cur, derived: d } = summary;

  // ── Derived chart data ──────────────────────────────────────────────────────

  const areaData = trends.map((tr) => ({
    month: `${pc.monthsShort[tr.month_num - 1] ?? tr.month_name_fr.slice(0, 3)} ${String(tr.year).slice(2)}`,
    revenue: tr.total_revenue,
    cost: tr.total_cost,
  }));

  const costBreakdownMap = costBreakdown as unknown as Record<string, number>;
  const costDonutData = Object.entries(COST_LABELS)
    .map(([key, label]) => ({ name: label, value: Math.round(costBreakdownMap[key] ?? 0) }))
    .filter((x) => x.value > 0);

  const serviceVolData = byService.reduce<Record<string, number>>((acc, s) => {
    acc[s.service_type] = (acc[s.service_type] ?? 0) + s.nbr_requests;
    return acc;
  }, {});
  const servicePieData = Object.entries(serviceVolData).map(([k, v]) => ({
    name: k === "course_dediee" ? p.dedicatedTrip : k.charAt(0).toUpperCase() + k.slice(1),
    value: v,
  }));

  const trendCats = trends.map((tr) => `${pc.monthsShort[tr.month_num - 1] ?? tr.month_name_fr.slice(0, 3)} ${String(tr.year).slice(2)}`);

  const onTimeTrend = {
    categories: trendCats,
    series: [{ name: p.punctualitySeries, data: trends.map((tr) => tr.taux_ponctualite_pct), color: "#6366F1" }],
  };

  const costKmTrend = {
    categories: trendCats,
    series: [{ name: p.costKmSeries, data: trends.map((tr) => tr.cout_par_km), color: "#F59E0B" }],
  };

  const vehicleBarData = byVehicle.map((v) => ({ name: v.vehicle_type, value: v.cout_par_km }));
  const delayBarData   = delays.map((d) => ({ name: d.bucket, value: d.count }));

  // ── Column defs ─────────────────────────────────────────────────────────────

  const corridorCols: Column<TransportCorridor>[] = [
    { key: "wilaya_depart_name",  header: p.colOrigin,      sortable: true },
    { key: "wilaya_arrivee_name", header: p.colDestination, sortable: true },
    {
      key: "meme_region", header: p.colRegion,
      render: (r) => (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.meme_region ? "bg-emerald-500/10 text-emerald-400" : "bg-indigo-500/10 text-indigo-400"}`}>
          {r.meme_region ? "Intra" : "Inter"}
        </span>
      ),
    },
    { key: "nbr_requests",    header: p.colRequests,   sortable: true },
    {
      key: "taux_marge_pct", header: p.colMarginPct, sortable: true,
      render: (r) => (
        <span className={`font-semibold ${r.taux_marge_pct >= 24 ? "text-emerald-400" : r.taux_marge_pct >= 20 ? "text-amber-400" : "text-red-400"}`}>
          {r.taux_marge_pct?.toFixed(1) ?? "—"}%
        </span>
      ),
    },
    { key: "avg_distance_km", header: p.colAvgDist, sortable: true, render: (r) => `${r.avg_distance_km ?? "—"} km` },
    { key: "cout_par_km",     header: p.colDzdKm,   sortable: true, render: (r) => `${r.cout_par_km ?? "—"}` },
    {
      key: "total_revenue", header: p.colRevenue, sortable: true,
      render: (r) => <span className="font-mono text-sm">{formatDZD(r.total_revenue)}</span>,
    },
  ];

  const agencyCols: Column<TransportAgencyData>[] = [
    { key: "agence_name",          header: p.colAgency,     sortable: true },
    { key: "wilaya_dispatch_name", header: p.colWilaya,     sortable: true },
    { key: "region",               header: p.colRegion,     sortable: true },
    { key: "nbr_requests",         header: p.colRequests,   sortable: true },
    {
      key: "completion_rate", header: p.colCompletion, sortable: true,
      render: (r) => <span className={r.completion_rate >= 85 ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>{r.completion_rate?.toFixed(1) ?? "—"}%</span>,
    },
    {
      key: "taux_ponctualite_pct", header: p.colPunctuality, sortable: true,
      render: (r) => <span className={r.taux_ponctualite_pct >= 88 ? "text-emerald-400" : r.taux_ponctualite_pct >= 83 ? "text-amber-400" : "text-red-400"}>{r.taux_ponctualite_pct?.toFixed(1) ?? "—"}%</span>,
    },
    {
      key: "taux_marge_pct", header: p.colMarginPct, sortable: true,
      render: (r) => `${r.taux_marge_pct?.toFixed(1) ?? "—"}%`,
    },
    { key: "cout_par_km", header: p.colDzdKm, sortable: true, render: (r) => `${r.cout_par_km?.toFixed(1) ?? "—"}` },
    {
      key: "avg_note_client", header: p.colNote, sortable: true,
      render: (r) => (
        <span className="flex items-center gap-1">
          <Star size={12} className="text-amber-400" />
          {r.avg_note_client?.toFixed(1) ?? "—"}
        </span>
      ),
    },
    {
      key: "total_revenue", header: p.colRevenue, sortable: true,
      render: (r) => <span className="font-mono text-sm">{formatDZD(r.total_revenue)}</span>,
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={year} onChange={(v) => setYear(v as number)} options={YEARS.map((y) => ({ label: String(y), value: y }))} />
        <Select value={month} onChange={(v) => setMonth(v as number | null)} options={MONTHS} />
        <Select value={serviceType} onChange={(v) => setServiceType(v as string)} options={SERVICE_TYPES} />
        {usingMock && (
          <span className="ml-auto text-xs text-amber-400/80 border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 rounded-lg">
            {p.demoData}
          </span>
        )}
        {loading && (
          <span className="ml-auto text-xs text-slate-400 animate-pulse">{p.loading}</span>
        )}
      </div>

      {/* ── Primary KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title={p.kpiTotalRequests}    value={formatNumber(cur.total_requests)}       trend={d.mom_requests} trendLabel={p.vsPrevMonth} icon={<Truck size={16} />}        index={0} />
        <KpiCard title={p.kpiCompletionRate}   value={formatPercent(d.completion_rate)}       trend={d.mom_on_time}  trendLabel={p.vsPrevMonth} icon={<PackageCheck size={16} />}  index={1} />
        <KpiCard title={p.kpiTotalRevenue}     value={formatDZD(cur.total_revenue)}           trend={d.mom_revenue}  trendLabel={p.vsPrevMonth} icon={<DollarSign size={16} />}    index={2} />
        <KpiCard title={p.kpiGrossMargin}      value={formatPercent(d.gross_margin_pct)}      trend={d.mom_margin}   trendLabel={p.vsPrevMonth} icon={<TrendingUp size={16} />}    index={3} />
      </div>

      {/* ── Secondary KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title={p.kpiPunctuality}      value={formatPercent(cur.avg_ponctualite_pct)} trend={d.mom_on_time}        icon={<Gauge size={16} />}   index={4} />
        <KpiCard title={p.kpiCostPerKm}        value={`${d.cost_per_km} DZD`}                trend={0}                    icon={<Route size={16} />}   index={5} />
        <KpiCard title={p.kpiCancellationRate} value={formatPercent(d.cancellation_rate)}     trend={-d.cancellation_rate} icon={<Ban size={16} />}     index={6} />
        <KpiCard title={p.kpiAvgNote}          value={cur.avg_note_client?.toFixed(1) ?? "—"} trend={0}                   icon={<Star size={16} />}    index={7} />
      </div>

      {/* ── Trends: Revenue vs Cost + Requests by Status ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionRevenueCost}>
          {loading ? <Skeleton /> : <AreaChart data={areaData} height={280} />}
        </SectionCard>
        <SectionCard title={p.sectionRequestsByStatus}>
          {loading ? <Skeleton /> : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <ReactECharts
                option={buildStatusStackedOption(trends, trendCats, { completed: p.completedSeries, inProgress: p.inProgressSeries, cancelled: p.cancelledSeries }, ct)}
                style={{ height: 280 }}
                notMerge
              />
            </motion.div>
          )}
        </SectionCard>
      </div>

      {/* ── Cost breakdown + On-time gauge ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionCostStructure}>
          {loading ? <Skeleton /> : <PieChart data={costDonutData} height={280} />}
        </SectionCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionCard title={p.sectionCurrentPunctuality}>
            {loading ? <Skeleton h="h-full" /> : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
                <ReactECharts option={buildOnTimeGaugeOption(cur.avg_ponctualite_pct, p.kpiPunctuality, ct)} style={{ height: 220 }} notMerge />
              </motion.div>
            )}
          </SectionCard>
          <SectionCard title={p.sectionPunctualityTrend}>
            {loading ? <Skeleton h="h-full" /> : (
              <LineChart
                categories={onTimeTrend.categories}
                series={onTimeTrend.series}
                height={220}
                yFormatter={(v) => `${v}%`}
              />
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Unit cost trend + Delay histogram ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionCostKmTrend}>
          {loading ? <Skeleton /> : (
            <LineChart
              categories={costKmTrend.categories}
              series={costKmTrend.series}
              height={260}
              yFormatter={(v) => `${v} DZD`}
            />
          )}
        </SectionCard>
        <SectionCard title={p.sectionDelayDistribution}>
          {loading ? <Skeleton /> : (
            <BarChart
              data={delayBarData}
              height={260}
              color="#6366F1"
              label={p.colRequests}
            />
          )}
        </SectionCard>
      </div>

      {/* ── Service mix + Vehicle efficiency ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionServiceBreakdown}>
          {loading ? <Skeleton /> : <PieChart data={servicePieData} height={260} />}
        </SectionCard>
        <SectionCard title={p.sectionVehicleEfficiency}>
          {loading ? <Skeleton /> : (
            <BarChart
              data={vehicleBarData}
              height={260}
              color="#22D3EE"
              label="DZD/km"
              horizontal
            />
          )}
        </SectionCard>
      </div>

      {/* ── OD Matrix ── */}
      <SectionCard title={p.sectionODMatrix}>
        <div className="flex items-start gap-8">
          {loading ? <div className="flex-1 h-64 bg-[var(--surface-secondary)] animate-pulse rounded-lg" /> : (
            <motion.div className="flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <ReactECharts
                option={buildODOption(odMatrix, REGION_ORDER, { requests: p.colRequests, margin: p.colMarginPct, destination: p.colDestination, origin: p.colOrigin }, ct)}
                style={{ height: 260 }}
                notMerge
              />
            </motion.div>
          )}
          {!loading && (
            <div className="shrink-0 space-y-2 pt-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{p.marginLegend}</p>
              {odMatrix.slice(0, 6).map((cell) => (
                <div key={`${cell.origin}-${cell.destination}`} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="w-20 text-right text-slate-500">{cell.origin.slice(0, 4)}</span>
                  <span className="text-slate-600">→</span>
                  <span className="w-20">{cell.destination.slice(0, 4)}</span>
                  <span className={`font-semibold ml-auto ${(cell.taux_marge_pct ?? 0) >= 22 ? "text-emerald-400" : "text-amber-400"}`}>
                    {cell.taux_marge_pct?.toFixed(1) ?? "—"}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Top corridors table ── */}
      <SectionCard title={p.sectionCorridors}>
        {loading ? <Skeleton h="h-48" /> : (
          <DataTable columns={corridorCols} data={corridors} />
        )}
      </SectionCard>

      {/* ── Agency ranking ── */}
      <SectionCard title={p.sectionAgencyPerformance}>
        {loading ? <Skeleton h="h-48" /> : (
          <DataTable columns={agencyCols} data={byAgency} />
        )}
      </SectionCard>

      {/* ── Service breakdown detail ── */}
      {!loading && byService.length > 0 && (
        <SectionCard title={p.sectionServiceBreakdown}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {byService.map((s, i) => (
              <motion.div
                key={`${s.service_type}-${s.sub_service_type}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-[var(--surface-secondary)] rounded-lg p-4 space-y-2"
              >
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {s.service_type === "course_dediee" ? p.dedicatedTrip : s.service_type.charAt(0).toUpperCase() + s.service_type.slice(1)}
                  {s.sub_service_type !== "N/A" && ` — ${s.sub_service_type}`}
                </p>
                <p className="text-lg font-bold text-[var(--text-primary)]">{formatNumber(s.nbr_requests)} <span className="text-xs text-slate-400 font-normal">{p.colRequests.toLowerCase()}</span></p>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{p.colMarginPct}</span>
                  <span className={`font-semibold ${s.taux_marge_pct >= 24 ? "text-emerald-400" : "text-amber-400"}`}>{s.taux_marge_pct?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{p.colPunctuality}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{s.taux_ponctualite_pct?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{p.colNote}</span>
                  <span className="flex items-center gap-1 font-semibold text-amber-400">
                    <Star size={11} /> {s.avg_note_client?.toFixed(1)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </SectionCard>
      )}

    </div>
  );
}
