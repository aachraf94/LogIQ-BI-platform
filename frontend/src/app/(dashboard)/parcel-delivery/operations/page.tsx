"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { Package, TrendingUp, TrendingDown, Clock, Truck } from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { useTranslation } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chartTheme";
import { useParcelDeliveryStore } from "@/stores/parcelDeliveryStore";
import { parcelDeliveryApi } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import {
  mockParcelOpsKpis,
  mockParcelOpsTrend,
  mockParcelStatusBreakdown,
  mockParcelZoneBreakdown,
  mockParcelRegionFlow,
  REGION_FLOW_REGIONS,
} from "@/lib/mock-data";
import type {
  ParcelOpsKpis,
  ParcelTrendPoint,
  ParcelStatusItem,
  ParcelZoneItem,
  ParcelRegionFlowItem,
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

// ─── Volume trend chart ───────────────────────────────────────────────────────

function buildVolumeTrendOption(
  trend: ParcelTrendPoint[],
  labels: { delivered: string; returned: string; inTransit: string },
  ct: ReturnType<typeof useChartTheme>
) {
  const cats = trend.map((d) => d.date.slice(5));
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
      axisLabel: { color: ct.labelColor, fontSize: 10, interval: Math.floor(trend.length / 8) },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
      axisLabel: { color: ct.labelColor, fontSize: 11 },
    },
    series: [
      {
        name: labels.delivered,
        type: "bar" as const,
        stack: "vol",
        data: trend.map((d) => d.nbr_livres),
        itemStyle: { color: "#10B981" },
      },
      {
        name: labels.returned,
        type: "bar" as const,
        stack: "vol",
        data: trend.map((d) => d.nbr_retours),
        itemStyle: { color: "#F59E0B", borderRadius: [4, 4, 0, 0] },
      },
      {
        name: labels.inTransit,
        type: "bar" as const,
        stack: "vol",
        data: trend.map((d) => d.nbr_en_transit),
        itemStyle: { color: "#6366F1", borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

// ─── Region flow heatmap ──────────────────────────────────────────────────────

function buildRegionFlowOption(
  flow: ParcelRegionFlowItem[],
  regions: string[],
  ct: ReturnType<typeof useChartTheme>
) {
  // Build lookup map
  const lookup = new Map(flow.map((f) => [`${f.origin}|${f.destination}`, f.nbr_colis]));
  const maxVal = Math.max(...flow.map((f) => f.nbr_colis));

  // ECharts heatmap: [dest_idx, origin_idx, value]
  const data: [number, number, number][] = [];
  regions.forEach((origin, yi) => {
    regions.forEach((dest, xi) => {
      const count = lookup.get(`${origin}|${dest}`) ?? 0;
      data.push([xi, yi, count]);
    });
  });

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      formatter: (params: { value: [number, number, number] }) => {
        const [xi, yi, count] = params.value;
        if (!count) return "";
        return `<b>${regions[yi]}</b> → <b>${regions[xi]}</b><br/>${count.toLocaleString("fr-FR")} colis`;
      },
    },
    grid: { left: 60, right: 12, top: 12, bottom: 60, containLabel: false },
    xAxis: {
      type: "category" as const,
      data: regions,
      position: "bottom" as const,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 10, rotate: 35 },
      name: "Destination",
      nameLocation: "middle" as const,
      nameGap: 46,
      nameTextStyle: { color: ct.labelColor, fontSize: 10 },
    },
    yAxis: {
      type: "category" as const,
      data: regions,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 10 },
      name: "Origine",
      nameLocation: "middle" as const,
      nameGap: 50,
      nameTextStyle: { color: ct.labelColor, fontSize: 10 },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      show: false,
      calculable: false,
      inRange: {
        color: [
          ct.surface ?? "rgba(99,102,241,0.04)",
          "rgba(99,102,241,0.18)",
          "rgba(99,102,241,0.55)",
          "rgba(99,102,241,0.85)",
        ],
      },
    },
    series: [
      {
        type: "heatmap" as const,
        data,
        label: {
          show: true,
          color: ct.textColor,
          fontSize: 9,
          formatter: (p: { value: [number, number, number] }) =>
            p.value[2] >= 500
              ? (p.value[2] >= 1000 ? `${(p.value[2] / 1000).toFixed(1)}k` : String(p.value[2]))
              : "",
        },
        emphasis: {
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(99,102,241,0.4)" },
        },
        itemStyle: { borderColor: ct.bgColor, borderWidth: 1.5, borderRadius: 3 },
      },
    ],
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PageData {
  kpis: ParcelOpsKpis
  trend: ParcelTrendPoint[]
  statusBreakdown: ParcelStatusItem[]
  regionFlow: ParcelRegionFlowItem[]
  zones: ParcelZoneItem[]
}

const MOCK: PageData = {
  kpis: mockParcelOpsKpis,
  trend: mockParcelOpsTrend,
  statusBreakdown: mockParcelStatusBreakdown,
  regionFlow: mockParcelRegionFlow,
  zones: mockParcelZoneBreakdown,
};

export default function OperationsPage() {
  const [data, setData] = useState<PageData>(MOCK);
  const [fetching, setFetching] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    raf.current = requestAnimationFrame(() => setChartsReady(true));
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  const { t } = useTranslation();
  const p = t.pages.parcelDelivery;
  const ct = useChartTheme();

  const { startDate, endDate, deliveryType, rangeDays, setUsingMock } = useParcelDeliveryStore();
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
      const [kpis, trend, statusBreakdown, regionFlow, zones] = await Promise.all([
        parcelDeliveryApi.opsKpis(filters),
        parcelDeliveryApi.opsTrend(filters),
        parcelDeliveryApi.statusBreakdown(filters),
        parcelDeliveryApi.regionFlow(filters),
        parcelDeliveryApi.zoneBreakdown(filters),
      ]);
      setData({ kpis, trend, statusBreakdown, regionFlow, zones });
      setUsingMock(false);
    } catch {
      setData(MOCK);
      setUsingMock(true);
    } finally {
      setFetching(false);
    }
  }, [startDate, endDate, deliveryType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const { kpis, trend, statusBreakdown, regionFlow, zones } = data;

  const statusPieData = statusBreakdown
    .filter((s) => s.nbr_colis > 0)
    .map((s) => ({ name: s.status_name, value: s.nbr_colis }));

  const zoneBarData = zones.map((z) => ({
    name: `Zone ${z.zone_num}`,
    value: z.nbr_colis,
  }));

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

      {/* ── Row 1: 5 KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          title={p.kpiTotalParcels}
          value={formatNumber(kpis.nbr_colis)}
          trend={kpis.pop_colis}
          trendLabel={trendLabel}
          icon={<Package size={15} />}
          index={0}
        />
        {/* Delivered Parcels — count, not rate */}
        <KpiCard
          title={p.kpiDeliveryRate}
          value={formatNumber(kpis.nbr_livres)}
          trend={kpis.pop_livraison}
          trendLabel={trendLabel}
          icon={<TrendingUp size={15} />}
          index={1}
        />
        {/* Returns — count, not rate */}
        <KpiCard
          title={p.kpiReturnRate}
          value={formatNumber(kpis.nbr_retours)}
          trend={-kpis.pop_retour}
          trendLabel={trendLabel}
          icon={<TrendingDown size={15} />}
          index={2}
        />
        {/* In Transit */}
        <KpiCard
          title={p.kpiFailedParcels}
          value={formatNumber(kpis.nbr_en_transit)}
          trend={kpis.pop_en_transit}
          trendLabel={trendLabel}
          icon={<Truck size={15} />}
          index={3}
        />
        <KpiCard
          title={p.kpiAvgDuration}
          value={`${kpis.avg_duree_livraison_h.toFixed(1)} ${p.durationUnit}`}
          trend={-kpis.pop_duree}
          trendLabel={trendLabel}
          icon={<Clock size={15} />}
          index={4}
        />
      </div>

      {/* ── Row 2: Volume trend + Status breakdown ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionVolumeTrend}>
          {!chartsReady ? <div className="h-[280px]" /> : trend.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildVolumeTrendOption(trend, {
                delivered: p.seriesDelivered,
                returned: p.seriesReturned,
                inTransit: p.seriesInTransit,
              }, ct)}
              style={{ height: 280 }}
              notMerge
              lazyUpdate
            />
          )}
        </SectionCard>

        <SectionCard title={p.sectionStatusBreakdown}>
          {!chartsReady ? <div className="h-[280px]" /> : <PieChart data={statusPieData} height={280} />}
        </SectionCard>
      </div>

      {/* ── Row 3: Region Flow heatmap + Zone distribution ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Region × Region flow matrix */}
        <SectionCard title={p.sectionDeliveryTypeComp}>
          {!chartsReady ? <div className="h-[320px]" /> : regionFlow.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildRegionFlowOption(regionFlow, REGION_FLOW_REGIONS, ct)}
              style={{ height: 320 }}
              notMerge
              lazyUpdate
            />
          )}
        </SectionCard>

        {/* Zone distribution — gridLeft=160 to fit the longer labels */}
        <SectionCard title={p.sectionZoneDist}>
          {!chartsReady ? <div className="h-[280px]" /> : (
            <BarChart
              data={zoneBarData}
              height={280}
              color="#6366F1"
              horizontal
              label="colis"
              gridLeft={10}
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
