"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";

interface Series {
  name: string;
  data: number[];
  color: string;
}

interface LineChartProps {
  categories: string[];
  series: Series[];
  height?: number;
  yFormatter?: (v: number) => string;
}

export function LineChart({ categories, series, height = 300, yFormatter }: LineChartProps) {
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1E2030",
      borderColor: "#2D3050",
      textStyle: { color: "#E2E8F0", fontSize: 12 },
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: "#94A3B8", fontSize: 12 },
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: { left: 16, right: 16, top: 40, bottom: 0, containLabel: true },
    xAxis: {
      type: "category",
      data: categories,
      axisLine: { lineStyle: { color: "#2D3050" } },
      axisTick: { show: false },
      axisLabel: { color: "#64748B", fontSize: 11, rotate: 30 },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#2D3050", type: "dashed" } },
      axisLabel: {
        color: "#64748B",
        fontSize: 11,
        formatter: yFormatter ?? ((v: number) => String(v)),
      },
    },
    series: series.map((s) => ({
      name: s.name,
      type: "line",
      data: s.data,
      smooth: true,
      symbol: "circle",
      symbolSize: 5,
      lineStyle: { color: s.color, width: 2 },
      itemStyle: { color: s.color },
    })),
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
