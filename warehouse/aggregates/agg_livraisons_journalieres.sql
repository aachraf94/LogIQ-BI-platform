-- =============================================================================
-- AGGREGATE: agg_livraisons_journalieres
-- Grain   : One row per (date, agence, delivery_type, status_group)
-- Source  : fact_livraisons + dim_date + dim_agence + dim_wilaya + dim_statut_colis
-- Purpose : Daily delivery volume, revenue, and outcome KPIs — primary dashboard feed
-- Refresh : REFRESH MATERIALIZED VIEW CONCURRENTLY — safe for live dashboards
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS warehouse.agg_livraisons_journalieres AS
SELECT
    -- Date attributes
    d.full_date,
    d.year,
    d.month_num,
    d.month_name_fr,
    d.year_month,
    d.quarter,
    d.day_of_week,
    d.is_weekend,
    d.is_friday,
    d.is_ramadan,
    d.business_day_weight,

    -- Agency attributes
    a.agence_id,
    a.name                          AS agence_name,
    a.type                          AS agence_type,
    a.hub_id,
    a.code_yal_two                  AS agence_code_court,

    -- Geographic attributes
    w.wilaya_id,
    w.wilaya_name,
    w.region,

    -- Company
    c.company_id,
    c.license_name                  AS company_name,

    -- Delivery segmentation
    fl.delivery_type,               -- HD, SD
    sc.status_group,                -- delivered, failed, return_transit, return_final, in-progress
    sc.is_terminal,
    sc.is_success,

    -- Volume KPIs
    COUNT(*)                        AS nbr_colis,
    COUNT(*) FILTER (WHERE sc.is_success)              AS nbr_colis_livres,
    COUNT(*) FILTER (WHERE sc.status_group = 'failed') AS nbr_colis_echoues,
    COUNT(*) FILTER (WHERE sc.status_group IN ('return_transit','return_final')) AS nbr_colis_retours,

    -- Revenue KPIs (only for parcels with a delivery_fee)
    SUM(fl.delivery_fee)            AS total_delivery_fee_dzd,
    AVG(fl.delivery_fee)            AS avg_delivery_fee_dzd,
    COUNT(*) FILTER (WHERE fl.delivery_fee IS NOT NULL) AS nbr_colis_avec_fee,

    -- Pricing zone distribution
    AVG(fl.zone)                    AS avg_zone,
    COUNT(*) FILTER (WHERE fl.zone = 0) AS nbr_zone_0,
    COUNT(*) FILTER (WHERE fl.zone = 1) AS nbr_zone_1,
    COUNT(*) FILTER (WHERE fl.zone = 2) AS nbr_zone_2,
    COUNT(*) FILTER (WHERE fl.zone = 3) AS nbr_zone_3,
    COUNT(*) FILTER (WHERE fl.zone >= 4) AS nbr_zone_4_plus,

    -- Delivery speed
    AVG(fl.duree_livraison_minutes) AS avg_duree_minutes,

    NOW()                           AS refreshed_at

FROM warehouse.fact_livraisons fl
JOIN warehouse.dim_date         d  ON fl.date_creation_key      = d.date_key
JOIN warehouse.dim_agence       a  ON fl.agence_origine_key     = a.agence_key
JOIN warehouse.dim_wilaya       w  ON a.wilaya_key              = w.wilaya_key
JOIN warehouse.dim_company      c  ON fl.company_key            = c.company_key
JOIN warehouse.dim_statut_colis sc ON fl.statut_final_key       = sc.statut_key

GROUP BY
    d.full_date, d.year, d.month_num, d.month_name_fr, d.year_month,
    d.quarter, d.day_of_week, d.is_weekend, d.is_friday, d.is_ramadan, d.business_day_weight,
    a.agence_id, a.name, a.type, a.hub_id, a.code_yal_two,
    w.wilaya_id, w.wilaya_name, w.region,
    c.company_id, c.license_name,
    fl.delivery_type, sc.status_group, sc.is_terminal, sc.is_success

WITH DATA;

COMMENT ON MATERIALIZED VIEW warehouse.agg_livraisons_journalieres IS
    'Daily delivery KPIs by agence, wilaya, delivery type, and outcome status group. Primary dashboard feed.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_lj_unique
    ON warehouse.agg_livraisons_journalieres
    (full_date, agence_id, delivery_type, status_group);

CREATE INDEX IF NOT EXISTS idx_agg_lj_date        ON warehouse.agg_livraisons_journalieres (full_date);
CREATE INDEX IF NOT EXISTS idx_agg_lj_year_month  ON warehouse.agg_livraisons_journalieres (year, month_num);
CREATE INDEX IF NOT EXISTS idx_agg_lj_agence      ON warehouse.agg_livraisons_journalieres (agence_id);
CREATE INDEX IF NOT EXISTS idx_agg_lj_wilaya      ON warehouse.agg_livraisons_journalieres (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_agg_lj_company     ON warehouse.agg_livraisons_journalieres (company_id);
CREATE INDEX IF NOT EXISTS idx_agg_lj_status      ON warehouse.agg_livraisons_journalieres (status_group);
