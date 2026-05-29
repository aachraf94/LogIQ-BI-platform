"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  index?: number;
  onInfoClick?: () => void;
}

export function KpiCard({ title, value, trend, trendLabel, icon, index = 0, onInfoClick }: KpiCardProps) {
  const hasTrend = trend !== undefined && trend !== null;
  const isPositive = hasTrend && (trend as number) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: "easeOut" }}
      className={cn(
        "bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex flex-col gap-3",
        "hover:border-primary/30 hover:shadow-[0_4px_20px_rgba(99,102,241,0.06)] transition-all relative group",
        onInfoClick && "cursor-pointer"
      )}
      onClick={onInfoClick}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--text-secondary)] font-medium truncate min-w-0 leading-snug">{title}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {onInfoClick && (
            <Info size={11} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-60 transition-opacity" />
          )}
          {icon && (
            <div className="p-1.5 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] group-hover:text-primary transition-colors">
              {icon}
            </div>
          )}
        </div>
      </div>

      <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{value}</p>

      {hasTrend && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 min-w-[3.5rem] justify-center",
              isPositive
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            )}
          >
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend as number).toFixed(1)}%
          </div>
          {trendLabel && (
            <p className="text-xs text-[var(--text-muted)]">{trendLabel}</p>
          )}
        </div>
      )}
    </motion.div>
  );
}
