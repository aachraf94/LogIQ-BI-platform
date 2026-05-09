"use client";

import { Bell, ChevronDown, Calendar } from "lucide-react";
import { useAlerts } from "@/hooks/useAlerts";
import { useAuthStore } from "@/stores/authStore";
import { useFilterStore } from "@/stores/filterStore";
import { cn } from "@/lib/utils";

const DATE_RANGES = [
  { value: "7d" as const, label: "Last 7 days" },
  { value: "30d" as const, label: "Last 30 days" },
  { value: "3m" as const, label: "Last 3 months" },
  { value: "12m" as const, label: "Last 12 months" },
];

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const { criticalCount } = useAlerts();
  const { userName } = useAuthStore();
  const { dateRange, setDateRange } = useFilterStore();

  return (
    <header className="h-16 bg-[#1E2030] border-b border-[#2D3050] flex items-center justify-between px-6 sticky top-0 z-30">
      <h1 className="text-lg font-semibold text-white">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Date range */}
        <div className="flex items-center gap-1 bg-[#252840] rounded-lg p-1">
          {DATE_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDateRange(r.value)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                dateRange === r.value
                  ? "bg-primary text-white"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg bg-[#252840] text-slate-400 hover:text-white transition-colors">
          <Bell size={18} />
          {criticalCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {criticalCount}
            </span>
          )}
        </button>

        {/* User */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#252840] text-slate-300 hover:text-white transition-colors">
          <div className="w-7 h-7 rounded-full bg-primary/30 text-primary flex items-center justify-center text-xs font-bold">
            {userName ? userName[0].toUpperCase() : "K"}
          </div>
          <span className="text-sm font-medium">{userName || "Karim B."}</span>
          <ChevronDown size={14} className="text-slate-500" />
        </button>
      </div>
    </header>
  );
}
