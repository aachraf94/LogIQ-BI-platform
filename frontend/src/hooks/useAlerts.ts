"use client";

import { useState } from "react";
import { alerts as initialAlerts } from "@/lib/mock-data";
import type { Alert } from "@/types/user";

export function useAlerts() {
  const [alertList, setAlertList] = useState<Alert[]>(initialAlerts);

  const resolveAlert = (id: string) => {
    setAlertList((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "resolved" as const, resolvedAt: new Date().toISOString() }
          : a
      )
    );
  };

  const activeCount = alertList.filter((a) => a.status === "active").length;
  const criticalCount = alertList.filter(
    (a) => a.severity === "critical" && a.status === "active"
  ).length;

  return { alerts: alertList, resolveAlert, activeCount, criticalCount };
}
