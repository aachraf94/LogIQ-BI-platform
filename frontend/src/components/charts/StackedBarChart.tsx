"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import type { MonthlyDemandData } from "@/types/transport";
import { useChartTheme } from "@/lib/chartTheme";

interface StackedBarChartProps {
  data: MonthlyDemandData[];
  height?: number;
}

export function StackedBarChart({ data, height = 320 }: StackedBarChartProps) {
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
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: t.legendColor, fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10,
    },
    grid: { left: 16, right: 16, top: 40, bottom: 0, containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((d) => d.month),
      axisLine: { lineStyle: { color: t.axisColor } },
      axisTick: { show: false },
      axisLabel: { color: t.labelColor, fontSize: 10, rotate: 30 },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: t.splitColor, type: "dashed" } },
      axisLabel: { color: t.labelColor, fontSize: 11 },
    },
    series: [
      {
        name: "Accepted",
        type: "bar",
        stack: "total",
        data: data.map((d) => d.accepted),
        itemStyle: { color: "#10B981", borderRadius: [0, 0, 0, 0] },
      },
      {
        name: "Pending",
        type: "bar",
        stack: "total",
        data: data.map((d) => d.pending),
        itemStyle: { color: "#F59E0B" },
      },
      {
        name: "Rejected",
        type: "bar",
        stack: "total",
        data: data.map((d) => d.rejected),
        itemStyle: { color: "#EF4444", borderRadius: [4, 4, 0, 0] },
      },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <ReactECharts option={option} style={{ height }} notMerge />
    </motion.div>
  );
}
