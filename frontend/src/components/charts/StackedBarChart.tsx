"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import type { MonthlyDemandData } from "@/types/transport";

interface StackedBarChartProps {
  data: MonthlyDemandData[];
  height?: number;
}

export function StackedBarChart({ data, height = 320 }: StackedBarChartProps) {
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1E2030",
      borderColor: "#2D3050",
      textStyle: { color: "#E2E8F0", fontSize: 12 },
      axisPointer: { type: "shadow" },
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: "#94A3B8", fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10,
    },
    grid: { left: 16, right: 16, top: 40, bottom: 0, containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((d) => d.month),
      axisLine: { lineStyle: { color: "#2D3050" } },
      axisTick: { show: false },
      axisLabel: { color: "#64748B", fontSize: 10, rotate: 30 },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#2D3050", type: "dashed" } },
      axisLabel: { color: "#64748B", fontSize: 11 },
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
