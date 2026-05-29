"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useParcelDeliveryStore } from "@/stores/parcelDeliveryStore";
import { useTranslation } from "@/lib/i18n";
import { Package, ChevronDown, CalendarDays } from "lucide-react";
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
    { label: "7D",  s: subDays(6),     e: today },
    { label: "30D", s: subDays(29),    e: today },
    { label: "90D", s: subDays(89),    e: today },
    { label: "YTD", s: startOfYear(),  e: today },
  ];

  const tabs = [
    { label: p.tabOperations,  href: "/parcel-delivery/operations"         },
    { label: p.tabCostProfit,  href: "/parcel-delivery/cost-profitability" },
    { label: p.tabPerformance, href: "/parcel-delivery/performance"        },
  ];

  const deliveryTypes = [
    { label: p.allTypes,     value: "all" as const },
    { label: p.homeDelivery, value: "HD"  as const },
    { label: p.pickupPoint,  value: "SD"  as const },
  ];

  return (
    <div className="space-y-0">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Package size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{t.nav.parcelDelivery}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {t.dashboard.parcels}
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-[var(--border)] mb-5">
        <nav className="flex gap-1">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                {tab.label}
                {active && (
                  <motion.div
                    layoutId="parcel-delivery-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t"
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-6 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl">

        {/* Quick-select pills */}
        <div className="flex items-center gap-1.5">
          {quickSelects.map((qs) => (
            <button
              key={qs.label}
              onClick={() => applyQuick(qs.label, qs.s, qs.e)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors",
                activeQuick === qs.label
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-primary/30 hover:text-[var(--text-secondary)]"
              )}
            >
              {qs.label}
            </button>
          ))}
        </div>

        <div className="hidden sm:block w-px h-5 bg-[var(--border)]" />

        {/* From date */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-medium shrink-0">{p.filterFrom}</span>
          <div className="relative flex items-center">
            <CalendarDays size={13} className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none z-10" />
            <input
              type="date"
              value={pendingStart}
              min={MIN_DATE}
              max={pendingEnd}
              onChange={(e) => { setPendingStart(e.target.value); setActiveQuick(null); }}
              className="bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-primary/60 cursor-pointer w-full sm:w-auto"
            />
          </div>
        </div>

        {/* To date */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-medium shrink-0">{p.filterTo}</span>
          <div className="relative flex items-center">
            <CalendarDays size={13} className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none z-10" />
            <input
              type="date"
              value={pendingEnd}
              min={pendingStart}
              max={today}
              onChange={(e) => { setPendingEnd(e.target.value); setActiveQuick(null); }}
              className="bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-primary/60 cursor-pointer w-full sm:w-auto"
            />
          </div>
        </div>

        {/* Apply button — only visible when dates differ from committed values */}
        {isDirty && (
          <button
            onClick={applyDates}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors shrink-0"
          >
            Appliquer
          </button>
        )}

        {/* Delivery type */}
        <div className="relative sm:ml-auto">
          <select
            value={deliveryType}
            onChange={(e) => setDeliveryType(e.target.value as "all" | "HD" | "SD")}
            className="appearance-none bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-primary/60 cursor-pointer w-full sm:w-auto"
          >
            {deliveryTypes.map((dt) => (
              <option key={dt.value} value={dt.value}>{dt.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Sub-page content */}
      {children}
    </div>
  );
}
