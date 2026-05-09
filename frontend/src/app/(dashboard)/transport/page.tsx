"use client";

import { KpiCard } from "@/components/ui/KpiCard";
import { DataTable } from "@/components/ui/DataTable";
import { StackedBarChart } from "@/components/charts/StackedBarChart";
import { LineChart } from "@/components/charts/LineChart";
import { HeatmapChart } from "@/components/charts/HeatmapChart";
import { AlertBadge } from "@/components/ui/AlertBadge";
import {
  monthlyDemandData,
  transportDemands,
  heatmapData,
} from "@/lib/mock-data";
import { formatNumber, formatDZD } from "@/lib/utils";
import type { Column } from "@/components/ui/DataTable";
import type { TransportDemand } from "@/types/transport";
import { CheckCircle, XCircle, Clock, BarChart2 } from "lucide-react";

const demandColumns: Column<TransportDemand>[] = [
  { key: "id", header: "Demand ID", sortable: true },
  { key: "client", header: "Client", sortable: true },
  { key: "origin", header: "Origin", sortable: true },
  { key: "destination", header: "Destination", sortable: true },
  { key: "date", header: "Date", sortable: true },
  {
    key: "cost",
    header: "Cost (DZD)",
    sortable: true,
    render: (row) => <span className="font-mono text-sm">{row.cost.toLocaleString()}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => {
      const colors = {
        accepted: "text-emerald-400 bg-emerald-400/10",
        rejected: "text-red-400 bg-red-400/10",
        pending: "text-amber-400 bg-amber-400/10",
      };
      return (
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${colors[row.status]}`}>
          {row.status}
        </span>
      );
    },
  },
];

const totalAccepted = monthlyDemandData.reduce((s, d) => s + d.accepted, 0);
const totalRejected = monthlyDemandData.reduce((s, d) => s + d.rejected, 0);
const totalPending = monthlyDemandData.reduce((s, d) => s + d.pending, 0);
const totalAll = totalAccepted + totalRejected + totalPending;

const avgCostData = monthlyDemandData.map((d) => d.avgCostPerDemand);

export default function TransportPage() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Total Demands" value={formatNumber(totalAll)} trend={8.3} icon={<BarChart2 size={16} />} index={0} />
        <KpiCard title="Accepted" value={formatNumber(totalAccepted)} trend={10.2} icon={<CheckCircle size={16} />} index={1} />
        <KpiCard title="Rejected" value={formatNumber(totalRejected)} trend={-2.4} icon={<XCircle size={16} />} index={2} />
        <KpiCard title="Pending" value={formatNumber(totalPending)} trend={4.1} icon={<Clock size={16} />} index={3} />
      </div>

      {/* Stacked bar */}
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Monthly Demands by Status</h3>
        <StackedBarChart data={monthlyDemandData} height={300} />
      </div>

      {/* Line chart + Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Average Cost per Demand Over Time</h3>
          <LineChart
            categories={monthlyDemandData.map((d) => d.month)}
            series={[{ name: "Avg Cost (DZD)", data: avgCostData, color: "#F59E0B" }]}
            height={280}
            yFormatter={(v) => `${v.toLocaleString()} DZD`}
          />
        </div>
        <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Demand Volume by City × Day of Week</h3>
          <HeatmapChart data={heatmapData} height={280} />
        </div>
      </div>

      {/* Demand table */}
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Demand Records</h3>
        <DataTable columns={demandColumns} data={transportDemands} />
      </div>
    </div>
  );
}
