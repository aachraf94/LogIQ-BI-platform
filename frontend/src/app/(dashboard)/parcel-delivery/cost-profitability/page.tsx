"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, BarChart2, Layers } from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { BarChart } from "@/components/charts/BarChart";
import { useTranslation } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chartTheme";
import { useParcelDeliveryStore } from "@/stores/parcelDeliveryStore";
import { parcelDeliveryApi } from "@/lib/api";
import { formatNumber, formatPercent, formatDZD } from "@/lib/utils";
import {
  mockParcelCostKpis,
  mockParcelRevenueCostTrend,
  mockParcelCostNature,
  mockParcelRegionProfit,
  mockParcelZoneProfit,
  REGION_FLOW_REGIONS,
} from "@/lib/mock-data";
import type {
  ParcelCostKpis,
  ParcelRevenueCostPoint,
  ParcelCostNatureItem,
  ParcelRegionProfitItem,
  ParcelZoneProfitItem,
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

// ─── Revenue vs Cost trend ────────────────────────────────────────────────────

function buildRevenueCostOption(
  trend: ParcelRevenueCostPoint[],
  labels: { revenue: string; cost: string; margin: string },
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
      axisLine: { show: false },
      splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
      axisLabel: { color: ct.labelColor, fontSize: 11 },
    },
    series: [
      {
        name: labels.cost,
        type: "line" as const,
        data: trend.map((d) => d.cout_total),
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#EF4444", width: 2 },
        itemStyle: { color: "#EF4444" },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(239,68,68,0.2)" }, { offset: 1, color: "rgba(239,68,68,0)" }] } },
      },
      {
        name: labels.revenue,
        type: "line" as const,
        data: trend.map((d) => d.total_fees),
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#10B981", width: 2 },
        itemStyle: { color: "#10B981" },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(16,185,129,0.25)" }, { offset: 1, color: "rgba(16,185,129,0)" }] } },
      },
      {
        name: labels.margin,
        type: "bar" as const,
        data: trend.map((d) => d.marge_brute),
        itemStyle: { color: "#6366F1", borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 20,
        markLine: {
          silent: true,
          symbol: ["none", "none"] as [string, string],
          lineStyle: { type: "dashed" as const, color: ct.labelColor, width: 1, opacity: 0.5 },
          data: [{ yAxis: 0, label: { formatter: "Break-even", position: "insideEndTop" as const, fontSize: 9, color: ct.labelColor } }],
        },
      },
    ],
  };
}

// ─── Regional profit heatmap — main value = marge_brute, tooltip = all metrics ─

function buildRegionProfitOption(
  data: ParcelRegionProfitItem[],
  regions: string[],
  ct: ReturnType<typeof useChartTheme>
) {
  const lookup = new Map(data.map((d) => [`${d.origin}|${d.destination}`, d]));
  const allMargins = data.map((d) => d.marge_pct);
  const minPct = Math.min(...allMargins);
  const maxPct = Math.max(...allMargins);

  const cells: [number, number, number][] = [];
  regions.forEach((origin, yi) => {
    regions.forEach((dest, xi) => {
      const item = lookup.get(`${origin}|${dest}`);
      cells.push([xi, yi, item?.marge_pct ?? 0]);
    });
  });

  const fmt = (n: number) => n.toLocaleString("fr-FR");

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      formatter: (p: { value: [number, number, number] }) => {
        const [xi, yi] = p.value;
        const item = lookup.get(`${regions[yi]}|${regions[xi]}`);
        if (!item || !item.nbr_colis) return "";
        return [
          `<b>${regions[yi]}</b> → <b>${regions[xi]}</b>`,
          `Colis : ${fmt(item.nbr_colis)}`,
          `Frais : ${fmt(item.total_fees)} DZD`,
          `Coût  : ${fmt(item.cout_total)} DZD`,
          `<span style="color:#10B981;font-weight:600">Marge : ${fmt(item.marge_brute)} DZD (${item.marge_pct}%)</span>`,
        ].join("<br/>");
      },
    },
    grid: { left: 60, right: 12, top: 12, bottom: 60, containLabel: false },
    xAxis: {
      type: "category" as const,
      data: regions,
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
      min: minPct,
      max: maxPct,
      show: false,
      inRange: {
        // amber (low margin) → emerald (high margin)
        color: ["rgba(245,158,11,0.25)", "rgba(245,158,11,0.5)", "rgba(16,185,129,0.35)", "rgba(16,185,129,0.75)"],
      },
    },
    series: [{
      type: "heatmap" as const,
      data: cells,
      label: {
        show: true,
        fontSize: 9,
        color: ct.textColor,
        formatter: (p: { value: [number, number, number] }) =>
          p.value[2] > 0 ? `${p.value[2]}%` : "",
      },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(16,185,129,0.4)" } },
      itemStyle: { borderColor: ct.bgColor, borderWidth: 1.5, borderRadius: 3 },
    }],
  };
}

