-- =============================================================================
-- AGGREGATE: agg_performance_livraison
-- Grain   : One row per (year, month, agence, delivery_type)
-- Source  : fact_livraisons + dim_date + dim_agence + dim_wilaya + dim_statut_colis
-- Purpose : Monthly delivery success/failure rates and revenue performance KPIs
--           Used by dashboard widgets: taux de livraison, taux de retour, revenu livraison
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS warehouse.agg_performance_livraison AS
SELECT
    -- Time
    d.year,
    d.month_num,
    d.month_name_fr,
    d.year_month,
    d.quarter,

    -- Agency
    a.agence_id,
    a.name                          AS agence_name,
    a.type                          AS agence_type,
    a.hub_id,

    -- Geography
    w.wilaya_id,
    w.wilaya_name,
    w.region,

    -- Company
    c.company_id,
    c.license_name                  AS company_name,

    -- Delivery type segmentation
    fl.delivery_type,               -- HD, SD (NULL means not yet routed)

    -- Volume counters
    COUNT(*)                        AS nbr_colis_total,
    COUNT(*) FILTER (WHERE sc.is_success)                           AS nbr_livres,
    COUNT(*) FILTER (WHERE sc.status_group = 'failed')              AS nbr_echecs,
    COUNT(*) FILTER (WHERE sc.status_group IN ('return_transit','return_final')) AS nbr_retours,
    COUNT(*) FILTER (WHERE NOT sc.is_terminal)                      AS nbr_en_cours,

    -- Rate KPIs (computed as NUMERIC to avoid integer division)
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE sc.is_success)
        / NULLIF(COUNT(*), 0), 2
    )                               AS taux_livraison_pct,

    ROUND(
        100.0 * COUNT(*) FILTER (WHERE sc.status_group = 'failed')
        / NULLIF(COUNT(*), 0), 2
    )                               AS taux_echec_pct,

    ROUND(
        100.0 * COUNT(*) FILTER (WHERE sc.status_group IN ('return_transit','return_final'))
        / NULLIF(COUNT(*), 0), 2
    )                               AS taux_retour_pct,

    -- Revenue KPIs (DZD)
    SUM(fl.delivery_fee)                                            AS total_fees_dzd,
    AVG(fl.delivery_fee)                                            AS avg_fee_dzd,
    SUM(fl.delivery_fee) FILTER (WHERE sc.is_success)              AS fees_livres_dzd,

    -- Speed KPIs
    AVG(fl.duree_livraison_minutes) FILTER (WHERE sc.is_success)   AS avg_duree_livree_minutes,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY fl.duree_livraison_minutes
    ) FILTER (WHERE sc.is_success)                                  AS median_duree_livree_minutes,

    -- Zone distribution (revenue analysis)
    COUNT(*) FILTER (WHERE fl.zone = 0)    AS nbr_zone_0,
    COUNT(*) FILTER (WHERE fl.zone = 1)    AS nbr_zone_1,
    COUNT(*) FILTER (WHERE fl.zone = 2)    AS nbr_zone_2,
    COUNT(*) FILTER (WHERE fl.zone = 3)    AS nbr_zone_3,
    COUNT(*) FILTER (WHERE fl.zone >= 4)   AS nbr_zone_4_plus,

    -- Parcel type split
    COUNT(*) FILTER (WHERE fl.parcel_type = 'ecommerce')   AS nbr_ecommerce,
    COUNT(*) FILTER (WHERE fl.parcel_type = 'internal')    AS nbr_internal,

    NOW()                           AS refreshed_at

FROM warehouse.fact_livraisons fl
JOIN warehouse.dim_date         d  ON fl.date_creation_key  = d.date_key
JOIN warehouse.dim_agence       a  ON fl.agence_origine_key = a.agence_key
JOIN warehouse.dim_wilaya       w  ON a.wilaya_key          = w.wilaya_key
JOIN warehouse.dim_company      c  ON fl.company_key        = c.company_key
JOIN warehouse.dim_statut_colis sc ON fl.statut_final_key   = sc.statut_key

GROUP BY
    d.year, d.month_num, d.month_name_fr, d.year_month, d.quarter,
    a.agence_id, a.name, a.type, a.hub_id,
    w.wilaya_id, w.wilaya_name, w.region,
    c.company_id, c.license_name,
    fl.delivery_type

WITH DATA;

COMMENT ON MATERIALIZED VIEW warehouse.agg_performance_livraison IS
    'Monthly delivery performance rates (taux livraison, echec, retour) and revenue KPIs per agency.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_perf_unique
    ON warehouse.agg_performance_livraison (year, month_num, agence_id, COALESCE(delivery_type, ''));

CREATE INDEX IF NOT EXISTS idx_agg_perf_year_month ON warehouse.agg_performance_livraison (year, month_num);
CREATE INDEX IF NOT EXISTS idx_agg_perf_agence     ON warehouse.agg_performance_livraison (agence_id);
CREATE INDEX IF NOT EXISTS idx_agg_perf_wilaya     ON warehouse.agg_performance_livraison (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_agg_perf_company    ON warehouse.agg_performance_livraison (company_id);
CREATE INDEX IF NOT EXISTS idx_agg_perf_region     ON warehouse.agg_performance_livraison (region);
