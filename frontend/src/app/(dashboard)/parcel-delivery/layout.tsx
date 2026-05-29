"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useParcelDeliveryStore } from "@/stores/parcelDeliveryStore";
import { useTranslation } from "@/lib/i18n";
import { Package, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

const MIN_DATE = "2023-01-01";

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function ParcelDeliveryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const p = t.pages.parcelDelivery;

  const { startDate, endDate, deliveryType, setStartDate, setEndDate, setDeliveryType } =
    useParcelDeliveryStore();

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

  const today = getTodayStr();

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
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-medium shrink-0">{p.filterFrom}</span>
          <input
            type="date"
            value={startDate}
            min={MIN_DATE}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/60 cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-medium shrink-0">{p.filterTo}</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/60 cursor-pointer"
          />
        </div>

        {/* Delivery type */}
        <div className="relative ml-2">
          <select
            value={deliveryType}
            onChange={(e) => setDeliveryType(e.target.value as "all" | "HD" | "SD")}
            className="appearance-none bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-primary/60 cursor-pointer"
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
