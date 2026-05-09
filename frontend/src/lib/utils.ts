import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDZD(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M DZD`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K DZD`;
  }
  return `${value.toLocaleString("fr-DZ")} DZD`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("fr-DZ");
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function trendColor(trend: number): string {
  return trend >= 0 ? "text-emerald-400" : "text-red-400";
}

export function trendIcon(trend: number): string {
  return trend >= 0 ? "↑" : "↓";
}
