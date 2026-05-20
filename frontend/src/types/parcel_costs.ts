export interface ParcelCostsSummaryData {
  current: {
    nbr_colis: number
    nbr_livres: number
    nbr_retours: number
    nbr_echecs: number
    total_fees: number
    fees_livres: number
    avg_duree_min: number
  }
  pcc: {
    nbr_avec_tarif: number
    nbr_sous_tarif: number
    nbr_sur_tarif: number
    total_fees_pcc: number
    total_tarif_theorique: number
    total_ecart: number
    avg_ecart: number
  }
  costs: {
    cout_total: number
    total_depenses: number
    total_salaires: number
    total_freelance: number
    nbr_employes: number
    nbr_freelance: number
  }
  derived: {
    taux_livraison_pct: number
    taux_retour_pct: number
    taux_sous_tarif_pct: number
    avg_fee_par_colis: number
    cout_par_colis_livre: number
    mom_colis: number
    mom_fees: number
    mom_livraison: number
    mom_compliance: number
  }
}

export interface ParcelCostsTrendPoint {
  year_month: string
  year: number
  month_num: number
  month_name_fr: string
  nbr_colis: number
  nbr_livres: number
  nbr_retours: number
  total_fees: number
  taux_livraison_pct: number
  taux_retour_pct: number
  avg_duree_min: number
  nbr_sous_tarif: number
  total_ecart_dzd: number
  taux_sous_tarif_pct: number
  cout_total: number
  total_depenses: number
  total_freelance: number
  cout_par_colis_livre: number
}

export interface ParcelPCCSummary {
  nbr_colis: number
  nbr_avec_tarif: number
  nbr_sous_tarif: number
  nbr_sur_tarif: number
  nbr_au_tarif: number
  total_fees: number
  total_tarif_theorique: number
  total_ecart_dzd: number
  avg_ecart_dzd: number
  avg_ecart_absolu_dzd: number
  taux_sous_tarif_pct: number
  taux_ecart_global_pct: number
}

export interface ParcelPCCAgency {
  agence_id: number
  agence_name: string
  wilaya_name: string
  region: string
  nbr_colis_total: number
  nbr_avec_tarif: number
  nbr_sous_tarif: number
  nbr_sur_tarif: number
  total_fees: number
  total_tarif_theorique: number
  total_ecart_dzd: number
  taux_sous_tarif_pct: number
  avg_ecart_dzd: number
}

export interface EcartBucketItem {
  bucket: string
  bucket_order: number
  nbr_colis: number
  sum_ecart_dzd: number
}

export interface PCCByWilayaItem {
  wilaya_name: string
  region: string
  nbr_colis: number
  nbr_avec_tarif: number
  nbr_sous_tarif: number
  sum_ecart_dzd: number
  avg_ecart_dzd: number
  taux_sous_tarif_pct: number
}

export interface CostStructureData {
  cout_total: number
  total_depenses: number
  total_salaires: number
  total_freelance: number
  nbr_depenses: number
  nbr_employes_payes: number
  nbr_livreurs_freelance: number
  nbr_colis_livres_freelance: number
  total_sinistres: number
  nbr_sinistres: number
  cout_total_avec_sinistres: number
}

export interface CostByNatureItem {
  category_group: string
  nature_name: string
  total_dzd: number
  nbr_depenses: number
  avg_depense_dzd: number
}

export interface ParcelAgencyData {
  agence_id: number
  agence_name: string
  wilaya_name: string
  region: string
  nbr_colis: number
  nbr_livres: number
  nbr_retours: number
  total_fees: number
  taux_livraison: number
  taux_retour: number
  avg_duree_min: number
  nbr_sous_tarif: number
  total_ecart_dzd: number
  taux_sous_tarif_pct: number
  cout_total: number
  cout_par_colis_livre: number
}

export interface ParcelDeliveryTypeData {
  delivery_type: string
  nbr_colis: number
  nbr_livres: number
  nbr_retours: number
  total_fees: number
  avg_fee_dzd: number
  taux_livraison_pct: number
  taux_retour_pct: number
  avg_duree_livree_min: number
}

export interface DailyVolumePoint {
  full_date: string
  day_of_week: string
  is_weekend: boolean
  is_friday: boolean
  nbr_colis: number
  nbr_livres: number
  nbr_retours: number
  nbr_echecs: number
  total_fees: number
  taux_livraison_pct: number
}

export interface DurationBucket {
  bucket: string
  bucket_order: number
  nbr_colis: number
}

export interface SinistresData {
  summary: {
    nbr_sinistres: number
    sum_declared_dzd: number
    sum_rembourse_dzd: number
    taux_couverture_pct: number
    avg_rembourse_dzd: number
  }
  by_type: {
    sinistre_type: string
    nbr_sinistres: number
    sum_declared_dzd: number
    sum_rembourse_dzd: number
    taux_couverture_pct: number
  }[]
  by_agency: {
    agence_id: number
    agence_nom: string
    wilaya_name: string
    nbr_sinistres: number
    sum_declared_dzd: number
    sum_rembourse_dzd: number
  }[]
}

export interface FreelanceEfficiencyItem {
  agence_id: number
  agence_nom: string
  wilaya_name: string
  nbr_livreurs: number
  nbr_colis_livres: number
  nbr_colis_echoues: number
  total_paiements_dzd: number
  cout_par_colis_livre: number
  taux_succes_freelance_pct: number
}

export interface ParcelRow {
  tracking: string
  date_creation: string
  agence_id: number
  agence_nom: string
  wilaya_destination: string
  delivery_type: string
  statut_actuel: string
  delivery_fee: number
  tarif_theorique: number | null
  ecart_tarif_dzd: number | null
  duree_livraison_minutes: number | null
  nbr_evenements: number
}

export interface ParcelsPaginatedResponse {
  results: ParcelRow[]
  count: number
  page: number
  pages: number
}
