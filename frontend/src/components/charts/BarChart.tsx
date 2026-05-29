"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { useChartTheme } from "@/lib/chartTheme";

interface BarChartMarkLine {
  value: number;
  label?: string;
  color?: string;
}

interface BarChartProps {
  data: { name: string; value: number }[];
  height?: number;
  color?: string;
  horizontal?: boolean;
  label?: string;
  markLine?: BarChartMarkLine;
}

function EmptyState({ height }: { height: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-[var(--text-muted)] select-none" style={{ height }}>
      <svg width="48" height="36" viewBox="0 0 48 36" fill="none" className="opacity-25">
        <rect x="0" y="22" width="8" height="14" rx="2" fill="currentColor"/>
        <rect x="10" y="14" width="8" height="22" rx="2" fill="currentColor"/>
        <rect x="20" y="18" width="8" height="18" rx="2" fill="currentColor"/>
        <rect x="30" y="6" width="8" height="30" rx="2" fill="currentColor"/>
        <rect x="40" y="10" width="8" height="26" rx="2" fill="currentColor"/>
      </svg>
      <p className="text-xs font-medium">Aucune donnée disponible</p>
    </div>
  );
}

export function BarChart({ data, height = 300, color = "#6366F1", horizontal = false, label, markLine }: BarChartProps) {
  const t = useChartTheme()

  if (data.length === 0) {
    return <EmptyState height={height} />;
  }

  const markLineOption = markLine ? {
    markLine: {
      silent: true,
      symbol: ["none", "none"] as [string, string],
      lineStyle: { type: "dashed" as const, color: markLine.color ?? "#EF4444", width: 1.5 },
      data: [
        horizontal
          ? {
              xAxis: markLine.value,
              label: {
                formatter: markLine.label ?? String(markLine.value),
                color: markLine.color ?? "#EF4444",
                fontSize: 11,
                position: "insideStartTop" as const,
              },
            }
          : {
              yAxis: markLine.value,
              label: {
                formatter: markLine.label ?? String(markLine.value),
                color: markLine.color ?? "#EF4444",
                fontSize: 11,
              },
            },
      ],
    },
  } : {};

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: t.tooltipBg,
      borderColor: t.borderColor,
      textStyle: { color: t.textColor, fontSize: 12 },
      axisPointer: { type: "shadow" },
    },
    grid: {
      left: horizontal ? 100 : 16,
      right: 16,
      top: 16,
      bottom: 16,
      containLabel: true,
    },
    xAxis: horizontal
      ? { type: "value", axisLine: { show: false }, splitLine: { lineStyle: { color: t.splitColor, type: "dashed" } }, axisLabel: { color: t.labelColor, fontSize: 11 } }
      : { type: "category", data: data.map((d) => d.name), axisLine: { lineStyle: { color: t.axisColor } }, axisTick: { show: false }, axisLabel: { color: t.labelColor, fontSize: 11 } },
    yAxis: horizontal
      ? { type: "category", data: data.map((d) => d.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.legendColor, fontSize: 11 } }
      : { type: "value", axisLine: { show: false }, splitLine: { lineStyle: { color: t.splitColor, type: "dashed" } }, axisLabel: { color: t.labelColor, fontSize: 11 } },
    series: [
      {
        name: label,
        type: "bar",
        data: data.map((d) => d.value),
        itemStyle: {
          color: {
            type: "linear",
            x: horizontal ? 1 : 0, y: 0, x2: horizontal ? 0 : 0, y2: horizontal ? 0 : 1,
            colorStops: [
              { offset: 0, color },
              { offset: 1, color: color + "80" },
            ],
          },
          borderRadius: horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0],
        },
        emphasis: { itemStyle: { opacity: 0.85 } },
        barMaxWidth: 40,
        ...markLineOption,
      },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />
    </motion.div>
  );
}
