"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  trend: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  index?: number;
}

export function KpiCard({ title, value, trend, trendLabel, icon, index = 0 }: KpiCardProps) {
  const isPositive = trend >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-400 font-medium">{title}</p>
        {icon && (
          <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        )}
      </div>

      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold text-white">{value}</p>
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
            isPositive
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          )}
        >
          {isPositive ? (
            <TrendingUp size={12} />
          ) : (
            <TrendingDown size={12} />
          )}
          {Math.abs(trend).toFixed(1)}%
        </div>
      </div>

      {trendLabel && (
        <p className="text-xs text-slate-500">{trendLabel}</p>
      )}
    </motion.div>
  );
}
