"use client";

import { useEffect, useState, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { Package, TrendingUp, TrendingDown, Clock, AlertTriangle } from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { useTranslation } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chartTheme";
import { useParcelDeliveryStore } from "@/stores/parcelDeliveryStore";
import { parcelDeliveryApi } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";
import {
  mockParcelOpsKpis,
  mockParcelOpsTrend,
  mockParcelStatusBreakdown,
  mockParcelByDeliveryTypeNew,
  mockParcelZoneBreakdown,
} from "@/lib/mock-data";
import type {
  ParcelOpsKpis,
  ParcelTrendPoint,
  ParcelStatusItem,
  ParcelDeliveryTypeKpis,
  ParcelZoneItem,
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

function Skeleton({ h = "h-[280px]" }: { h?: string }) {
  return (
    <div className={`relative ${h}`}>
      <div className="absolute top-0 left-0 flex gap-2 items-center">
        <div className="h-3 w-24 bg-[var(--surface-secondary)] animate-pulse rounded" />
        <div className="h-3 w-16 bg-[var(--surface-secondary)] animate-pulse rounded opacity-60" />
      </div>
      <div className="absolute inset-0 top-8 flex items-end gap-1.5">
        {[45, 72, 58, 88, 62, 78, 52, 70].map((v, i) => (
          <div
            key={i}
            className="flex-1 bg-[var(--surface-secondary)] animate-pulse rounded-t"
            style={{ height: `${v}%` }}
          />
        ))}
      </div>
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

// ─── Volume trend chart builder ───────────────────────────────────────────────

function buildVolumeTrendOption(
  trend: ParcelTrendPoint[],
  labels: { delivered: string; returned: string; failed: string },
  ct: ReturnType<typeof useChartTheme>
) {
  const cats = trend.map((d) => d.date.slice(5));  // MM-DD
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
        name: labels.failed,
        type: "bar" as const,
        stack: "vol",
        data: trend.map((d) => d.nbr_echecs),
        itemStyle: { color: "#EF4444", borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

// ─── HD vs SD comparison chart ────────────────────────────────────────────────

function buildHDvsSDOption(
  byType: ParcelDeliveryTypeKpis[],
  labels: { deliveryRate: string; returnRate: string; avgFee: string; avgDuration: string; durationUnit: string },
  ct: ReturnType<typeof useChartTheme>
) {
  const types = byType.map((d) => d.delivery_type);
  const metrics = [
    { name: labels.deliveryRate, values: byType.map((d) => d.taux_livraison_pct), suffix: "%" },
    { name: labels.returnRate,   values: byType.map((d) => d.taux_retour_pct),    suffix: "%" },
    { name: labels.avgFee,       values: byType.map((d) => d.avg_fee_dzd),        suffix: " DZD" },
    { name: labels.avgDuration,  values: byType.map((d) => d.avg_duree_livree_h), suffix: labels.durationUnit },
  ];

  const COLORS = ["#6366F1", "#22D3EE", "#10B981", "#F59E0B"];

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
      data: types,
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { color: ct.labelColor, fontSize: 12 },
    },
    yAxis: { show: false },
    series: metrics.map((m, i) => ({
      name: m.name,
      type: "bar" as const,
      data: m.values,
      itemStyle: { color: COLORS[i], borderRadius: [4, 4, 0, 0] },
      label: {
        show: true,
        position: "top" as const,
        color: ct.legendColor,
        fontSize: 11,
        formatter: (p: { value: number }) => `${p.value}${m.suffix}`,
      },
    })),
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PageData {
  kpis: ParcelOpsKpis
  trend: ParcelTrendPoint[]
  statusBreakdown: ParcelStatusItem[]
  byDeliveryType: ParcelDeliveryTypeKpis[]
  zones: ParcelZoneItem[]
}

const MOCK: PageData = {
  kpis: mockParcelOpsKpis,
  trend: mockParcelOpsTrend,
  statusBreakdown: mockParcelStatusBreakdown,
  byDeliveryType: mockParcelByDeliveryTypeNew,
  zones: mockParcelZoneBreakdown,
};

export default function OperationsPage() {
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [data, setData] = useState<PageData>(MOCK);

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
    setLoading(true);
    try {
      const [kpis, trend, statusBreakdown, byDeliveryType, zones] = await Promise.all([
        parcelDeliveryApi.opsKpis(filters),
        parcelDeliveryApi.opsTrend(filters),
        parcelDeliveryApi.statusBreakdown(filters),
        parcelDeliveryApi.byDeliveryType(filters),
        parcelDeliveryApi.zoneBreakdown(filters),
      ]);
      setData({ kpis, trend, statusBreakdown, byDeliveryType, zones });
      setUsingMock(false);
    } catch {
      setData(MOCK);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, deliveryType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const { kpis, trend, statusBreakdown, byDeliveryType, zones } = data;

  const statusPieData = statusBreakdown
    .filter((s) => s.nbr_colis > 0)
    .map((s) => ({ name: s.status_name, value: s.nbr_colis }));

  const zoneBarData = zones.map((z) => ({
    name: `Zone ${z.zone_num} (${z.fee_range})`,
    value: z.nbr_colis,
  }));

  return (
    <div className="space-y-5">
      {/* Mock data badge — sticky so it's always visible while scrolling */}
      {usingMock && (
        <div className="sticky top-0 z-10 text-xs text-amber-400/80 border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 rounded-lg w-fit">
          {p.demoData}
        </div>
      )}

      {/* ── Row 1: 5 KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          title={p.kpiTotalParcels}
          value={formatNumber(kpis.nbr_colis)}
          trend={kpis.pop_colis}
          trendLabel={trendLabel}
          icon={<Package size={16} />}
          index={0}
        />
        <KpiCard
          title={p.kpiDeliveryRate}
          value={formatPercent(kpis.taux_livraison_pct)}
          trend={kpis.pop_livraison}
          trendLabel={trendLabel}
          icon={<TrendingUp size={16} />}
          index={1}
        />
        <KpiCard
          title={p.kpiReturnRate}
          value={formatPercent(kpis.taux_retour_pct)}
          trend={-kpis.pop_retour}
          trendLabel={trendLabel}
          icon={<TrendingDown size={16} />}
          index={2}
        />
        <KpiCard
          title={p.kpiFailedParcels}
          value={formatNumber(kpis.nbr_echecs)}
          trend={-kpis.pop_echecs}
          trendLabel={trendLabel}
          icon={<AlertTriangle size={16} />}
          index={3}
        />
        <KpiCard
          title={p.kpiAvgDuration}
          value={`${kpis.avg_duree_livraison_h.toFixed(1)} ${p.durationUnit}`}
          trend={-kpis.pop_duree}
          trendLabel={trendLabel}
          icon={<Clock size={16} />}
          index={4}
        />
      </div>

      {/* ── Row 2: Volume trend + Status breakdown ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionVolumeTrend}>
          {loading ? <Skeleton /> : trend.length === 0 ? <EmptyChartState /> : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
              <ReactECharts
                option={buildVolumeTrendOption(
                  trend,
                  { delivered: p.seriesDelivered, returned: p.seriesReturned, failed: p.seriesFailed },
                  ct
                )}
                style={{ height: 280 }}
                notMerge
                lazyUpdate
              />
            </motion.div>
          )}
        </SectionCard>

        <SectionCard title={p.sectionStatusBreakdown}>
          {loading ? <Skeleton /> : <PieChart data={statusPieData} height={280} />}
        </SectionCard>
      </div>

      {/* ── Row 3: HD vs SD + Zone distribution ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionDeliveryTypeComp}>
          {loading ? <Skeleton /> : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
              {/* HD vs SD metric cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {byDeliveryType.map((dt) => (
                  <div
                    key={dt.delivery_type}
                    className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg p-4 space-y-2.5"
                  >
                    <span className={`text-xs font-bold px-3 py-1 rounded-full inline-block ring-1 ${
                      dt.delivery_type === "HD"
                        ? "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30"
                        : "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30"
                    }`}>
                      {dt.delivery_type === "HD" ? p.hdLabel : p.sdLabel}
                    </span>
                    <p className="text-xl font-bold text-[var(--text-primary)]">{formatNumber(dt.nbr_colis)}</p>
                    {[
                      { label: p.hdDeliveryRate, value: `${dt.taux_livraison_pct.toFixed(1)}%`, positive: dt.taux_livraison_pct >= 73 },
                      { label: p.hdReturnRate,   value: `${dt.taux_retour_pct.toFixed(1)}%`,    positive: dt.taux_retour_pct < 20 },
                      { label: p.hdAvgFee,       value: `${dt.avg_fee_dzd.toFixed(0)} DZD`,    positive: true },
                      { label: p.hdAvgDuration,  value: `${dt.avg_duree_livree_h.toFixed(1)} ${p.durationUnit}`, positive: dt.avg_duree_livree_h < 36 },
                    ].map(({ label, value, positive }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-slate-400">{label}</span>
                        <span className={`font-semibold ${positive ? "text-emerald-400" : "text-amber-400"}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Divider between cards block and mini chart */}
              <hr className="border-t border-[var(--border)] mb-4" />

              {byDeliveryType.length === 0 ? <EmptyChartState /> : (
                <ReactECharts
                  option={buildHDvsSDOption(
                    byDeliveryType,
                    { deliveryRate: p.hdDeliveryRate, returnRate: p.hdReturnRate, avgFee: p.hdAvgFee, avgDuration: p.hdAvgDuration, durationUnit: p.durationUnit },
                    ct
                  )}
                  style={{ height: 160 }}
                  notMerge
                  lazyUpdate
                />
              )}
            </motion.div>
          )}
        </SectionCard>

        <SectionCard title={p.sectionZoneDist}>
          {loading ? <Skeleton /> : (
            <BarChart
              data={zoneBarData}
              height={280}
              color="#6366F1"
              horizontal
              label="colis"
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
