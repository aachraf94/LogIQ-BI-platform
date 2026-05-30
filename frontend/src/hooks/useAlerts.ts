"use client";

import { useState, useEffect, useCallback } from "react";
import { alertsApi } from "@/lib/api";
import type { Alert } from "@/types/api";

export function useAlerts() {
  const [alertList, setAlertList] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAlertList(await alertsApi.list());
    } catch {
      // silently degrade
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const acknowledgeAlert = async (id: number, note = "") => {
    await alertsApi.acknowledge(id, note);
    setAlertList((prev) =>
      prev.map((a) => a.id === id ? { ...a, is_acknowledged: true } : a)
    );
  };

  const activeCount = alertList.filter((a) => !a.is_acknowledged).length;
  const criticalCount = alertList.filter(
    (a) => a.severity === "critical" && !a.is_acknowledged
  ).length;

  return { alerts: alertList, loading, acknowledgeAlert, activeCount, criticalCount, reload: load };
}
