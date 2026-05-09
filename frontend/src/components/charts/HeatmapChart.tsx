"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import type { HeatmapCell } from "@/types/transport";

interface HeatmapChartProps {
  data: HeatmapCell[];
  height?: number;
}

export function HeatmapChart({ data, height = 340 }: HeatmapChartProps) {
  const cities = Array.from(new Set(data.map((d) => d.city)));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const maxVol = Math.max(...data.map((d) => d.volume));

  const chartData = data.map((d) => [
    days.indexOf(d.day),
    cities.indexOf(d.city),
    d.volume,
  ]);

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      position: "top",
      backgroundColor: "#1E2030",
      borderColor: "#2D3050",
      textStyle: { color: "#E2E8F0", fontSize: 12 },
      formatter: (p: { data: number[] }) =>
        `${cities[p.data[1]]} / ${days[p.data[0]]}: ${p.data[2]} demands`,
    },
    grid: { left: 80, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: "category",
      data: days,
      splitArea: { show: true, areaStyle: { color: ["transparent"] } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#64748B", fontSize: 11 },
    },
    yAxis: {
      type: "category",
      data: cities,
      splitArea: { show: true, areaStyle: { color: ["transparent"] } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#94A3B8", fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max: maxVol,
      calculable: true,
      orient: "horizontal",
      show: false,
      inRange: {
        color: ["#1E2030", "#6366F1"],
      },
    },
    series: [
      {
        type: "heatmap",
        data: chartData,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(99,102,241,0.5)" },
        },
        itemStyle: { borderRadius: 4, borderColor: "#161829", borderWidth: 2 },
      },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <ReactECharts option={option} style={{ height }} notMerge />
    </motion.div>
  );
}
