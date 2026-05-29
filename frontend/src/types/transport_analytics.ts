// ─── Filter params ─────────────────────────────────────────────────────────────

export interface TransportAnalyticsFilters {
  start_date: string
  end_date: string
  service_type?: string
}

// ─── Operations ────────────────────────────────────────────────────────────────

export interface TransportOpsKpis {
  nbr_requests: number
  completion_rate_pct: number
  cancellation_rate_pct: number
  avg_distance_km: number
  avg_stops: number
  pop_requests: number
  pop_completion_rate: number
  pop_cancellation_rate: number
  pop_distance: number
  pop_stops: number
}

export interface TransportMonthlyTrendPoint {
  period: string          // YYYY-MM
  nbr_requests: number
  nbr_terminees: number
  nbr_en_cours: number
  nbr_annulees: number
}

export interface TransportServiceBreakdownItem {
  service_type: string    // course_dediee | courrier | manutention
  nbr_requests: number
  completion_rate_pct: number
}

export interface TransportODItem {
  origin: string
  destination: string
  nbr_requests: number
}

export interface TransportDistanceCategoryItem {
  distance_category: string   // local | regional | national
  km_range: string
  nbr_requests: number
}

// ─── Cost & Profitability ──────────────────────────────────────────────────────

export interface TransportCostKpis {
  total_revenue: number
  total_cost: number
  marge_brute_dzd: number
  marge_brute_pct: number
  cout_par_km: number
  pop_revenue: number
  pop_cost: number
  pop_margin_dzd: number
  pop_margin_pct: number
  pop_cout_par_km: number
}

export interface TransportRevCostTrendPoint {
  period: string
  total_revenue: number
  total_cost: number
  marge_brute_dzd: number
  marge_brute_pct: number
}

export interface TransportCostCategoryItem {
  category: string
  label: string
  total_dzd: number
}

export interface TransportCostPerKmItem {
  vehicle_type: string
  total_cost: number
  total_km: number
  cout_par_km: number
  nbr_requests: number
}

export interface TransportCorridorItem {
  corridor: string       // "Alger → Oran"
  nbr_requests: number
  taux_marge_pct: number
  total_revenue: number
}

// ─── Performance ──────────────────────────────────────────────────────────────

export interface TransportPerfKpis {
  on_time_rate_pct: number
  avg_duration_h: number
  avg_client_rating: number
  avg_arrival_delay_min: number
  night_shift_rate_pct: number
  pop_on_time: number
  pop_duration: number
  pop_rating: number
  pop_delay: number
  pop_night_shift: number
}

export interface TransportOnTimeTrendPoint {
  period: string
  on_time_rate_pct: number
  avg_duration_h: number
}

export interface TransportDelayBucketItem {
  bucket: string
  bucket_order: number
  nbr_requests: number
}

export interface TransportRatingBucketItem {
  rating: number       // 1–5
  nbr_requests: number
}

export interface TransportVehiclePerfItem {
  vehicle_type: string
  on_time_rate_pct: number
  avg_duration_h: number
  nbr_requests: number
}
