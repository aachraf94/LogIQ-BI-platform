// ─── Legacy types (mock-data transport page) ──────────────────────────────────

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

// ─── API response types ───────────────────────────────────────────────────────

export interface TransportSummary {
  current: {
    total_requests: number;
    total_terminees: number;
    total_annulees: number;
    total_en_cours: number;
    total_revenue: number;
    total_marge: number;
    total_km: number;
    total_cost: number;
    total_poids_kg: number;
    total_payes: number;
    avg_ponctualite_pct: number;
    avg_note_client: number;
    avg_retard_arrivee_min: number;
  };
  derived: {
    completion_rate: number;
    gross_margin_pct: number;
    cancellation_rate: number;
    cost_per_km: number;
    collection_rate: number;
    mom_requests: number;
    mom_revenue: number;
    mom_margin: number;
    mom_on_time: number;
    mom_completion_rate: number;
    mom_cancellation_rate: number;
  };
}

export interface TransportTrendPoint {
  year_month: string;
  year: number;
  month_num: number;
  month_name_fr: string;
  nbr_requests: number;
  nbr_terminees: number;
  nbr_annulees: number;
  total_revenue: number;
  total_cost: number;
  total_marge: number;
  total_km: number;
  taux_marge_pct: number;
  cout_par_km: number;
  taux_ponctualite_pct: number;
}

export interface TransportCostBreakdown {
  total_cost: number;
  cout_base: number;
  cout_distance_supp: number;
  cout_assurance: number;
  cout_carburant: number;
  cout_manutention: number;
  cout_autres: number;
}

export interface TransportServiceData {
  service_type: string;
  sub_service_type: string;
  nbr_requests: number;
  nbr_terminees: number;
  total_revenue: number;
  total_marge: number;
  total_cost: number;
  taux_marge_pct: number;
  taux_ponctualite_pct: number;
  avg_note_client: number;
}

export interface TransportVehicleData {
  vehicle_type: string;
  payload_class: string;
  nbr_requests: number;
  total_km: number;
  total_cost: number;
  cout_par_km: number;
  taux_ponctualite_pct: number;
  avg_note_client: number;
}

export interface TransportCorridor {
  wilaya_depart_name: string;
  wilaya_arrivee_name: string;
  region_depart: string;
  region_arrivee: string;
  meme_region: boolean;
  nbr_requests: number;
  nbr_terminees: number;
  total_cost: number;
  total_revenue: number;
  total_marge: number;
  taux_marge_pct: number;
  avg_distance_km: number;
  cout_par_km: number;
}

export interface ODMatrixCell {
  origin: string;
  destination: string;
  nbr_requests: number;
  taux_marge_pct: number;
}

export interface TransportAgencyData {
  agence_id: number;
  agence_name: string;
  wilaya_dispatch_name: string;
  region: string;
  nbr_requests: number;
  nbr_terminees: number;
  total_revenue: number;
  total_marge: number;
  total_km: number;
  total_cost: number;
  completion_rate: number;
  taux_ponctualite_pct: number;
  avg_note_client: number;
  taux_marge_pct: number;
  cout_par_km: number;
}

export interface DelayBucket {
  bucket: string;
  count: number;
}
