"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { useChartTheme } from "@/lib/chartTheme";

interface PieChartProps {
  data: { name: string; value: number }[];
  height?: number;
}

const COLORS = ["#6366F1", "#22D3EE", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#F97316", "#14B8A6", "#84CC16"];

function EmptyState({ height }: { height: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-[var(--text-muted)] select-none" style={{ height }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="opacity-25">
        <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2" strokeDasharray="5 3"/>
        <circle cx="24" cy="24" r="7" fill="currentColor" opacity="0.5"/>
      </svg>
      <p className="text-xs font-medium">Aucune donnée disponible</p>
    </div>
  );
}

export function PieChart({ data, height = 320 }: PieChartProps) {
  const t = useChartTheme()

  if (data.length === 0) {
    return <EmptyState height={height} />;
  }

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: t.tooltipBg,
      borderColor: t.borderColor,
      textStyle: { color: t.textColor, fontSize: 12 },
      formatter: "{b}: {c} ({d}%)",
    },
    legend: {
      orient: "vertical",
      right: 10,
      top: "center",
      textStyle: { color: t.legendColor, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: "pie",
        radius: ["42%", "70%"],
        center: ["40%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: { borderColor: t.bgColor, borderWidth: 2, borderRadius: 6 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: "bold", color: t.textColor },
          itemStyle: { shadowBlur: 20, shadowOffsetX: 0, shadowColor: "rgba(99,102,241,0.5)" },
        },
        data: data.map((d, i) => ({
          ...d,
          itemStyle: { color: COLORS[i % COLORS.length] },
        })),
      },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />
    </motion.div>
  );
}
