"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";

interface AreaChartProps {
  data: { month: string; revenue: number; cost: number }[];
  height?: number;
}

export function AreaChart({ data, height = 320 }: AreaChartProps) {
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1E2030",
      borderColor: "#2D3050",
      textStyle: { color: "#E2E8F0", fontSize: 12 },
      formatter: (params: { marker: string; seriesName: string; value: number }[]) =>
        params
          .map((p) => `${p.marker} ${p.seriesName}: ${(p.value / 1_000_000).toFixed(2)}M DZD`)
          .join("<br/>"),
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
      data: data.map((d) => d.month),
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
        formatter: (v: number) => `${(v / 1_000_000).toFixed(1)}M`,
      },
    },
    series: [
      {
        name: "Revenue",
        type: "line",
        data: data.map((d) => d.revenue),
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: "#6366F1", width: 2.5 },
        itemStyle: { color: "#6366F1" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(99,102,241,0.3)" },
              { offset: 1, color: "rgba(99,102,241,0.02)" },
            ],
          },
        },
      },
      {
        name: "Cost",
        type: "line",
        data: data.map((d) => d.cost),
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: "#F59E0B", width: 2.5 },
        itemStyle: { color: "#F59E0B" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(245,158,11,0.2)" },
              { offset: 1, color: "rgba(245,158,11,0.01)" },
            ],
          },
        },
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
