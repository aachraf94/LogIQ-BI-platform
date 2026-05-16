-- =============================================================================
-- AGGREGATE: agg_transport_mensuel
-- Grain   : One row per (year, month, agence_dispatch, service_type)
-- Source  : fact_transport + dim_date + dim_agence + dim_wilaya + dim_vehicle_type
-- Purpose : Monthly dedicated transport volume, cost, and performance KPIs
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS warehouse.agg_transport_mensuel AS
SELECT
    -- Time
    d.year,
    d.month_num,
    d.month_name_fr,
    d.year_month,
    d.quarter,

    -- Dispatch agency (origin of vehicle)
    a.agence_id,
    a.name                              AS agence_name,
    w.wilaya_id                         AS wilaya_dispatch_id,
    w.wilaya_name                       AS wilaya_dispatch_name,
    w.region,

    -- Company (from dispatch agency)
    c.company_id,
    c.license_name                      AS company_name,

    -- Service segmentation
    ft.service_type,                    -- course_dediee, courrier, manutention
    ft.sub_service_type,

    -- Vehicle type
    vt.vehicle_type,
    vt.payload_class,

    -- Volume KPIs
    COUNT(*)                            AS nbr_requests,
    COUNT(*) FILTER (WHERE ft.status = 'terminée')  AS nbr_terminees,
    COUNT(*) FILTER (WHERE ft.status = 'annulée')   AS nbr_annulees,
    COUNT(*) FILTER (WHERE ft.status = 'en_cours')  AS nbr_en_cours,

    -- Distance and cargo KPIs
    SUM(ft.distance_real_km)            AS total_km,
    AVG(ft.distance_real_km)            AS avg_km_par_request,
    SUM(ft.total_weight_kg)             AS total_poids_kg,
    AVG(ft.total_weight_kg)             AS avg_poids_kg,
    SUM(ft.nbr_pieces)                  AS total_pieces,

    -- Duration KPIs
    AVG(ft.total_duration_minutes)      AS avg_duree_minutes,
    SUM(ft.total_waiting_time_minutes)  AS total_attente_minutes,

    -- Cost KPIs (DZD)
    SUM(ft.total_cost)                  AS total_cout_dzd,
    AVG(ft.total_cost)                  AS avg_cout_dzd,
    SUM(ft.cout_base)                   AS total_cout_base_dzd,
    SUM(ft.cout_distance_supp)          AS total_cout_distance_supp_dzd,
    SUM(ft.cout_assurance)              AS total_cout_assurance_dzd,
    SUM(ft.cout_carburant)              AS total_cout_carburant_dzd,
    SUM(ft.cout_manutention)            AS total_cout_manutention_dzd,

    -- Billing KPIs (DZD)
    SUM(ft.amount_invoiced)             AS total_facture_dzd,
    SUM(ft.amount_paid)                 AS total_paye_dzd,
    COUNT(*) FILTER (WHERE ft.payment_status = 'payé')      AS nbr_payes,
    COUNT(*) FILTER (WHERE ft.payment_status = 'en_attente') AS nbr_en_attente_paiement,

    -- Profitability KPIs — Axis 1: pricing support (Must have)
    SUM(ft.amount_invoiced - ft.total_cost)     AS total_marge_brute_dzd,
    AVG(ft.amount_invoiced - ft.total_cost)     AS avg_marge_brute_dzd,
    ROUND(
        100.0 * SUM(ft.amount_invoiced - ft.total_cost)
        / NULLIF(SUM(ft.amount_invoiced), 0), 2
    )                                           AS taux_marge_pct,

    -- Unit cost KPIs — pricing support
    ROUND(SUM(ft.total_cost) / NULLIF(SUM(ft.distance_real_km), 0), 2) AS cout_par_km_dzd,
    ROUND(SUM(ft.total_cost) / NULLIF(SUM(ft.total_weight_kg), 0), 2)  AS cout_par_kg_dzd,
    ROUND(SUM(ft.total_cost) / NULLIF(SUM(ft.nbr_pieces), 0), 2)       AS cout_par_piece_dzd,

    -- Performance KPIs
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE ft.on_time = TRUE)
        / NULLIF(COUNT(*) FILTER (WHERE ft.status = 'terminée'), 0), 2
    )                                   AS taux_ponctualite_pct,
    AVG(ft.client_rating)               AS avg_note_client,
    AVG(ft.departure_delay_minutes) FILTER (WHERE ft.status = 'terminée') AS avg_retard_depart_min,
    AVG(ft.arrival_delay_minutes)   FILTER (WHERE ft.status = 'terminée') AS avg_retard_arrivee_min,

    -- Special cargo flags
    COUNT(*) FILTER (WHERE ft.fragile)         AS nbr_fragile,
    COUNT(*) FILTER (WHERE ft.hazardous)       AS nbr_hazardous,
    COUNT(*) FILTER (WHERE ft.requires_clark)  AS nbr_clark,
    COUNT(*) FILTER (WHERE ft.is_night_shift)  AS nbr_nuit,

    NOW()                               AS refreshed_at

FROM warehouse.fact_transport ft
JOIN warehouse.dim_date          d  ON ft.date_creation_key    = d.date_key
LEFT JOIN warehouse.dim_agence   a  ON ft.agence_dispatch_key  = a.agence_key  -- LEFT: may be private garage
LEFT JOIN warehouse.dim_wilaya   w  ON a.wilaya_key            = w.wilaya_key
LEFT JOIN warehouse.dim_company  c  ON a.company_key           = c.company_key
JOIN warehouse.dim_vehicle_type  vt ON ft.vehicle_type_key     = vt.vehicle_type_key

GROUP BY
    d.year, d.month_num, d.month_name_fr, d.year_month, d.quarter,
    a.agence_id, a.name,
    w.wilaya_id, w.wilaya_name, w.region,
    c.company_id, c.license_name,
    ft.service_type, ft.sub_service_type,
    vt.vehicle_type, vt.payload_class

WITH DATA;

COMMENT ON MATERIALIZED VIEW warehouse.agg_transport_mensuel IS
    'Monthly dedicated transport KPIs: volume, cost breakdown, billing, and performance by agency and service type.';

-- sub_service_type is included because course_dediee has 3 sub-types; omitting it would
-- produce duplicate rows and break REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_tm_unique
    ON warehouse.agg_transport_mensuel
    (year, month_num, COALESCE(agence_id, -1), service_type, COALESCE(sub_service_type, ''), vehicle_type);

CREATE INDEX IF NOT EXISTS idx_agg_tm_year_month ON warehouse.agg_transport_mensuel (year, month_num);
CREATE INDEX IF NOT EXISTS idx_agg_tm_agence     ON warehouse.agg_transport_mensuel (agence_id);
CREATE INDEX IF NOT EXISTS idx_agg_tm_service    ON warehouse.agg_transport_mensuel (service_type);
CREATE INDEX IF NOT EXISTS idx_agg_tm_wilaya     ON warehouse.agg_transport_mensuel (wilaya_dispatch_id);
