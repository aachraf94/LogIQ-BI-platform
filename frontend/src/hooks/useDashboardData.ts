"use client";

import { kpiData, monthlyDemandData, demandByCity, topRoutesByVolume, alerts } from "@/lib/mock-data";

export function useDashboardData() {
  return {
    kpis: kpiData,
    monthlyTrends: monthlyDemandData,
    demandByCity,
    topRoutes: topRoutesByVolume,
    recentAlerts: alerts.slice(0, 5),
    isLoading: false,
  };
}
