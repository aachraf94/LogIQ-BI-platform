"use client";

import { useEffect, useState, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { Truck, Package, CheckCircle2, BarChart2, DollarSign, AlertTriangle, Info, Clock } from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { useTranslation } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chartTheme";
import { overviewApi, alertsApi, type OverviewKpis, type OverviewActivityPoint } from "@/lib/api";
import { formatNumber, formatDZD, formatPercent } from "@/lib/utils";
import type { Alert, AlertSeverity } from "@/types/api";

// ─── Static mock fallback ─────────────────────────────────────────────────────

const MOCK_KPIS: OverviewKpis = {
  transport_requests: 342, pop_transport_requests: 8.2,
  transport_on_time_pct: 87.4, pop_transport_on_time: 2.1,
  parcel_handled: 5820, pop_parcel_handled: 12.3,
  parcel_delivery_rate_pct: 91.2, pop_parcel_delivery_rate: 1.8,
  total_revenue: 2845000, pop_total_revenue: 9.1,
  transport_revenue: 1140000, parcel_revenue: 1705000,
};

const MOCK_TREND: OverviewActivityPoint[] = [
  { period: "2024-12", transport_requests: 210, parcel_handled: 3800 },
  { period: "2025-01", transport_requests: 265, parcel_handled: 4200 },
  { period: "2025-02", transport_requests: 290, parcel_handled: 4600 },
  { period: "2025-03", transport_requests: 318, parcel_handled: 5100 },
  { period: "2025-04", transport_requests: 305, parcel_handled: 5400 },
  { period: "2025-05", transport_requests: 342, parcel_handled: 5820 },
];

// ─── Alert helpers ────────────────────────────────────────────────────────────

const SEV_BADGE: Record<AlertSeverity, string> = {
  critical: "bg-red-500/10 text-red-400",
  warning:  "bg-amber-500/10 text-amber-400",
  info:     "bg-blue-500/10 text-blue-400",
};

const SEV_ICON: Record<AlertSeverity, React.ReactNode> = {
  critical: <AlertTriangle size={13} className="text-red-400" />,
  warning:  <AlertTriangle size={13} className="text-amber-400" />,
  info:     <Info size={13} className="text-blue-400" />,
};

// ─── Activity Trend chart ─────────────────────────────────────────────────────

function buildActivityTrendOption(
  trend: OverviewActivityPoint[],
  labels: { transport: string; parcels: string },
  ct: ReturnType<typeof useChartTheme>
) {
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
      top: 4, right: 0,
      textStyle: { color: ct.legendColor, fontSize: 11 },
      itemWidth: 10, itemHeight: 10,
    },
    grid: { left: 16, right: 52, top: 52, bottom: 0, containLabel: true },
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
        axisLabel: { color: ct.labelColor, fontSize: 10 },
      },
      {
        type: "value" as const,
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: ct.labelColor, fontSize: 10 },
      },
    ],
    series: [
      {
        name: labels.transport,
        type: "line" as const,
        yAxisIndex: 0,
        data: trend.map((d) => d.transport_requests),
        smooth: true,
        symbol: "circle", symbolSize: 5,
        lineStyle: { color: "#6366F1", width: 2 },
        itemStyle: { color: "#6366F1" },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(99,102,241,0.18)" },
              { offset: 1, color: "rgba(99,102,241,0)" },
            ],
          },
        },
      },
      {
        name: labels.parcels,
        type: "line" as const,
        yAxisIndex: 1,
        data: trend.map((d) => d.parcel_handled),
        smooth: true,
        symbol: "circle", symbolSize: 5,
        lineStyle: { color: "#10B981", width: 2, type: "dashed" as const },
        itemStyle: { color: "#10B981" },
      },
    ],
  };
}

// ─── Revenue split donut ──────────────────────────────────────────────────────

