"use client";

import { KpiCard } from "@/components/ui/KpiCard";
import { DataTable } from "@/components/ui/DataTable";
import { BarChart } from "@/components/charts/BarChart";
import { RadarChart } from "@/components/charts/RadarChart";
import { routes } from "@/lib/mock-data";
import type { Column } from "@/components/ui/DataTable";
import type { Route } from "@/types/route";
import { Route as RouteIcon, Ruler, DollarSign } from "lucide-react";
import dynamic from "next/dynamic";

const RouteMap = dynamic(
  () => import("@/components/maps/RouteMap").then((m) => m.RouteMap),
  { ssr: false, loading: () => <div className="h-[460px] rounded-xl bg-[#252840] animate-pulse" /> }
);

const routeColumns: Column<Route>[] = [
  { key: "origin", header: "Origin", sortable: true },
  { key: "destination", header: "Destination", sortable: true },
  {
    key: "distance",
    header: "Distance (km)",
    sortable: true,
    render: (r) => <span className="font-mono text-sm">{r.distance}</span>,
  },
  {
    key: "avgDuration",
    header: "Avg Duration",
    sortable: true,
    render: (r) => <span className="text-slate-300 text-sm">{Math.floor(r.avgDuration / 60)}h {r.avgDuration % 60}m</span>,
  },
  {
    key: "actualCost",
    header: "Actual Cost",
    sortable: true,
    render: (r) => <span className="font-mono text-sm">{r.actualCost.toLocaleString()} DZD</span>,
  },
  {
    key: "optimizedCost",
    header: "Optimized Cost",
    sortable: true,
    render: (r) => <span className="font-mono text-sm text-emerald-400">{r.optimizedCost.toLocaleString()} DZD</span>,
  },
  {
    key: "savingsPotential",
    header: "Savings",
    sortable: true,
    render: (r) => <span className="text-amber-400 font-semibold text-sm">{r.savingsPotential.toLocaleString()} DZD</span>,
  },
  {
    key: "efficiencyScore",
    header: "Efficiency",
    sortable: true,
    render: (r) => {
      const color = r.efficiencyScore >= 90 ? "text-emerald-400" : r.efficiencyScore >= 80 ? "text-amber-400" : "text-red-400";
      return <span className={`font-bold text-sm ${color}`}>{r.efficiencyScore}%</span>;
    },
  },
];

// Prepare grouped bar data
const groupedRouteData = routes.slice(0, 8).map((r) => ({
  route: `${r.origin.slice(0, 3)} → ${r.destination.slice(0, 3)}`,
  actual: r.actualCost,
  optimized: r.optimizedCost,
}));

const avgDistance = Math.round(routes.reduce((s, r) => s + r.distance, 0) / routes.length);
const avgCostPerKm = Math.round(routes.reduce((s, r) => s + r.costPerKm, 0) / routes.length);

// Radar chart for top route
const topRoute = routes[0];
const radarIndicators = [
  { name: "Cost Efficiency", max: 100 },
  { name: "Time Efficiency", max: 100 },
  { name: "Volume", max: 100 },
  { name: "Distance", max: 100 },
  { name: "Profitability", max: 100 },
];
const radarData = [82, 75, 100, 52, 78];

// ECharts grouped bar option via BarChart workaround — use two separate bars
const actualBars = groupedRouteData.map((d) => ({ name: d.route, value: d.actual }));
const optimizedBars = groupedRouteData.map((d) => ({ name: d.route, value: d.optimized }));

export default function RoutesPage() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Total Routes" value={String(routes.length)} trend={5.1} icon={<RouteIcon size={16} />} index={0} />
        <KpiCard title="Avg Distance" value={`${avgDistance} km`} trend={-1.2} icon={<Ruler size={16} />} index={1} />
        <KpiCard title="Avg Cost / KM" value={`${avgCostPerKm} DZD`} trend={2.8} icon={<DollarSign size={16} />} index={2} />
      </div>

      {/* Map */}
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Route Map — Algeria</h3>
        <p className="text-xs text-slate-500 mb-4">Green = high efficiency (&gt;90%) | Amber = moderate (80–90%) | Red = low (&lt;80%)</p>
        <RouteMap routes={routes} height={440} />
      </div>

      {/* Actual vs optimized + Radar */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Actual Cost by Route</h3>
          <p className="text-xs text-slate-500 mb-4">Primary bar = actual cost. Compare savings potential per route.</p>
          <BarChart data={actualBars} height={280} color="#6366F1" label="Actual Cost (DZD)" />
        </div>
        <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Route Performance — Algiers → Oran</h3>
          <p className="text-xs text-slate-500 mb-4">Multi-dimensional performance radar for the top-volume route.</p>
          <RadarChart indicators={radarIndicators} data={radarData} label="Algiers → Oran" height={280} />
        </div>
      </div>

      {/* Route table */}
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Route Comparison</h3>
        <DataTable columns={routeColumns} data={routes} />
      </div>
    </div>
  );
}
