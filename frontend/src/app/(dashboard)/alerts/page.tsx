"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, CheckCircle, Bell, Clock } from "lucide-react";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { BarChart } from "@/components/charts/BarChart";
import { useAlerts } from "@/hooks/useAlerts";
import { alertsOverTime } from "@/lib/mock-data";
import type { Alert } from "@/types/user";
import ReactECharts from "echarts-for-react";

type SeverityFilter = "all" | "critical" | "warning" | "info";
type StatusFilter = "all" | "active" | "resolved";

const severityIcon: Record<Alert["severity"], React.ReactNode> = {
  critical: <AlertTriangle size={18} className="text-red-400" />,
  warning: <AlertTriangle size={18} className="text-amber-400" />,
  info: <Info size={18} className="text-blue-400" />,
};

export default function AlertsPage() {
  const { alerts, resolveAlert } = useAlerts();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const filtered = alerts.filter((a) => {
    const sev = severityFilter === "all" || a.severity === severityFilter;
    const sta = statusFilter === "all" || a.status === statusFilter;
    return sev && sta;
  });

  const alertTimelineOption = {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis", backgroundColor: "#1E2030", borderColor: "#2D3050", textStyle: { color: "#E2E8F0", fontSize: 12 } },
    legend: { top: 0, right: 0, textStyle: { color: "#94A3B8", fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    grid: { left: 16, right: 16, top: 36, bottom: 0, containLabel: true },
    xAxis: { type: "category", data: alertsOverTime.map((d) => d.date), axisLine: { lineStyle: { color: "#2D3050" } }, axisTick: { show: false }, axisLabel: { color: "#64748B", fontSize: 11 } },
    yAxis: { type: "value", axisLine: { show: false }, splitLine: { lineStyle: { color: "#2D3050", type: "dashed" } }, axisLabel: { color: "#64748B", fontSize: 11 } },
    series: [
      { name: "Critical", type: "bar", stack: "total", data: alertsOverTime.map((d) => d.critical), itemStyle: { color: "#EF4444", borderRadius: [0, 0, 0, 0] } },
      { name: "Warning", type: "bar", stack: "total", data: alertsOverTime.map((d) => d.warning), itemStyle: { color: "#F59E0B" } },
      { name: "Info", type: "bar", stack: "total", data: alertsOverTime.map((d) => d.info), itemStyle: { color: "#3B82F6", borderRadius: [4, 4, 0, 0] } },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Alert timeline chart */}
      <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Alerts Over Time by Severity</h3>
        <ReactECharts option={alertTimelineOption} style={{ height: 220 }} notMerge />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-[#1E2030] border border-[#2D3050] rounded-lg p-1">
          {(["all", "critical", "warning", "info"] as SeverityFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                severityFilter === s ? "bg-primary text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-[#1E2030] border border-[#2D3050] rounded-lg p-1">
          {(["all", "active", "resolved"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? "bg-primary text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-slate-400 self-center">
          {filtered.length} alert{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Alert cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((alert) => (
            <motion.div
              key={alert.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className={`bg-[#1E2030] border rounded-xl p-5 ${
                alert.severity === "critical"
                  ? "border-red-500/30"
                  : alert.severity === "warning"
                  ? "border-amber-500/30"
                  : "border-blue-500/30"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-0.5">{severityIcon[alert.severity]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-white text-sm">{alert.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{alert.description}</p>
                    </div>
                    <AlertBadge severity={alert.severity} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-xs">
                    <div>
                      <span className="text-slate-500">KPI</span>
                      <p className="text-slate-300 font-medium">{alert.affectedKpi}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Triggered at</span>
                      <p className="text-red-400 font-bold">{alert.triggeredValue} {alert.unit}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Threshold</span>
                      <p className="text-slate-300 font-medium">{alert.threshold} {alert.unit}</p>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <Clock size={12} />
                      {new Date(alert.createdAt).toLocaleString("en-GB", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                {alert.status === "active" && (
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 flex items-center gap-1.5"
                  >
                    <CheckCircle size={13} />
                    Resolve
                  </button>
                )}
                {alert.status === "resolved" && (
                  <span className="shrink-0 text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle size={13} /> Resolved
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Bell size={32} className="mx-auto mb-3 opacity-30" />
            <p>No alerts match the selected filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