function buildRevenueSplitOption(
  transportRevenue: number,
  parcelRevenue: number,
  labels: { transport: string; parcels: string },
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
        `${p.name}<br/><b>${formatDZD(p.value)}</b> (${p.percent}%)`,
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
        radius: ["42%", "70%"],
        center: ["38%", "50%"],
        data: [
          { name: labels.transport, value: transportRevenue, itemStyle: { color: "#6366F1" } },
          { name: labels.parcels,   value: parcelRevenue,   itemStyle: { color: "#10B981" } },
        ],
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.3)" },
        },
      },
    ],
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [kpis, setKpis] = useState<OverviewKpis>(MOCK_KPIS);
  const [trend, setTrend] = useState<OverviewActivityPoint[]>(MOCK_TREND);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [fetching, setFetching] = useState(false);
  const [usingMock, setUsingMock] = useState(false);

  const { t } = useTranslation();
  const p = t.pages.overview;
  const ct = useChartTheme();

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [kpisData, trendData, alertsData] = await Promise.all([
        overviewApi.kpis(),
        overviewApi.activityTrend(),
        alertsApi.list(true),
      ]);
      setKpis(kpisData);
      setTrend(trendData);
      setAlerts(alertsData.slice(0, 5));
      setUsingMock(false);
    } catch {
      setUsingMock(true);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

      {usingMock && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Données de démonstration
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          title={p.kpiTransportRequests}
          value={formatNumber(kpis.transport_requests)}
          trend={kpis.pop_transport_requests}
          trendLabel={p.vsLastMonth}
          icon={<Truck size={15} />}
          index={0}
        />
        <KpiCard
          title={p.kpiPunctuality}
          value={formatPercent(kpis.transport_on_time_pct)}
          trend={kpis.pop_transport_on_time}
          trendLabel={p.vsLastMonth}
          icon={<CheckCircle2 size={15} />}
          index={1}
        />
        <KpiCard
          title={p.kpiParcelHandled}
          value={formatNumber(kpis.parcel_handled)}
          trend={kpis.pop_parcel_handled}
          trendLabel={p.vsLastMonth}
          icon={<Package size={15} />}
          index={2}
        />
        <KpiCard
          title={p.kpiDeliveryRate}
          value={formatPercent(kpis.parcel_delivery_rate_pct)}
          trend={kpis.pop_parcel_delivery_rate}
          trendLabel={p.vsLastMonth}
          icon={<BarChart2 size={15} />}
          index={3}
        />
        <KpiCard
          title={p.kpiTotalRevenue}
          value={formatDZD(kpis.total_revenue)}
          trend={kpis.pop_total_revenue}
          trendLabel={p.vsLastMonth}
          icon={<DollarSign size={15} />}
          index={4}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <div className="border-l-2 border-primary/40 pl-2 mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{p.sectionActivityTrend}</h3>
          </div>
          {trend.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-[var(--text-muted)] text-sm">
              Aucune donnée
            </div>
          ) : (
            <ReactECharts
              option={buildActivityTrendOption(trend, { transport: p.seriesTransport, parcels: p.seriesParcels }, ct)}
              style={{ height: 260 }}
              notMerge lazyUpdate
            />
          )}
        </div>

        <div className="xl:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <div className="border-l-2 border-primary/40 pl-2 mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{p.sectionRevenueSplit}</h3>
          </div>
          {kpis.transport_revenue === 0 && kpis.parcel_revenue === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-[var(--text-muted)] text-sm">
              Aucune donnée
            </div>
          ) : (
            <ReactECharts
              option={buildRevenueSplitOption(
                kpis.transport_revenue,
                kpis.parcel_revenue,
                { transport: p.seriesTransport, parcels: p.seriesParcels },
                ct
              )}
              style={{ height: 260 }}
              notMerge lazyUpdate
            />
          )}
        </div>
      </div>

      {/* ── Recent alerts ── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="border-l-2 border-primary/40 pl-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{p.recentAlerts}</h3>
          </div>
          <a href="/alerts" className="text-xs text-primary hover:text-primary/80 transition-colors">
            {p.viewAllAlerts}
          </a>
        </div>

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)]">
            <CheckCircle2 size={28} className="mb-2 opacity-30" />
            <p className="text-xs">Aucune alerte non acquittée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 pr-4 text-[var(--text-muted)] font-medium w-24">{p.colSeverity}</th>
                  <th className="text-left py-2 pr-4 text-[var(--text-muted)] font-medium">{p.colAlert}</th>
                  <th className="text-left py-2 pr-4 text-[var(--text-muted)] font-medium w-36">{p.colValueThreshold}</th>
                  <th className="text-left py-2 text-[var(--text-muted)] font-medium w-32">{p.colTime}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${SEV_BADGE[alert.severity]}`}>
                        {SEV_ICON[alert.severity]}
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--text-primary)] font-medium">{alert.rule.name}</td>
                    <td className="py-2.5 pr-4 font-mono text-[var(--text-muted)]">
                      <span className="text-red-400 font-semibold">{alert.triggered_value.toFixed(2)}</span>
                      {" / "}
                      {alert.rule.threshold}
                    </td>
                    <td className="py-2.5 text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(alert.created_at).toLocaleDateString("fr-DZ", {
                          day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
