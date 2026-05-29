"use client";

import { useEffect, useState, useCallback } from "react";
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
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Skeleton({ h = "h-64" }: { h?: string }) {
  return <div className={`${h} bg-[var(--surface-secondary)] animate-pulse rounded-lg`} />;
}

// ─── Delivery rate + PCC dual-line trend ──────────────────────────────────────

function buildPerfTrendOption(
  trend: ParcelPerfTrendPoint[],
  labels: { deliveryRate: string; underTariff: string },
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
      min: 0,
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
      setLoading(false);
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
      {/* Mock data badge */}
      {usingMock && (
        <div className="text-xs text-amber-400/80 border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 rounded-lg w-fit">
          {p.demoData}
        </div>
      )}

      {/* ── Row 1: 5 KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          title={p.kpiDeliveryRatePerf}
          value={formatPercent(kpis.taux_livraison_pct)}
          trend={kpis.pop_livraison}
          trendLabel={trendLabel}
          icon={<TrendingUp size={16} />}
          index={0}
        />
        <KpiCard
          title={p.kpiUnderTariff}
          value={formatPercent(kpis.taux_sous_tarif_pct)}
          trend={-kpis.pop_sous_tarif}
          trendLabel={trendLabel}
          icon={<AlertTriangle size={16} />}
          index={1}
        />
        <KpiCard
          title={p.kpiCompliance}
          value={formatPercent(kpis.taux_compliance_pct)}
          trend={kpis.pop_compliance}
          trendLabel={trendLabel}
          icon={<ShieldCheck size={16} />}
          index={2}
        />
        <KpiCard
          title={p.kpiAvgDurationPerf}
          value={`${kpis.avg_duree_livraison_h.toFixed(1)} ${p.durationUnit}`}
          trend={-kpis.pop_duree}
          trendLabel={trendLabel}
          icon={<Clock size={16} />}
          index={3}
        />
        <KpiCard
          title={p.kpiClaimsCount}
          value={formatNumber(kpis.nbr_sinistres)}
          trend={-kpis.pop_sinistres}
          trendLabel={trendLabel}
          icon={<FileWarning size={16} />}
          index={4}
        />
      </div>

      {/* ── Row 2: Perf trend + Duration distribution ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionDeliveryPCCTrend}>
          {loading ? <Skeleton /> : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <ReactECharts
                option={buildPerfTrendOption(
                  perfTrend,
                  { deliveryRate: p.seriesDeliveryRate, underTariff: p.seriesUnderTariff },
                  ct
                )}
                style={{ height: 280 }}
                notMerge
              />
            </motion.div>
          )}
        </SectionCard>

        <SectionCard title={p.sectionDurationDist}>
          {loading ? <Skeleton /> : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <ReactECharts
                option={buildDurationDistOption(durationBuckets, p.kpiAvgDurationPerf, ct)}
                style={{ height: 280 }}
                notMerge
              />
            </motion.div>
          )}
        </SectionCard>
      </div>

      {/* ── Row 3: Agency PCC Ranking + Claims by Type ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionAgencyPCCRanking}>
          {loading ? <Skeleton /> : (
            <BarChart
              data={agencyBarData}
              height={280}
              color="#F59E0B"
              horizontal
              label="%"
            />
          )}
        </SectionCard>

        <SectionCard title={p.sectionClaimsType}>
          {loading ? <Skeleton /> : <PieChart data={claimsPieData} height={280} />}
        </SectionCard>
      </div>
    </div>
  );
}