// ─── Zone profitability — grouped bars (fees/cost) + margin % line ────────────

function buildZoneProfitOption(
  zones: ParcelZoneProfitItem[],
  ct: ReturnType<typeof useChartTheme>
) {
  const cats = zones.map((z) => `Zone ${z.zone_num}`);
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: ct.tooltipBg,
      borderColor: ct.borderColor,
      textStyle: { color: ct.textColor, fontSize: 12 },
      axisPointer: { type: "shadow" as const },
      formatter: (params: Array<{ seriesName: string; value: number; color: string }>) => {
        const z = zones[params[0] ? cats.indexOf(params[0].seriesName) : 0];
        const lines = params.map(
          (p) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>${p.seriesName}: <b>${p.value.toLocaleString("fr-FR")} ${p.seriesName.includes("%") ? "%" : "DZD"}</b>`
        );
        return lines.join("<br/>");
      },
    },
    legend: {
      top: 0, right: 0,
      textStyle: { color: ct.legendColor, fontSize: 11 },
      itemWidth: 10, itemHeight: 10,
    },
    grid: { left: 16, right: 48, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: cats,
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 11 },
    },
    yAxis: [
      {
        type: "value" as const,
        name: "DZD",
        nameTextStyle: { color: ct.labelColor, fontSize: 10 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
        axisLabel: {
          color: ct.labelColor, fontSize: 10,
          formatter: (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
        },
      },
      {
        type: "value" as const,
        name: "Marge %",
        min: 0, max: 50,
        nameTextStyle: { color: ct.labelColor, fontSize: 10 },
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: ct.labelColor, fontSize: 10, formatter: (v: number) => `${v}%` },
      },
    ],
    series: [
      {
        name: "Frais collectés",
        type: "bar" as const,
        yAxisIndex: 0,
        data: zones.map((z) => z.total_fees),
        itemStyle: { color: "#10B981", borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 36,
      },
      {
        name: "Coût total",
        type: "bar" as const,
        yAxisIndex: 0,
        data: zones.map((z) => z.cout_total),
        itemStyle: { color: "#EF4444", borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 36,
      },
      {
        name: "Marge %",
        type: "line" as const,
        yAxisIndex: 1,
        data: zones.map((z) => z.marge_pct),
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { color: "#6366F1", width: 2.5 },
        itemStyle: { color: "#6366F1" },
        label: {
          show: true,
          position: "top" as const,
          color: ct.legendColor,
          fontSize: 10,
          formatter: (p: { value: number }) => `${p.value}%`,
        },
      },
    ],
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PageData {
  kpis: ParcelCostKpis
  revenueCostTrend: ParcelRevenueCostPoint[]
  costByNature: ParcelCostNatureItem[]
  regionProfit: ParcelRegionProfitItem[]
  zoneProfit: ParcelZoneProfitItem[]
}

const MOCK: PageData = {
  kpis: mockParcelCostKpis,
  revenueCostTrend: mockParcelRevenueCostTrend,
  costByNature: mockParcelCostNature,
  regionProfit: mockParcelRegionProfit,
  zoneProfit: mockParcelZoneProfit,
};

export default function CostProfitabilityPage() {
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
      const [kpis, revenueCostTrend, costByNature, regionProfit, zoneProfit] = await Promise.all([
        parcelDeliveryApi.costKpis(filters),
        parcelDeliveryApi.revenueCostTrend(filters),
        parcelDeliveryApi.costByNature(filters),
        parcelDeliveryApi.regionProfit(filters),
        parcelDeliveryApi.zoneProfit(filters),
      ]);
      setData({ kpis, revenueCostTrend, costByNature, regionProfit, zoneProfit });
      setUsingMock(false);
    } catch {
      setData(MOCK);
      setUsingMock(true);
    } finally {
      setFetching(false);
    }
  }, [startDate, endDate, deliveryType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const { kpis, revenueCostTrend, costByNature, regionProfit, zoneProfit } = data;

  const costNatureBarData = costByNature.map((n) => ({ name: n.nature_name, value: n.total_dzd }));

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

      {/* Demo badge is shown in layout.tsx's tab row */}

      {/* ── Row 1: 5 KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard title={p.kpiFeesCollected}    value={formatDZD(kpis.total_fees)}                       trend={kpis.pop_fees}            trendLabel={trendLabel} icon={<DollarSign size={15} />}  index={0} />
        <KpiCard title={p.kpiTotalCost}        value={formatDZD(kpis.cout_total)}                       trend={-kpis.pop_cout}           trendLabel={trendLabel} icon={<TrendingDown size={15} />} index={1} />
        <KpiCard title={p.kpiGrossMargin}      value={formatPercent(kpis.marge_pct)}                    trend={kpis.pop_marge}           trendLabel={trendLabel} icon={<TrendingUp size={15} />}   index={2} />
        <KpiCard title={p.kpiAvgFee}           value={`${formatNumber(kpis.avg_fee_par_colis)} DZD`}    trend={kpis.pop_avg_fee}         trendLabel={trendLabel} icon={<BarChart2 size={15} />}    index={3} />
        <KpiCard title={p.kpiCostPerDelivery}  value={`${formatNumber(kpis.cout_par_colis_livre)} DZD`} trend={-kpis.pop_cout_par_livre} trendLabel={trendLabel} icon={<Layers size={15} />}      index={4} />
      </div>

      {/* ── Row 2: Revenue vs Cost trend (left) + Expenses by Category (right) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionRevenueCostTrend}>
          {!chartsReady ? <div className="h-[280px]" /> : revenueCostTrend.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildRevenueCostOption(revenueCostTrend, { revenue: p.seriesRevenue, cost: p.seriesCost, margin: p.kpiGrossMargin }, ct)}
              style={{ height: 280 }}
              notMerge
              lazyUpdate
            />
          )}
        </SectionCard>

        {/* Expenses by Category replaced Operational Cost Structure here */}
        <SectionCard title={p.sectionCostByNature}>
          {!chartsReady ? <div className="h-[280px]" /> : (
            <BarChart data={costNatureBarData} height={280} color="#10B981" horizontal label="DZD" />
          )}
        </SectionCard>
      </div>

      {/* ── Row 3: Regional Margin heatmap (left) + Zone Profitability (right) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Regional Flow — colour = margin %, tooltip shows revenue/cost/margin */}
        <SectionCard title={p.sectionRegionProfit}>
          {!chartsReady ? <div className="h-[320px]" /> : regionProfit.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildRegionProfitOption(regionProfit, REGION_FLOW_REGIONS, ct)}
              style={{ height: 320 }}
              notMerge
              lazyUpdate
            />
          )}
        </SectionCard>

        {/* Zone Profitability — from fact_parcel_revenue × dim_zone */}
        <SectionCard title={p.sectionZoneProfit}>
          {!chartsReady ? <div className="h-[280px]" /> : zoneProfit.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildZoneProfitOption(zoneProfit, ct)}
              style={{ height: 280 }}
              notMerge
              lazyUpdate
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
