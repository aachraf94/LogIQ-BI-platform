-- =============================================================================
-- AGGREGATE: agg_profitabilite_colis
-- Grain   : One row per (year, month, agence_origine, zone, delivery_type)
-- Source  : fact_livraisons + dim_date + dim_agence + dim_wilaya + dim_statut_colis
-- Purpose : Parcel Cost Control (PCC) — Axis 2 (Should have)
--             - Compare actual delivery_fee against tarif_theorique (pricing grid)
--             - Detect and monitor profitability deviations per zone and agency
--             - Support service pricing decisions (which zones/types are loss-making?)
--             - Surface anomalies for the proactive alerting mechanism
-- Notes   : tarif_theorique is populated by ETL from stg_yalidine_pricing.
--           Rows with NULL tarif_theorique are included but excluded from deviation KPIs.
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS warehouse.agg_profitabilite_colis AS
SELECT
    -- Time
    d.year,
    d.month_num,
    d.month_name_fr,
    d.year_month,
    d.quarter,

    -- Agency (origin — where the parcel entered the network)
    a.agence_id,
    a.name                                  AS agence_name,
    a.type                                  AS agence_type,
    w.wilaya_id,
    w.wilaya_name,
    w.region,

    -- Company (seller's company)
    c.company_id,
    c.license_name                          AS company_name,

    -- Pricing dimensions — the two levers for tarif_theorique lookup
    fl.zone,                                -- 0, 1, 2, 3, 4+ (NULL = not yet routed)
    fl.delivery_type,                       -- HD (home delivery) or SD (stop delivery); NULL = unrouted

    -- Volume KPIs
    COUNT(*)                                AS nbr_colis_total,
    COUNT(*) FILTER (WHERE sc.is_success)   AS nbr_livres,
    COUNT(*) FILTER (WHERE sc.status_group = 'failed')  AS nbr_echecs,
    COUNT(*) FILTER (WHERE fl.tarif_theorique IS NOT NULL) AS nbr_avec_tarif,

    -- Revenue KPIs (DZD)
    SUM(fl.delivery_fee)                    AS total_fees_dzd,
    AVG(fl.delivery_fee)                    AS avg_fee_dzd,
    SUM(fl.delivery_fee) FILTER (WHERE sc.is_success) AS fees_livres_dzd,

    -- Tariff KPIs (DZD) — only where pricing grid lookup succeeded
    SUM(fl.tarif_theorique)                 AS total_tarif_theorique_dzd,
    AVG(fl.tarif_theorique)                 AS avg_tarif_theorique_dzd,

    -- Deviation KPIs — Axis 2: PCC deviation detection
    SUM(fl.ecart_tarif_dzd)                 AS total_ecart_dzd,
    AVG(fl.ecart_tarif_dzd)                 AS avg_ecart_dzd,
    ROUND(
        100.0 * SUM(fl.ecart_tarif_dzd)
        / NULLIF(SUM(fl.tarif_theorique), 0), 2
    )                                       AS taux_ecart_pct,      -- deviation rate vs tariff grid

    -- Anomaly counters — surfaced by alerting mechanism
    COUNT(*) FILTER (WHERE fl.ecart_tarif_dzd < 0)
                                            AS nbr_sous_tarif,      -- below pricing grid
    COUNT(*) FILTER (WHERE fl.ecart_tarif_dzd > 0)
                                            AS nbr_sur_tarif,       -- above pricing grid (overcharge)
    COUNT(*) FILTER (WHERE fl.ecart_tarif_dzd = 0 OR fl.ecart_tarif_dzd IS NULL AND fl.tarif_theorique IS NOT NULL)
                                            AS nbr_au_tarif,        -- exactly on grid

    -- Average deviation magnitude (absolute) — for alerting threshold calibration
    AVG(ABS(fl.ecart_tarif_dzd))           AS avg_ecart_absolu_dzd,

    -- Revenue per delivered parcel (efficiency metric)
    ROUND(
        SUM(fl.delivery_fee) FILTER (WHERE sc.is_success)
        / NULLIF(COUNT(*) FILTER (WHERE sc.is_success), 0), 2
    )                                       AS avg_fee_livre_dzd,

    NOW()                                   AS refreshed_at

FROM warehouse.fact_livraisons fl
JOIN warehouse.dim_date         d  ON fl.date_creation_key  = d.date_key
JOIN warehouse.dim_agence       a  ON fl.agence_origine_key = a.agence_key
JOIN warehouse.dim_wilaya       w  ON a.wilaya_key          = w.wilaya_key
JOIN warehouse.dim_company      c  ON fl.company_key        = c.company_key
JOIN warehouse.dim_statut_colis sc ON fl.statut_final_key   = sc.statut_key

GROUP BY
    d.year, d.month_num, d.month_name_fr, d.year_month, d.quarter,
    a.agence_id, a.name, a.type,
    w.wilaya_id, w.wilaya_name, w.region,
    c.company_id, c.license_name,
    fl.zone, fl.delivery_type

WITH DATA;

COMMENT ON MATERIALIZED VIEW warehouse.agg_profitabilite_colis IS
    'Parcel Cost Control (PCC): actual delivery fee vs tariff grid by zone and agency. Deviation KPIs drive the proactive alerting mechanism. Axis 2 — Should have.';

-- NULL zone and NULL delivery_type are valid states (parcels not yet routed).
-- COALESCE substitutes sentinel values to keep the unique index functional.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_pc_unique
    ON warehouse.agg_profitabilite_colis
    (year, month_num, agence_id, company_id, COALESCE(zone, -1), COALESCE(delivery_type, ''));

CREATE INDEX IF NOT EXISTS idx_agg_pc_year_month ON warehouse.agg_profitabilite_colis (year, month_num);
CREATE INDEX IF NOT EXISTS idx_agg_pc_agence     ON warehouse.agg_profitabilite_colis (agence_id);
CREATE INDEX IF NOT EXISTS idx_agg_pc_wilaya     ON warehouse.agg_profitabilite_colis (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_agg_pc_company    ON warehouse.agg_profitabilite_colis (company_id);
CREATE INDEX IF NOT EXISTS idx_agg_pc_zone       ON warehouse.agg_profitabilite_colis (zone);
CREATE INDEX IF NOT EXISTS idx_agg_pc_ecart      ON warehouse.agg_profitabilite_colis (taux_ecart_pct); -- alerting: sort by highest deviation
