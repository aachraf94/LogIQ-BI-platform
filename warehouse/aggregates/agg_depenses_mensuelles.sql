-- =============================================================================
-- AGGREGATE: agg_depenses_mensuelles
-- Grain   : One row per (year, month, agence, category_group, nature)
-- Source  : fact_depenses + dim_date + dim_agence + dim_nature_depense + dim_company
-- Purpose : Monthly operational expense breakdown by agency and cost category
-- Notes   : Only status = 'validée' expenses are included in amount aggregations.
--           Rejected and pending expenses are counted separately for workflow KPIs.
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS warehouse.agg_depenses_mensuelles AS
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
    w.wilaya_id,
    w.wilaya_name,
    w.region,

    -- Company
    c.company_id,
    c.license_name                  AS company_name,

    -- Expense category
    nd.category_group,              -- Exploitation, Maintenance parc, Sinistres, etc.
    nd.nature_id,
    nd.nature_name,

    -- Volume KPIs
    COUNT(*)                                                        AS nbr_depenses_total,
    COUNT(*) FILTER (WHERE fd.status = 'validée')                   AS nbr_depenses_validees,
    COUNT(*) FILTER (WHERE fd.status = 'en_attente')                AS nbr_depenses_en_attente,
    COUNT(*) FILTER (WHERE fd.status = 'rejetée')                   AS nbr_depenses_rejetees,

    -- Amount KPIs — DZD (only validée)
    SUM(fd.montant) FILTER (WHERE fd.status = 'validée')            AS montant_total_dzd,
    AVG(fd.montant) FILTER (WHERE fd.status = 'validée')            AS montant_moyen_dzd,
    MAX(fd.montant) FILTER (WHERE fd.status = 'validée')            AS montant_max_dzd,
    MIN(fd.montant) FILTER (WHERE fd.status = 'validée')            AS montant_min_dzd,

    -- Pending amounts (for cash flow visibility)
    SUM(fd.montant) FILTER (WHERE fd.status = 'en_attente')         AS montant_en_attente_dzd,

    NOW()                           AS refreshed_at

FROM warehouse.fact_depenses fd
JOIN warehouse.dim_date          d  ON fd.date_depense_key     = d.date_key
JOIN warehouse.dim_agence        a  ON fd.agence_key           = a.agence_key
JOIN warehouse.dim_wilaya        w  ON a.wilaya_key            = w.wilaya_key
JOIN warehouse.dim_company       c  ON fd.company_key          = c.company_key
JOIN warehouse.dim_nature_depense nd ON fd.nature_depense_key  = nd.nature_depense_key

GROUP BY
    d.year, d.month_num, d.month_name_fr, d.year_month, d.quarter,
    a.agence_id, a.name, a.type,
    w.wilaya_id, w.wilaya_name, w.region,
    c.company_id, c.license_name,
    nd.category_group, nd.nature_id, nd.nature_name

WITH DATA;

COMMENT ON MATERIALIZED VIEW warehouse.agg_depenses_mensuelles IS
    'Monthly expense aggregates by agency and cost category. Only validated expenses in amount KPIs.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_dm_unique
    ON warehouse.agg_depenses_mensuelles (year, month_num, agence_id, nature_id);

CREATE INDEX IF NOT EXISTS idx_agg_dm_year_month  ON warehouse.agg_depenses_mensuelles (year, month_num);
CREATE INDEX IF NOT EXISTS idx_agg_dm_agence      ON warehouse.agg_depenses_mensuelles (agence_id);
CREATE INDEX IF NOT EXISTS idx_agg_dm_wilaya      ON warehouse.agg_depenses_mensuelles (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_agg_dm_category    ON warehouse.agg_depenses_mensuelles (category_group);
CREATE INDEX IF NOT EXISTS idx_agg_dm_company     ON warehouse.agg_depenses_mensuelles (company_id);
