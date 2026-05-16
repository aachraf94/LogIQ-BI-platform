-- =============================================================================
-- AGGREGATE: agg_demande_transport
-- Grain   : One row per (year, month, wilaya_depart, wilaya_arrivee, service_type, client_type)
-- Source  : fact_transport + dim_date + dim_wilaya (depart + arrivee) + dim_vehicle_type
-- Purpose : Origin-destination demand matrix for transport requests
--           Axis 1 (Must have) — Analysis of expressed demand:
--             - Which corridors generate the most requests?
--             - How does demand evolve seasonally?
--             - Which service types dominate each corridor?
--             - What is the cost structure per corridor?
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS warehouse.agg_demande_transport AS
SELECT
    -- Time
    d.year,
    d.month_num,
    d.month_name_fr,
    d.year_month,
    d.quarter,
    d.is_ramadan,

    -- Origin geography
    wd.wilaya_id                        AS wilaya_depart_id,
    wd.wilaya_name                      AS wilaya_depart_name,
    wd.region                           AS region_depart,

    -- Destination geography
    wa.wilaya_id                        AS wilaya_arrivee_id,
    wa.wilaya_name                      AS wilaya_arrivee_name,
    wa.region                           AS region_arrivee,

    -- Is it an inter-region or intra-region corridor?
    (wd.region = wa.region)             AS meme_region,

    -- Service segmentation
    ft.service_type,
    ft.client_type,

    -- Vehicle type segmentation
    vt.vehicle_type,
    vt.payload_class,

    -- Demand volume KPIs
    COUNT(*)                            AS nbr_requests,
    COUNT(*) FILTER (WHERE ft.status = 'terminée')  AS nbr_terminees,
    COUNT(*) FILTER (WHERE ft.status = 'annulée')   AS nbr_annulees,
    COUNT(*) FILTER (WHERE ft.client_type = 'conventionné') AS nbr_conventionnes,
    COUNT(*) FILTER (WHERE ft.client_type = 'divers')       AS nbr_divers,

    -- Cargo demand
    SUM(ft.total_weight_kg)             AS total_poids_kg,
    AVG(ft.total_weight_kg)             AS avg_poids_kg,
    SUM(ft.nbr_pieces)                  AS total_pieces,
    AVG(ft.nbr_pieces)                  AS avg_pieces,

    -- Distance (corridor characteristic)
    AVG(ft.distance_unit_km)            AS avg_distance_unite_km,
    AVG(ft.distance_real_km)            AS avg_distance_reelle_km,
    MIN(ft.distance_real_km)            AS min_distance_reelle_km,
    MAX(ft.distance_real_km)            AS max_distance_reelle_km,

    -- Cost KPIs per corridor — Axis 1: pricing support
    SUM(ft.total_cost)                  AS total_cout_dzd,
    AVG(ft.total_cost)                  AS avg_cout_dzd,
    SUM(ft.amount_invoiced)             AS total_facture_dzd,
    AVG(ft.amount_invoiced)             AS avg_facture_dzd,
    SUM(ft.amount_invoiced - ft.total_cost) AS total_marge_brute_dzd,
    ROUND(
        100.0 * SUM(ft.amount_invoiced - ft.total_cost)
        / NULLIF(SUM(ft.amount_invoiced), 0), 2
    )                                   AS taux_marge_corridor_pct,

    -- Unit cost on corridor
    ROUND(AVG(ft.total_cost / NULLIF(ft.distance_real_km, 0)), 2) AS avg_cout_par_km_dzd,

    NOW()                               AS refreshed_at

FROM warehouse.fact_transport ft
JOIN warehouse.dim_date         d   ON ft.date_creation_key  = d.date_key
JOIN warehouse.dim_wilaya       wd  ON ft.wilaya_depart_key  = wd.wilaya_key
JOIN warehouse.dim_wilaya       wa  ON ft.wilaya_arrivee_key = wa.wilaya_key
JOIN warehouse.dim_vehicle_type vt  ON ft.vehicle_type_key   = vt.vehicle_type_key

GROUP BY
    d.year, d.month_num, d.month_name_fr, d.year_month, d.quarter, d.is_ramadan,
    wd.wilaya_id, wd.wilaya_name, wd.region,
    wa.wilaya_id, wa.wilaya_name, wa.region,
    ft.service_type, ft.client_type,
    vt.vehicle_type, vt.payload_class

WITH DATA;

COMMENT ON MATERIALIZED VIEW warehouse.agg_demande_transport IS
    'Origin-destination demand matrix for transport requests. Monthly grain. Covers corridor analysis, seasonal demand patterns, and cost/margin per corridor. Axis 1 — Must have.';

-- Unique index covers all GROUP BY columns that determine uniqueness.
-- COALESCE handles NULL agence (private garage dispatch) without breaking CONCURRENTLY refresh.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_dt_unique
    ON warehouse.agg_demande_transport
    (year, month_num, wilaya_depart_id, wilaya_arrivee_id, service_type, client_type, vehicle_type);

CREATE INDEX IF NOT EXISTS idx_agg_dt_year_month    ON warehouse.agg_demande_transport (year, month_num);
CREATE INDEX IF NOT EXISTS idx_agg_dt_depart        ON warehouse.agg_demande_transport (wilaya_depart_id);
CREATE INDEX IF NOT EXISTS idx_agg_dt_arrivee       ON warehouse.agg_demande_transport (wilaya_arrivee_id);
CREATE INDEX IF NOT EXISTS idx_agg_dt_service       ON warehouse.agg_demande_transport (service_type);
CREATE INDEX IF NOT EXISTS idx_agg_dt_client_type   ON warehouse.agg_demande_transport (client_type);
CREATE INDEX IF NOT EXISTS idx_agg_dt_region_depart ON warehouse.agg_demande_transport (region_depart);
