export type DemandStatus = "accepted" | "rejected" | "pending";

export interface TransportDemand {
  id: string;
  client: string;
  origin: string;
  destination: string;
  date: string;
  cost: number;
  revenue: number;
  parcelCount: number;
  status: DemandStatus;
}

export interface MonthlyDemandData {
  month: string;
  accepted: number;
  rejected: number;
  pending: number;
  totalRevenue: number;
  totalCost: number;
  avgCostPerDemand: number;
}

export interface DemandByCity {
  city: string;
  value: number;
  revenue: number;
}

export interface HeatmapCell {
  city: string;
  day: string;
  volume: number;
}
