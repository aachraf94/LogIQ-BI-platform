"use client";

import { KpiCard } from "@/components/ui/KpiCard";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { DataTable } from "@/components/ui/DataTable";
import { AreaChart } from "@/components/charts/AreaChart";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { GaugeChart } from "@/components/charts/GaugeChart";
import { LogisticsNetworkMap } from "@/components/d3/LogisticsNetworkMap";
import {
  kpiData,
  monthlyDemandData,
  demandByCity,
  topRoutesByVolume,
  networkNodes,
  networkLinks,
  alerts,
} from "@/lib/mock-data";
import { formatDZD, formatNumber } from "@/lib/utils";
import {
  TrendingUp,
  DollarSign,
  Package,
  Percent,
  Truck,
  Clock,
} from "lucide-react";
import type { Column } from "@/components/ui/DataTable";
import type { Alert } from "@/types/user";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";

const areaData = monthlyDemandData.map((d) => ({
  month: d.month,
  revenue: d.totalRevenue,
  cost: d.totalCost,
}));

const pieData = demandByCity.map((d) => ({ name: d.city, value: d.value }));
const barData = topRoutesByVolume.map((r) => ({ name: r.route, value: r.volume }));

export default function OverviewPage() {
  const { t } = useTranslation();
  const p = t.pages.overview;

  const alertColumns: Column<Alert>[] = [
    {
      key: "severity",
      header: p.colSeverity,
      render: (row) => <AlertBadge severity={row.severity} />,
    },
    { key: "title", header: p.colAlert },
    {
      key: "affectedKpi",
      header: p.colKpi,
      render: (row) => <span className="text-slate-400 text-xs">{row.affectedKpi}</span>,
    },
    {
      key: "triggeredValue",
      header: p.colValueThreshold,
      render: (row) => (
        <span className="font-mono text-xs">
          {row.triggeredValue} {row.unit} / {row.threshold} {row.unit}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: p.colTime,
      render: (row) => (
        <span className="text-slate-500 text-xs">
          {new Date(row.createdAt).toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
    },
    {
      key: "status",
      header: p.colStatus,
      render: (row) => (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.status === "active" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
          {row.status}
        </span>
      ),
    },
  ];

  const kpis = [
    {
      title: p.kpiTotalDemands,
      value: formatNumber(kpiData.totalDemands.value),
      trend: kpiData.totalDemands.trend,
      icon: <TrendingUp size={16} />,
      label: p.vsLastMonth,
    },
    {
      title: p.kpiTotalRevenue,
      value: formatDZD(kpiData.totalRevenue.value),
      trend: kpiData.totalRevenue.trend,
      icon: <DollarSign size={16} />,
      label: p.vsLastMonth,
    },
    {
      title: p.kpiAvgCost,
      value: `${kpiData.avgCostPerParcel.value} DZD`,
      trend: kpiData.avgCostPerParcel.trend,
      icon: <Package size={16} />,
      label: p.vsLastMonth,
    },
    {
      title: p.kpiProfitMargin,
      value: `${kpiData.profitMargin.value}%`,
      trend: kpiData.profitMargin.trend,
      icon: <Percent size={16} />,
      label: p.vsLastMonth,
    },
    {
      title: p.kpiActiveVehicles,
      value: String(kpiData.activeVehicles.value),
      trend: kpiData.activeVehicles.trend,
      icon: <Truck size={16} />,
      label: p.deployed,
    },
    {
      title: p.kpiOnTimeRate,
      value: `${kpiData.onTimeDeliveryRate.value}%`,
      trend: kpiData.onTimeDeliveryRate.trend,
      icon: <Clock size={16} />,
      label: p.last30Days,
    },
  ];

  const recentAlerts = alerts.filter((a) => a.status === "active").slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            trend={kpi.trend}
            trendLabel={kpi.label}
            icon={kpi.icon}
            index={i}
          />
        ))}
      </div>

      {/* Row 2: Area chart + Pie chart */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{p.revenueCostTrends}</h3>
          <AreaChart data={areaData} height={300} />
        </div>
        <div className="xl:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{p.demandsByRegion}</h3>
          <PieChart data={pieData} height={300} />
        </div>
      </div>

      {/* Row 3: Bar chart + Gauge */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{p.topRoutesByVolume}</h3>
          <BarChart
            data={barData}
            height={280}
            horizontal
            color="#6366F1"
            label="Parcels"
          />
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{p.profitMarginGauge}</h3>
          <p className="text-xs text-slate-500 mb-2">{p.gaugeDesc}</p>
          <GaugeChart value={kpiData.profitMargin.value} height={280} />
        </div>
      </div>

      {/* Row 4: D3 Logistics Network Map */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{p.logisticsNetwork}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{p.networkSub}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> {p.legendRoute}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block" /> {p.legendParcel}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-primary/30 border border-primary inline-block" /> {p.legendCity}</span>
          </div>
        </div>
        <LogisticsNetworkMap nodes={networkNodes} links={networkLinks} height={440} />
      </div>

      {/* Row 5: Recent Alerts table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{p.recentAlerts}</h3>
          <a href="/alerts" className="text-xs text-primary hover:text-primary/80 transition-colors">
            {p.viewAllAlerts}
          </a>
        </div>
        <DataTable columns={alertColumns} data={recentAlerts} />
      </div>
    </div>
  );
}
