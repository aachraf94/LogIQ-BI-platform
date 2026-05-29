"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTransportStore } from "@/stores/transportStore";
import { useTranslation } from "@/lib/i18n";
import { ChevronDown, CalendarDays, ArrowRight, Activity, Wallet, Gauge } from "lucide-react";
import { motion } from "framer-motion";

const MIN_DATE = "2023-01-01";

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
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

export default function TransportLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const p = t.pages.transport;

  const { startDate, endDate, serviceType, usingMock, setStartDate, setEndDate, setServiceType } =
    useTransportStore();

  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [activeQuick, setActiveQuick] = useState<string | null>(null);

  const yesterday = getYesterdayStr();
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
    { label: "7D",  s: subDays(7),    e: yesterday },
    { label: "30D", s: subDays(30),   e: yesterday },
    { label: "90D", s: subDays(90),   e: yesterday },
    { label: "YTD", s: startOfYear(), e: yesterday },
  ];

  const tabs = [
    { label: p.tabOperations, href: "/transport/operations",         Icon: Activity },
    { label: p.tabCostProfit, href: "/transport/cost-profitability", Icon: Wallet   },
    { label: p.tabPerformance,href: "/transport/performance",        Icon: Gauge    },
  ];

  const serviceTypes = [
    { label: p.allServices,   value: "all"           as const },
    { label: p.dedicatedTrip, value: "course_dediee" as const },
    { label: p.courier,       value: "courrier"       as const },
    { label: p.handling,      value: "manutention"    as const },
  ];

  return (
    <div className="space-y-0">

      {/* ── Tab navigation + demo badge ── */}
      <div className="border-b border-[var(--border)] mb-5 flex items-end justify-between">
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
                    layoutId="transport-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Demo badge */}
        {usingMock && (
          <div className="mb-1 mr-1 flex items-center gap-1.5 text-[10px] font-medium text-amber-400/90
            border border-amber-400/25 bg-amber-400/5 px-2.5 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 animate-pulse shrink-0" />
            {p.demoData}
          </div>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-0 mb-8
        bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden divide-x-0 sm:divide-x divide-[var(--border)]">

        {/* Quick-select pills */}
        <div className="flex items-center gap-1 px-3 py-2.5 shrink-0">
          {quickSelects.map((qs) => (
            <button
              key={qs.label}
              onClick={() => applyQuick(qs.label, qs.s, qs.e)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-all duration-200",
                activeQuick === qs.label
                  ? "bg-primary/15 border-primary/50 text-primary shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                  : "bg-transparent border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text-secondary)]"
              )}
            >
              {qs.label}
            </button>
          ))}
        </div>

        <div className="sm:hidden h-px w-full bg-[var(--border)]" />

        {/* Date range */}
        <div className="flex items-center gap-2 px-3 py-2 sm:py-0">
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
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 hover:border-primary/30",
                isDirty && pendingStart !== startDate ? "border-primary/40" : "border-[var(--border)]"
              )}
            />
          </div>

          <ArrowRight size={12} className="text-[var(--text-muted)] shrink-0" />

          <div className="relative flex items-center group">
            <CalendarDays
              size={13}
              className="absolute left-2.5 text-[var(--text-muted)] group-focus-within:text-primary pointer-events-none z-10 transition-colors"
            />
            <input
              type="date"
              value={pendingEnd}
              min={pendingStart}
              max={yesterday}
              onChange={(e) => { setPendingEnd(e.target.value); setActiveQuick(null); }}
              className={cn(
                "bg-[var(--surface-secondary)] border text-[var(--text-primary)] text-xs font-mono",
                "rounded-xl pl-8 pr-2 py-1.5 w-[138px] cursor-pointer transition-all",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 hover:border-primary/30",
                isDirty && pendingEnd !== endDate ? "border-primary/40" : "border-[var(--border)]"
              )}
            />
          </div>

          {isDirty && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={applyDates}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-primary text-white
                hover:bg-primary/90 transition-colors shadow-[0_0_12px_rgba(99,102,241,0.25)] shrink-0"
            >
              Appliquer
            </motion.button>
          )}
        </div>

        <div className="sm:hidden h-px w-full bg-[var(--border)]" />

        {/* Service type filter */}
        <div className="relative px-3 py-2 sm:py-1.5 sm:ml-auto">
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as "all" | "course_dediee" | "courrier" | "manutention")}
            className={cn(
              "appearance-none text-xs font-medium pl-2 pr-7 py-1.5 rounded-xl cursor-pointer",
              "bg-[var(--surface-secondary)] border border-[var(--border)]",
              "text-[var(--text-primary)] focus:outline-none focus:border-primary/50",
              "w-full sm:w-auto"
            )}
          >
            {serviceTypes.map((st) => (
              <option
                key={st.value}
                value={st.value}
                className="bg-[var(--surface)] text-[var(--text-primary)]"
              >
                {st.label}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* ── Sub-page content ── */}
      <div className="pt-3">
        {children}
      </div>
    </div>
  );
}
