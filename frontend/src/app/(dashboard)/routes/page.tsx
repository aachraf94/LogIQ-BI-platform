"use client";

import { KpiCard } from "@/components/ui/KpiCard";
import { DataTable } from "@/components/ui/DataTable";
import { BarChart } from "@/components/charts/BarChart";
import { RadarChart } from "@/components/charts/RadarChart";
import { routes } from "@/lib/mock-data";
import type { Column } from "@/components/ui/DataTable";
import type { Route } from "@/types/route";
import { Route as RouteIcon, Ruler, DollarSign, Hammer } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslation } from "@/lib/i18n";

const RouteMap = dynamic(
  () => import("@/components/maps/RouteMap").then((m) => m.RouteMap),
  { ssr: false, loading: () => <div className="h-[460px] rounded-xl bg-[var(--surface-secondary)] animate-pulse" /> }
);

const avgDistance = Math.round(routes.reduce((s, r) => s + r.distance, 0) / routes.length);
const avgCostPerKm = Math.round(routes.reduce((s, r) => s + r.costPerKm, 0) / routes.length);

const groupedRouteData = routes.slice(0, 8).map((r) => ({
  route: `${r.origin.slice(0, 3)} → ${r.destination.slice(0, 3)}`,
  actual: r.actualCost,
  optimized: r.optimizedCost,
}));

const actualBars = groupedRouteData.map((d) => ({ name: d.route, value: d.actual }));
const radarData = [82, 75, 100, 52, 78];

export default function RoutesPage() {
  const { t } = useTranslation();
  const p = t.pages.routes;

  const routeColumns: Column<Route>[] = [
    { key: "origin", header: p.colOrigin, sortable: true },
    { key: "destination", header: p.colDestination, sortable: true },
    {
      key: "distance",
      header: p.colDistance,
      sortable: true,
      render: (r) => <span className="font-mono text-sm">{r.distance}</span>,
    },
    {
      key: "avgDuration",
      header: p.colAvgDuration,
      sortable: true,
      render: (r) => <span className="text-slate-300 text-sm">{Math.floor(r.avgDuration / 60)}h {r.avgDuration % 60}m</span>,
    },
    {
      key: "actualCost",
      header: p.colActualCost,
      sortable: true,
      render: (r) => <span className="font-mono text-sm">{r.actualCost.toLocaleString()} DZD</span>,
    },
    {
      key: "optimizedCost",
      header: p.colOptimizedCost,
      sortable: true,
      render: (r) => <span className="font-mono text-sm text-emerald-400">{r.optimizedCost.toLocaleString()} DZD</span>,
    },
    {
      key: "savingsPotential",
      header: p.colSavings,
      sortable: true,
      render: (r) => <span className="text-amber-400 font-semibold text-sm">{r.savingsPotential.toLocaleString()} DZD</span>,
    },
    {
      key: "efficiencyScore",
      header: p.colEfficiency,
      sortable: true,
      render: (r) => {
        const color = r.efficiencyScore >= 90 ? "text-emerald-400" : r.efficiencyScore >= 80 ? "text-amber-400" : "text-red-400";
        return <span className={`font-bold text-sm ${color}`}>{r.efficiencyScore}%</span>;
      },
    },
  ];

  const radarIndicators = [
    { name: p.radarCostEff, max: 100 },
    { name: p.radarTimeEff, max: 100 },
    { name: p.radarVolume, max: 100 },
    { name: p.radarDistance, max: 100 },
    { name: p.radarProfitability, max: 100 },
  ];

  return (
    <div className="space-y-6">
      {/* ── Work-in-progress floating notice ── */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[900]
        flex flex-col items-center gap-4 px-8 py-6 rounded-2xl w-80
        border border-amber-500/40 bg-[var(--surface)]
        shadow-[0_16px_48px_rgba(0,0,0,0.28),0_0_0_1px_rgba(245,158,11,0.18)]">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
        </span>
        <div className="flex flex-col items-center gap-2 text-center">
          <Hammer size={32} className="text-amber-400" />
          <p className="text-base font-semibold text-amber-400">{p.wipTitle}</p>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{p.wipDesc}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title={p.kpiTotalRoutes} value={String(routes.length)} trend={5.1} icon={<RouteIcon size={16} />} index={0} />
        <KpiCard title={p.kpiAvgDistance} value={`${avgDistance} km`} trend={-1.2} icon={<Ruler size={16} />} index={1} />
        <KpiCard title={p.kpiAvgCostPerKm} value={`${avgCostPerKm} DZD`} trend={2.8} icon={<DollarSign size={16} />} index={2} />
      </div>

      {/* Map */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{p.mapTitle}</h3>
        <p className="text-xs text-slate-500 mb-4">{p.mapDesc}</p>
        <RouteMap routes={routes} height={440} />
      </div>

      {/* Actual vs Radar */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{p.chartActualCost}</h3>
          <p className="text-xs text-slate-500 mb-4">{p.chartActualCostSub}</p>
          <BarChart data={actualBars} height={280} color="#6366F1" label={p.chartActualLabel} />
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{p.chartRadar}</h3>
          <p className="text-xs text-slate-500 mb-4">{p.chartRadarSub}</p>
          <RadarChart indicators={radarIndicators} data={radarData} label="Algiers → Oran" height={280} />
        </div>
      </div>

      {/* Route table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{p.chartComparison}</h3>
        <DataTable columns={routeColumns} data={routes} />
      </div>
    </div>
  );
}
