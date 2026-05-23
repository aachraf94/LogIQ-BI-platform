"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { useChartTheme } from "@/lib/chartTheme";

interface BarChartProps {
  data: { name: string; value: number }[];
  height?: number;
  color?: string;
  horizontal?: boolean;
  label?: string;
}

export function BarChart({ data, height = 300, color = "#6366F1", horizontal = false, label }: BarChartProps) {
  const t = useChartTheme()

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
      },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      <ReactECharts option={option} style={{ height }} notMerge />
    </motion.div>
  );
}
