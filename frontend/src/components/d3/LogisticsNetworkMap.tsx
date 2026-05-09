"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { motion } from "framer-motion";
import type { NetworkNode, NetworkLink } from "@/types/route";

interface LogisticsNetworkMapProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  height?: number;
}

// Algeria approximate bounding box for projection
// lat: 18.97 to 37.09, lng: -8.67 to 11.98
const ALG_CENTER: [number, number] = [2.63, 28.03];

export function LogisticsNetworkMap({ nodes, links, height = 480 }: LogisticsNetworkMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const rect = el.parentElement?.getBoundingClientRect();
    const W = rect?.width ?? 800;
    const H = height;

    d3.select(el).selectAll("*").remove();

    const svg = d3
      .select(el)
      .attr("width", W)
      .attr("height", H)
      .attr("viewBox", `0 0 ${W} ${H}`);

    // Background subtle grid
    const defs = svg.append("defs");
    const pattern = defs
      .append("pattern")
      .attr("id", "grid")
      .attr("width", 40)
      .attr("height", 40)
      .attr("patternUnits", "userSpaceOnUse");
    pattern.append("path").attr("d", "M 40 0 L 0 0 0 40").attr("fill", "none").attr("stroke", "#2D3050").attr("stroke-width", 0.5);

    svg.append("rect").attr("width", W).attr("height", H).attr("fill", "url(#grid)").attr("opacity", 0.4);

    // Gradient for links
    links.forEach((link, i) => {
      const grad = defs
        .append("linearGradient")
        .attr("id", `link-grad-${i}`)
        .attr("gradientUnits", "userSpaceOnUse");
      grad.append("stop").attr("offset", "0%").attr("stop-color", "#6366F1").attr("stop-opacity", 0.8);
      grad.append("stop").attr("offset", "100%").attr("stop-color", "#22D3EE").attr("stop-opacity", 0.8);
    });

    // Projection — use a simple linear map from lat/lng to SVG coords
    const lats = nodes.map((n) => n.lat);
    const lngs = nodes.map((n) => n.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

    const PAD = 60;
    const xScale = d3.scaleLinear().domain([minLng - 0.5, maxLng + 0.5]).range([PAD, W - PAD]);
    const yScale = d3.scaleLinear().domain([minLat - 0.5, maxLat + 0.5]).range([H - PAD, PAD]);

    const pos = (node: NetworkNode) => ({
      x: xScale(node.lng),
      y: yScale(node.lat),
    });

    const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

    // Volume scales
    const maxVol = Math.max(...links.map((l) => l.volume));
    const linkWidthScale = d3.scaleLinear().domain([0, maxVol]).range([1, 6]);
    const nodeRadiusScale = d3.scaleLinear()
      .domain([0, Math.max(...nodes.map((n) => n.volume))])
      .range([8, 22]);

    // ── Draw links ────────────────────────────────────────────────────────
    const linkGroup = svg.append("g").attr("class", "links");

    const linkEls = linkGroup
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("x1", (d) => pos(nodeById[d.source]).x)
      .attr("y1", (d) => pos(nodeById[d.source]).y)
      .attr("x2", (d) => pos(nodeById[d.target]).x)
      .attr("y2", (d) => pos(nodeById[d.target]).y)
      .attr("stroke", (_, i) => `url(#link-grad-${i})`)
      .attr("stroke-width", (d) => linkWidthScale(d.volume))
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.55);

    // ── Animated dots moving along links ──────────────────────────────────
    interface DotDatum {
      link: NetworkLink;
      progress: number;
      speed: number;
      size: number;
    }

    const dots: DotDatum[] = [];
    links.forEach((link) => {
      const count = Math.ceil(link.volume / 400);
      for (let i = 0; i < count; i++) {
        dots.push({
          link,
          progress: Math.random(),
          speed: 0.0008 + Math.random() * 0.0012,
          size: 3 + Math.random() * 3,
        });
      }
    });

    const dotEls = svg
      .append("g")
      .attr("class", "dots")
      .selectAll("circle")
      .data(dots)
      .enter()
      .append("circle")
      .attr("r", (d) => d.size)
      .attr("fill", "#22D3EE")
      .attr("opacity", 0.85)
      .attr("filter", "url(#glow)");

    // Glow filter for dots
    const glow = defs.append("filter").attr("id", "glow");
    glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
    const feMerge = glow.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // ── Draw nodes ────────────────────────────────────────────────────────
    const nodeGroup = svg.append("g").attr("class", "nodes");

    const nodeEls = nodeGroup
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${pos(d).x},${pos(d).y})`)
      .style("cursor", "pointer");

    // Outer glow ring
    nodeEls
      .append("circle")
      .attr("r", (d) => nodeRadiusScale(d.volume) + 6)
      .attr("fill", "none")
      .attr("stroke", "#6366F1")
      .attr("stroke-width", 1)
      .attr("opacity", 0.25);

    // Main node circle
    nodeEls
      .append("circle")
      .attr("r", (d) => nodeRadiusScale(d.volume))
      .attr("fill", "#252840")
      .attr("stroke", "#6366F1")
      .attr("stroke-width", 2)
      .attr("filter", "url(#glow)");

    // Volume indicator
    nodeEls
      .append("circle")
      .attr("r", (d) => nodeRadiusScale(d.volume) * 0.45)
      .attr("fill", "#6366F1")
      .attr("opacity", 0.8);

    // City labels
    nodeEls
      .append("text")
      .text((d) => d.city)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => nodeRadiusScale(d.volume) + 16)
      .attr("font-size", 11)
      .attr("font-family", "Inter, sans-serif")
      .attr("font-weight", "600")
      .attr("fill", "#E2E8F0");

    // Tooltip on hover
    nodeEls
      .on("mouseenter", function (event, d) {
        d3.select(this).select("circle:nth-child(2)").attr("stroke", "#22D3EE").attr("stroke-width", 3);

        svg
          .append("text")
          .attr("id", "tooltip-text")
          .attr("x", pos(d).x)
          .attr("y", pos(d).y - nodeRadiusScale(d.volume) - 10)
          .attr("text-anchor", "middle")
          .attr("font-size", 12)
          .attr("font-family", "Inter, sans-serif")
          .attr("fill", "#22D3EE")
          .text(`${d.city}: ${d.volume.toLocaleString()} demands`);
      })
      .on("mouseleave", function () {
        d3.select(this).select("circle:nth-child(2)").attr("stroke", "#6366F1").attr("stroke-width", 2);
        svg.select("#tooltip-text").remove();
      });

    // ── Animation loop ────────────────────────────────────────────────────
    function animate() {
      dots.forEach((dot) => {
        dot.progress += dot.speed;
        if (dot.progress > 1) dot.progress = 0;
      });

      dotEls.attr("cx", (d) => {
        const src = pos(nodeById[d.link.source]);
        const tgt = pos(nodeById[d.link.target]);
        return src.x + (tgt.x - src.x) * d.progress;
      }).attr("cy", (d) => {
        const src = pos(nodeById[d.link.source]);
        const tgt = pos(nodeById[d.link.target]);
        return src.y + (tgt.y - src.y) * d.progress;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);

    // Fade in links
    linkEls.attr("opacity", 0).transition().duration(1000).attr("opacity", 0.55);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [nodes, links, height]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.5 }}
      className="w-full rounded-xl overflow-hidden bg-[#161829]"
    >
      <svg ref={svgRef} className="w-full" style={{ height }} />
    </motion.div>
  );
}
