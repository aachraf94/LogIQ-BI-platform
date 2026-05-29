// ─── Filter params ────────────────────────────────────────────────────────────

export interface ParcelDeliveryFilters {
  start_date: string   // YYYY-MM-DD
  end_date: string     // YYYY-MM-DD
  delivery_type?: string
}

// ─── Operations ───────────────────────────────────────────────────────────────

export interface ParcelOpsKpis {
  nbr_colis: number
  nbr_livres: number
  nbr_retours: number
  nbr_echecs: number
  nbr_en_transit: number
  avg_duree_livraison_h: number
  taux_livraison_pct: number
  taux_retour_pct: number
  pop_colis: number        // period-over-period % change
  pop_livraison: number
  pop_retour: number
  pop_echecs: number
  pop_en_transit: number
  pop_duree: number
}

export interface ParcelTrendPoint {
  date: string       // YYYY-MM-DD (daily) or YYYY-WXX (weekly)
  nbr_livres: number
  nbr_retours: number
  nbr_echecs: number
  nbr_en_transit: number
}

export interface ParcelRegionFlowItem {
  origin: string
  destination: string
  nbr_colis: number
}

export interface ParcelStatusItem {
  status_name: string
  nbr_colis: number
}

export interface ParcelZoneItem {
  zone_num: number
  fee_range: string
  nbr_colis: number
  nbr_livres: number
  taux_livraison_pct: number
}

export interface ParcelDeliveryTypeKpis {
  delivery_type: string     // "HD" | "SD"
  nbr_colis: number
  nbr_livres: number
  nbr_retours: number
  taux_livraison_pct: number
  taux_retour_pct: number
  avg_fee_dzd: number
  avg_duree_livree_h: number
}

// ─── Cost & Profitability ─────────────────────────────────────────────────────

export interface ParcelCostKpis {
  total_fees: number
  cout_total: number
  marge_brute: number
  marge_pct: number
  avg_fee_par_colis: number
  cout_par_colis_livre: number
  pop_fees: number
  pop_cout: number
  pop_marge: number
  pop_avg_fee: number
  pop_cout_par_livre: number
}

export interface ParcelRevenueCostPoint {
  period: string     // YYYY-MM
  total_fees: number
  cout_total: number
  marge_brute: number
}

export interface ParcelCostStructure {
  total_salaires: number
  total_depenses: number
  total_freelance: number
  total_sinistres: number
}

export interface ParcelCostNatureItem {
  nature_name: string
  total_dzd: number
}

export interface ParcelEcartBucket {
  bucket: string
  bucket_order: number
  nbr_colis: number
  sum_ecart_dzd: number
}

// ─── Performance ──────────────────────────────────────────────────────────────

export interface ParcelPerfKpis {
  taux_livraison_pct: number
  taux_sous_tarif_pct: number
  taux_compliance_pct: number
  avg_duree_livraison_h: number
  nbr_sinistres: number
  pop_livraison: number
  pop_sous_tarif: number
  pop_compliance: number
  pop_duree: number
  pop_sinistres: number
}

export interface ParcelPerfTrendPoint {
  period: string   // YYYY-MM
  taux_livraison_pct: number
  taux_sous_tarif_pct: number
}

export interface ParcelDurationBucket {
  bucket: string
  bucket_order: number
  nbr_colis: number
}

export interface ParcelAgencyPCC {
  agence_name: string
  taux_sous_tarif_pct: number
  nbr_colis: number
}

export interface ParcelClaimsType {
  sinistre_type: string
  nbr_sinistres: number
}
