"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Route } from "@/types/route";
import { ALGERIAN_CITIES } from "@/lib/mock-data";

interface RouteMapProps {
  routes: Route[];
  height?: number;
}

type LeafletMap = { remove: () => void };

export function RouteMap({ routes, height = 460 }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    let map: LeafletMap | null = null;
    let cancelled = false;

    import("leaflet").then((L) => {
      // Bail out if the effect was cleaned up while the import was in flight,
      // or if Leaflet already initialised this container (React Strict Mode double-invoke).
      if (cancelled || !mapRef.current) return;
      const container = mapRef.current as HTMLElement & { _leaflet_id?: number };
      if (container._leaflet_id) return;

      // Inject Leaflet CSS once
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const leafletMap = L.map(mapRef.current, {
        center: [28.0, 2.5],
        zoom: 5,
        zoomControl: true,
        attributionControl: false,
      });

      map = leafletMap;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(leafletMap);

      // Route polylines — colour by efficiency score
      routes.forEach((route) => {
        const src = ALGERIAN_CITIES[route.origin];
        const tgt = ALGERIAN_CITIES[route.destination];
        if (!src || !tgt) return;

        const color =
          route.efficiencyScore >= 90
            ? "#10B981"
            : route.efficiencyScore >= 80
            ? "#F59E0B"
            : "#EF4444";

        const polyline = L.polyline(
          [[src.lat, src.lng], [tgt.lat, tgt.lng]],
          { color, weight: Math.max(2, route.volume / 500), opacity: 0.8 }
        ).addTo(leafletMap);

        polyline.bindPopup(
          `<div style="color:#E2E8F0;background:#1E2030;padding:8px;border-radius:8px;min-width:180px;font-family:Inter,sans-serif">
            <b style="color:#6366F1">${route.origin} → ${route.destination}</b><br/>
            Volume: <b>${route.volume.toLocaleString()}</b> parcels<br/>
            Cost: <b>${route.actualCost.toLocaleString()} DZD</b><br/>
            Efficiency: <b style="color:${color}">${route.efficiencyScore}%</b>
          </div>`
        );
      });

      // City circle markers
      Object.entries(ALGERIAN_CITIES).forEach(([city, coords]) => {
        const marker = L.circleMarker([coords.lat, coords.lng], {
          radius: 8,
          fillColor: "#6366F1",
          color: "#22D3EE",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        }).addTo(leafletMap);

        marker.bindTooltip(city, { permanent: false, direction: "top" });
      });
    });

    return () => {
      cancelled = true;
      if (map) {
        map.remove();
        map = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-xl overflow-hidden border border-[#2D3050]"
      style={{ height }}
    >
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
    </motion.div>
  );
}
