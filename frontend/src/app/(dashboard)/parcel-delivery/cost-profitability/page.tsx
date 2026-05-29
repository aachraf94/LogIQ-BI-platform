"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, BarChart2, Layers } from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { useTranslation } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chartTheme";
import { useParcelDeliveryStore } from "@/stores/parcelDeliveryStore";
import { parcelDeliveryApi } from "@/lib/api";
import { formatNumber, formatPercent, formatDZD } from "@/lib/utils";
import {
  mockParcelCostKpis,
  mockParcelRevenueCostTrend,
  mockParcelCostStructureNew,
  mockParcelCostNature,
  mockParcelEcartBuckets,
} from "@/lib/mock-data";
import type {
  ParcelCostKpis,
  ParcelRevenueCostPoint,
  ParcelCostStructure,
  ParcelCostNatureItem,
  ParcelEcartBucket,
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

// ─── Revenue vs Cost trend chart ──────────────────────────────────────────────

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
      // Cost drawn first (behind revenue)
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

// ─── Tariff gap histogram ─────────────────────────────────────────────────────

function buildEcartHistogramOption(
  buckets: ParcelEcartBucket[],
  labels: { parcels: string; sumEcart: string },
  ct: ReturnType<typeof useChartTheme>
) {
  const sorted = [...buckets].sort((a, b) => a.bucket_order - b.bucket_order);
  const cats = sorted.map((b) => b.bucket);
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
      axisLabel: { color: ct.labelColor, fontSize: 9, rotate: 35 },
    },
    yAxis: [
      {
        type: "value" as const,
        name: labels.parcels,
        nameTextStyle: { color: ct.labelColor, fontSize: 10 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: ct.splitColor, type: "dashed" as const } },
        axisLabel: { color: ct.labelColor, fontSize: 10 },
      },
      {
        type: "value" as const,
        name: labels.sumEcart,
        nameTextStyle: { color: ct.labelColor, fontSize: 10 },
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: ct.labelColor, fontSize: 10 },
      },
    ],
    series: [
      {
        name: labels.parcels,
        type: "bar" as const,
        yAxisIndex: 0,
        data: sorted.map((b) => b.nbr_colis),
        itemStyle: { color: "#6366F1", borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 40,
      },
      {
        name: labels.sumEcart,
        type: "line" as const,
        yAxisIndex: 1,
        data: sorted.map((b) => b.sum_ecart_dzd),
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#F59E0B", width: 2 },
        itemStyle: { color: "#F59E0B" },
      },
    ],
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PageData {
  kpis: ParcelCostKpis
  revenueCostTrend: ParcelRevenueCostPoint[]
  costStructure: ParcelCostStructure
  costByNature: ParcelCostNatureItem[]
  ecartBuckets: ParcelEcartBucket[]
}

const MOCK: PageData = {
  kpis: mockParcelCostKpis,
  revenueCostTrend: mockParcelRevenueCostTrend,
  costStructure: mockParcelCostStructureNew,
  costByNature: mockParcelCostNature,
  ecartBuckets: mockParcelEcartBuckets,
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
      const [kpis, revenueCostTrend, costStructure, costByNature, ecartBuckets] = await Promise.all([
        parcelDeliveryApi.costKpis(filters),
        parcelDeliveryApi.revenueCostTrend(filters),
        parcelDeliveryApi.costStructure(filters),
        parcelDeliveryApi.costByNature(filters),
        parcelDeliveryApi.ecartDistribution(filters),
      ]);
      setData({ kpis, revenueCostTrend, costStructure, costByNature, ecartBuckets });
      setUsingMock(false);
    } catch {
      setData(MOCK);
      setUsingMock(true);  // shared store — layout reads this for the badge
    } finally {
      setFetching(false);
    }
  }, [startDate, endDate, deliveryType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const { kpis, revenueCostTrend, costStructure, costByNature, ecartBuckets } = data;

  const costStructurePieData = [
    { name: "Salaires",   value: costStructure.total_salaires  },
    { name: "Dépenses",   value: costStructure.total_depenses  },
    { name: "Freelance",  value: costStructure.total_freelance },
    { name: "Sinistres",  value: costStructure.total_sinistres },
  ].filter((d) => d.value > 0);

  const costNatureBarData = [...costByNature]
    .sort((a, b) => b.total_dzd - a.total_dzd)
    .map((n) => ({ name: n.nature_name, value: n.total_dzd }));

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

      {/* Demo badge is shown in layout.tsx's tab row — no badge here */}

      {/* ── Row 1: 5 KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard title={p.kpiFeesCollected}    value={formatDZD(kpis.total_fees)}                       trend={kpis.pop_fees}           trendLabel={trendLabel} icon={<DollarSign size={15} />}  index={0} />
        <KpiCard title={p.kpiTotalCost}        value={formatDZD(kpis.cout_total)}                       trend={-kpis.pop_cout}          trendLabel={trendLabel} icon={<TrendingDown size={15} />} index={1} />
        <KpiCard title={p.kpiGrossMargin}      value={formatPercent(kpis.marge_pct)}                    trend={kpis.pop_marge}          trendLabel={trendLabel} icon={<TrendingUp size={15} />}   index={2} />
        <KpiCard title={p.kpiAvgFee}           value={`${formatNumber(kpis.avg_fee_par_colis)} DZD`}    trend={kpis.pop_avg_fee}        trendLabel={trendLabel} icon={<BarChart2 size={15} />}    index={3} />
        <KpiCard title={p.kpiCostPerDelivery}  value={`${formatNumber(kpis.cout_par_colis_livre)} DZD`} trend={-kpis.pop_cout_par_livre} trendLabel={trendLabel} icon={<Layers size={15} />}      index={4} />
      </div>

      {/* ── Row 2: Revenue vs Cost trend + Cost Structure ── */}
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

        <SectionCard title={p.sectionCostStructure}>
          {!chartsReady ? <div className="h-[280px]" /> : <PieChart data={costStructurePieData} height={280} />}
        </SectionCard>
      </div>

      {/* ── Row 3: Cost by Nature + Tariff Gap Distribution ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionCostByNature}>
          {!chartsReady ? <div className="h-[280px]" /> : (
            <BarChart data={costNatureBarData} height={280} color="#10B981" horizontal label="DZD" />
          )}
        </SectionCard>

        <SectionCard title={p.sectionTariffGapDist}>
          {!chartsReady ? <div className="h-[280px]" /> : ecartBuckets.length === 0 ? <EmptyChartState /> : (
            <ReactECharts
              option={buildEcartHistogramOption(ecartBuckets, { parcels: p.seriesDelivered, sumEcart: "Écart DZD" }, ct)}
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
