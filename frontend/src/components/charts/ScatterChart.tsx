"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import type { ParcelScatterPoint } from "@/types/parcel";
import { useChartTheme } from "@/lib/chartTheme";

interface ScatterChartProps {
  data: ParcelScatterPoint[];
  height?: number;
}

export function ScatterChart({ data, height = 340 }: ScatterChartProps) {
  const t = useChartTheme()

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: t.tooltipBg,
      borderColor: t.borderColor,
      textStyle: { color: t.textColor, fontSize: 12 },
      formatter: (p: { data: [number, number, number, string] }) =>
        `Weight: ${p.data[0]}kg<br/>Cost: ${p.data[1]} DZD<br/>Distance: ${p.data[2]}km<br/>City: ${p.data[3]}`,
    },
    xAxis: {
      name: "Weight (kg)",
      nameLocation: "middle",
      nameGap: 28,
      nameTextStyle: { color: t.labelColor, fontSize: 11 },
      axisLine: { lineStyle: { color: t.axisColor } },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: t.splitColor, type: "dashed" } },
      axisLabel: { color: t.labelColor, fontSize: 11 },
    },
    yAxis: {
      name: "Cost (DZD)",
      nameLocation: "middle",
      nameGap: 45,
      nameTextStyle: { color: t.labelColor, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: t.splitColor, type: "dashed" } },
      axisLabel: { color: t.labelColor, fontSize: 11 },
    },
    visualMap: {
      show: false,
      dimension: 2,
      min: 80,
      max: 780,
      inRange: { color: ["#22D3EE", "#6366F1", "#EF4444"] },
    },
    series: [
      {
        type: "scatter",
        data: data.map((d) => [d.weight, d.cost, d.distance, d.city]),
        symbolSize: (val: number[]) => Math.max(8, val[2] / 60),
        itemStyle: { opacity: 0.75 },
        emphasis: { itemStyle: { opacity: 1, shadowBlur: 10, shadowColor: "rgba(99,102,241,0.6)" } },
      },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.35 }}
    >
      <ReactECharts option={option} style={{ height }} notMerge />
    </motion.div>
  );
}
