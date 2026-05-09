"use client";

import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import type { SankeyData } from "@/types/parcel";

interface SankeyChartProps {
  data: SankeyData;
  height?: number;
}

export function SankeyChart({ data, height = 380 }: SankeyChartProps) {
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "#1E2030",
      borderColor: "#2D3050",
      textStyle: { color: "#E2E8F0", fontSize: 12 },
      formatter: (p: { dataType: string; name: string; data: { source: string; target: string; value: number } }) => {
        if (p.dataType === "edge") {
          return `${p.data.source} → ${p.data.target}: ${p.data.value}%`;
        }
        return p.name;
      },
    },
    series: [
      {
        type: "sankey",
        data: data.nodes,
        links: data.links,
        emphasis: { focus: "adjacency" },
        nodeAlign: "left",
        lineStyle: {
          color: "gradient",
          curveness: 0.5,
          opacity: 0.3,
        },
        itemStyle: { borderRadius: 4 },
        label: { color: "#E2E8F0", fontSize: 11 },
        levels: [
          { depth: 0, itemStyle: { color: "#6366F1" } },
          { depth: 1, itemStyle: { color: "#22D3EE" } },
          { depth: 2, itemStyle: { color: "#10B981" } },
          { depth: 3, itemStyle: { color: "#F59E0B" } },
        ],
      },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <ReactECharts option={option} style={{ height }} notMerge />
    </motion.div>
  );
}
