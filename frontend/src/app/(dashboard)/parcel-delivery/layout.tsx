"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useParcelDeliveryStore } from "@/stores/parcelDeliveryStore";
import { useTranslation } from "@/lib/i18n";
import { ChevronDown, CalendarDays, ArrowRight, Activity, TrendingUp, Gauge } from "lucide-react";
import { motion } from "framer-motion";

const MIN_DATE = "2023-01-01";

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function subDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function startOfYear(): string {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().split("T")[0];
}

export default function ParcelDeliveryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const p = t.pages.parcelDelivery;

  const { startDate, endDate, deliveryType, setStartDate, setEndDate, setDeliveryType } =
    useParcelDeliveryStore();

  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [activeQuick, setActiveQuick] = useState<string | null>(null);

  const today = getTodayStr();
  const isDirty = pendingStart !== startDate || pendingEnd !== endDate;

  function applyDates() {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
  }

  function applyQuick(label: string, s: string, e: string) {
    setPendingStart(s);
    setPendingEnd(e);
    setActiveQuick(label);
    setStartDate(s);
    setEndDate(e);
  }

  const quickSelects = [
    { label: "7D",  s: subDays(6),    e: today },
    { label: "30D", s: subDays(29),   e: today },
    { label: "90D", s: subDays(89),   e: today },
    { label: "YTD", s: startOfYear(), e: today },
  ];

  const tabs = [
    { label: p.tabOperations,  href: "/parcel-delivery/operations",         Icon: Activity   },
    { label: p.tabCostProfit,  href: "/parcel-delivery/cost-profitability", Icon: TrendingUp },
    { label: p.tabPerformance, href: "/parcel-delivery/performance",        Icon: Gauge      },
  ];

  const deliveryTypes = [
    { label: p.allTypes,     value: "all" as const },
    { label: p.homeDelivery, value: "HD"  as const },
    { label: p.pickupPoint,  value: "SD"  as const },
  ];

  return (
    <div className="space-y-0">

      {/* ── Tab navigation ── */}
      <div className="border-b border-[var(--border)] mb-5">
        <nav className="flex gap-0.5">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors rounded-t-lg",
                  active
                    ? "text-primary bg-primary/5"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]"
                )}
              >
                <tab.Icon size={14} className="shrink-0" />
                {tab.label}
                {active && (
                  <motion.div
                    layoutId="parcel-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Futuristic filter bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 mb-5
        bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">

        {/* Quick-select pills */}
        <div className="flex items-center gap-1 px-3 py-2.5">
          {quickSelects.map((qs) => (
            <button
              key={qs.label}
              onClick={() => applyQuick(qs.label, qs.s, qs.e)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all duration-200",
                activeQuick === qs.label
                  ? "bg-primary/15 border-primary/50 text-primary shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                  : "bg-transparent border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text-secondary)]"
              )}
            >
              {qs.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="hidden sm:block w-px h-8 bg-[var(--border)] shrink-0" />
        <div className="sm:hidden h-px w-full bg-[var(--border)]" />

        {/* Date range */}
        <div className="flex items-center gap-2 px-3 py-2 sm:py-0">
          {/* From */}
          <div className="relative flex items-center group">
            <CalendarDays
              size={13}
              className="absolute left-2.5 text-[var(--text-muted)] group-focus-within:text-primary pointer-events-none z-10 transition-colors"
            />
            <input
              type="date"
              value={pendingStart}
              min={MIN_DATE}
              max={pendingEnd}
              onChange={(e) => { setPendingStart(e.target.value); setActiveQuick(null); }}
              className={cn(
                "bg-[var(--surface-secondary)] border text-[var(--text-primary)] text-xs font-mono",
                "rounded-xl pl-8 pr-2 py-1.5 w-[138px] cursor-pointer transition-all",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
                "hover:border-primary/30",
                isDirty && (pendingStart !== startDate)
                  ? "border-primary/40 text-primary"
                  : "border-[var(--border)]"
              )}
            />
          </div>

          <ArrowRight size={12} className="text-[var(--text-muted)] shrink-0" />

          {/* To */}
          <div className="relative flex items-center group">
            <CalendarDays
              size={13}
              className="absolute left-2.5 text-[var(--text-muted)] group-focus-within:text-primary pointer-events-none z-10 transition-colors"
            />
            <input
              type="date"
              value={pendingEnd}
              min={pendingStart}
              max={today}
              onChange={(e) => { setPendingEnd(e.target.value); setActiveQuick(null); }}
              className={cn(
                "bg-[var(--surface-secondary)] border text-[var(--text-primary)] text-xs font-mono",
                "rounded-xl pl-8 pr-2 py-1.5 w-[138px] cursor-pointer transition-all",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
                "hover:border-primary/30",
                isDirty && (pendingEnd !== endDate)
                  ? "border-primary/40 text-primary"
                  : "border-[var(--border)]"
              )}
            />
          </div>

          {/* Apply */}
          {isDirty && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={applyDates}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-primary text-white
                hover:bg-primary/90 transition-colors shadow-[0_0_12px_rgba(99,102,241,0.25)] shrink-0"
            >
              Appliquer
            </motion.button>
          )}
        </div>

        {/* Right separator + delivery type — pushed to end */}
        <div className="hidden sm:block w-px h-8 bg-[var(--border)] shrink-0 ml-auto" />
        <div className="sm:hidden h-px w-full bg-[var(--border)]" />

        <div className="relative px-3 py-2 sm:py-0">
          <select
            value={deliveryType}
            onChange={(e) => setDeliveryType(e.target.value as "all" | "HD" | "SD")}
            className="appearance-none bg-transparent text-[var(--text-primary)] text-xs font-medium
              pl-2 pr-7 py-1.5 focus:outline-none cursor-pointer w-full sm:w-auto"
          >
            {deliveryTypes.map((dt) => (
              <option key={dt.value} value={dt.value}>{dt.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* ── Sub-page content ── */}
      {children}
    </div>
  );
}
