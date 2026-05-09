"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";

interface GaugeChartProps {
  value: number;
  title?: string;
  height?: number;
}

export function GaugeChart({ value, title = "Profit Margin", height = 300 }: GaugeChartProps) {
  const option = {
    backgroundColor: "transparent",
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 40,
        splitNumber: 4,
        radius: "85%",
        center: ["50%", "60%"],
        axisLine: {
          lineStyle: {
            width: 18,
            color: [
              [0.375, "#EF4444"],
              [0.625, "#F59E0B"],
              [1, "#10B981"],
            ],
          },
        },
        pointer: {
          icon: "path://M12.8,0.7l12.3,42H0.5L12.8,0.7z",
          length: "12%",
          width: 20,
          offsetCenter: [0, "-60%"],
          itemStyle: { color: "auto" },
        },
        axisTick: { length: 8, lineStyle: { color: "auto", width: 2 } },
        splitLine: { length: 15, lineStyle: { color: "auto", width: 3 } },
        axisLabel: {
          color: "#94A3B8",
          fontSize: 12,
          distance: -50,
          formatter: (v: number) => `${v}%`,
        },
        title: {
          offsetCenter: [0, "30%"],
          fontSize: 13,
          color: "#94A3B8",
          fontWeight: "normal",
        },
        detail: {
          valueAnimation: true,
          fontSize: 32,
          fontWeight: "bold",
          offsetCenter: [0, "5%"],
          color: "#E2E8F0",
          formatter: "{value}%",
        },
        data: [{ value, name: title }],
      },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.4 }}
    >
      <ReactECharts option={option} style={{ height }} notMerge />
    </motion.div>
  );
}
