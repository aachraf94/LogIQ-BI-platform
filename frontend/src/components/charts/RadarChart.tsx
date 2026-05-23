"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { useChartTheme } from "@/lib/chartTheme";

interface RadarChartProps {
  indicators: { name: string; max: number }[];
  data: number[];
  label?: string;
  height?: number;
}

export function RadarChart({ indicators, data, label = "Route", height = 340 }: RadarChartProps) {
  const t = useChartTheme()

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      backgroundColor: t.tooltipBg,
      borderColor: t.borderColor,
      textStyle: { color: t.textColor, fontSize: 12 },
    },
    radar: {
      indicator: indicators,
      radius: "65%",
      axisName: { color: t.legendColor, fontSize: 11 },
      splitLine: { lineStyle: { color: t.splitColor } },
      splitArea: { areaStyle: { color: ["rgba(99,102,241,0.03)", "transparent"] } },
      axisLine: { lineStyle: { color: t.axisColor } },
    },
    series: [
      {
        name: label,
        type: "radar",
        data: [{ value: data, name: label }],
        lineStyle: { color: "#6366F1", width: 2 },
        itemStyle: { color: "#6366F1" },
        areaStyle: { color: "rgba(99,102,241,0.2)" },
        symbol: "circle",
        symbolSize: 5,
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
