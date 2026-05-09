"use client";

import { KpiCard } from "@/components/ui/KpiCard";
import { LineChart } from "@/components/charts/LineChart";
import { SankeyChart } from "@/components/charts/SankeyChart";
import { ScatterChart } from "@/components/charts/ScatterChart";
import {
  parcelCostBreakdown,
  sankeyData,
  parcelScatterData,
  costAlerts,
  kpiData,
} from "@/lib/mock-data";
import { formatDZD } from "@/lib/utils";
import { AlertTriangle, Package, TrendingDown, BarChart2 } from "lucide-react";
import { AlertBadge } from "@/components/ui/AlertBadge";

export default function ParcelCostsPage() {
  const transportSeries = parcelCostBreakdown.map((d) => d.transportCost);
  const handlingSeries = parcelCostBreakdown.map((d) => d.handlingCost);
  const storageSeries = parcelCostBreakdown.map((d) => d.storageCost);
  const categories = parcelCostBreakdown.map((d) => d.date.slice(5));

  const totalLogisticsCost = parcelCostBreakdown.reduce((s, d) => s + d.totalCost, 0);
  const avgCost = Math.round(totalLogisticsCost / parcelCostBreakdown.length);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Avg Cost / Parcel" value={`${kpiData.avgCostPerParcel.value} DZD`} trend={kpiData.avgCostPerParcel.trend} icon={<Package size={16} />} index={0} />
        <KpiCard title="Total Logistics Cost" value={formatDZD(totalLogisticsCost)} trend={5.2} icon={<BarChart2 size={16} />} index={1} />
        <KpiCard title="Cost Variance" value="12.4%" trend={-1.8} icon={<TrendingDown size={16} />} index={2} />
        <KpiCard title="Parcels Processed" value="8,240" trend={6.7} icon={<Package size={16} />} index={3} />
      </div>

      {/* Cost breakdown line chart */}
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Cost Breakdown Over Time (DZD / parcel)</h3>
        <LineChart
          categories={categories}
          series={[
            { name: "Transport", data: transportSeries, color: "#6366F1" },
            { name: "Handling", data: handlingSeries, color: "#22D3EE" },
            { name: "Storage", data: storageSeries, color: "#F59E0B" },
          ]}
          height={300}
          yFormatter={(v) => `${v} DZD`}
        />
      </div>

      {/* Sankey + Scatter */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Cost Flow Analysis</h3>
          <p className="text-xs text-slate-500 mb-4">How total cost flows from categories → zones → final delivery outcome (%)</p>
          <SankeyChart data={sankeyData} height={340} />
        </div>
        <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Cost vs Weight per Parcel</h3>
          <p className="text-xs text-slate-500 mb-4">Dot size = distance. Color = distance (blue → red)</p>
          <ScatterChart data={parcelScatterData} height={340} />
        </div>
      </div>

      {/* Active cost alerts */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Active Cost Alerts</h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {costAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className={alert.severity === "critical" ? "text-red-400" : "text-amber-400"} />
                  <h4 className="font-semibold text-white text-sm">{alert.title}</h4>
                </div>
                <AlertBadge severity={alert.severity} />
              </div>
              <p className="text-xs text-slate-400">{alert.description}</p>
              <div className="flex items-center gap-6 text-xs">
                <div>
                  <span className="text-slate-500">Actual</span>
                  <p className="text-red-400 font-bold text-sm">{alert.actualValue} DZD</p>
                </div>
                <div>
                  <span className="text-slate-500">Threshold</span>
                  <p className="text-emerald-400 font-bold text-sm">{alert.threshold} DZD</p>
                </div>
                <div>
                  <span className="text-slate-500">City</span>
                  <p className="text-white font-semibold text-sm">{alert.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
