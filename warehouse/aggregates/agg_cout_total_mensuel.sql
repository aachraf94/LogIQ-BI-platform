-- =============================================================================
-- AGGREGATE: agg_cout_total_mensuel
-- Grain   : One row per (year, month, agence)
-- Source  : fact_depenses + fact_bulletins_salaire + fact_paiements_livreurs
-- Purpose : Total monthly operational cost per agency across all cost streams.
--           This is the master cost KPI view — combines:
--             1. Operational expenses (fact_depenses, status = 'validée')
--             2. Employee payroll (fact_bulletins_salaire — total_brut + employer charges)
--             3. Freelance driver payments (fact_paiements_livreurs — total_net)
-- IMPORTANT: Fund transfers (fact_transferts_caisse) are EXCLUDED — not a cost.
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS warehouse.agg_cout_total_mensuel AS
WITH

-- Stream 1: Operational expenses (validated only)
depenses AS (
    SELECT
        d.year,
        d.month_num,
        d.year_month,
        d.quarter,
        a.agence_id,
        a.name          AS agence_name,
        a.type          AS agence_type,
        w.wilaya_id,
        w.wilaya_name,
        w.region,
        c.company_id,
        c.license_name  AS company_name,
        COUNT(*)                                                    AS nbr_depenses,
        SUM(fd.montant)                                             AS total_depenses_dzd
    FROM warehouse.fact_depenses fd
    JOIN warehouse.dim_date     d ON fd.date_depense_key = d.date_key
    JOIN warehouse.dim_agence   a ON fd.agence_key       = a.agence_key
    JOIN warehouse.dim_wilaya   w ON a.wilaya_key        = w.wilaya_key
    JOIN warehouse.dim_company  c ON fd.company_key      = c.company_key
    WHERE fd.status = 'validée'
    GROUP BY d.year, d.month_num, d.year_month, d.quarter,
             a.agence_id, a.name, a.type, w.wilaya_id, w.wilaya_name, w.region,
             c.company_id, c.license_name
),

-- Stream 2: Employee payroll (brut + employer charges = total employer cost)
paie AS (
    SELECT
        fbs.period_year                                             AS year,
        fbs.period_month                                            AS month_num,
        TO_CHAR(MAKE_DATE(fbs.period_year, fbs.period_month, 1), 'YYYY-MM') AS year_month,
        EXTRACT(QUARTER FROM MAKE_DATE(fbs.period_year, fbs.period_month, 1))::SMALLINT AS quarter,
        a.agence_id,
        a.name          AS agence_name,
        a.type          AS agence_type,
        w.wilaya_id,
        w.wilaya_name,
        w.region,
        c.company_id,
        c.license_name  AS company_name,
        COUNT(*)                                                    AS nbr_bulletins,
        SUM(fbs.total_brut)                                         AS total_brut_dzd,
        SUM(fbs.total_charges_patronales)                           AS total_charges_patronales_dzd,
        SUM(fbs.total_brut + fbs.total_charges_patronales)          AS total_cout_employeur_dzd,
        SUM(fbs.net_a_payer)                                        AS total_net_paye_dzd
    FROM warehouse.fact_bulletins_salaire fbs
    JOIN warehouse.dim_agence   a ON fbs.agence_key  = a.agence_key
    JOIN warehouse.dim_wilaya   w ON a.wilaya_key    = w.wilaya_key
    JOIN warehouse.dim_company  c ON fbs.company_key = c.company_key
    GROUP BY fbs.period_year, fbs.period_month, year_month, quarter,
             a.agence_id, a.name, a.type, w.wilaya_id, w.wilaya_name, w.region,
             c.company_id, c.license_name
),

-- Stream 3: Freelance driver payments
freelance AS (
    SELECT
        d.year,
        d.month_num,
        d.year_month,
        d.quarter,
        a.agence_id,
        a.name          AS agence_name,
        a.type          AS agence_type,
        w.wilaya_id,
        w.wilaya_name,
        w.region,
        -- Company from dim_agence (freelancers belong to agency's company)
        a.company_id,
        c.license_name  AS company_name,
        COUNT(DISTINCT fpl.driver_key)                              AS nbr_livreurs_actifs,
        SUM(fpl.nbr_colis_livres)                                   AS nbr_colis_livres_freelance,
        SUM(fpl.total_net)                                          AS total_freelance_dzd
    FROM warehouse.fact_paiements_livreurs fpl
    JOIN warehouse.dim_date      d ON fpl.date_paiement_key = d.date_key
    JOIN warehouse.dim_agence    a ON fpl.agence_key        = a.agence_key
    JOIN warehouse.dim_wilaya    w ON a.wilaya_key          = w.wilaya_key
    JOIN warehouse.dim_company   c ON a.company_key         = c.company_key
    GROUP BY d.year, d.month_num, d.year_month, d.quarter,
             a.agence_id, a.name, a.type, w.wilaya_id, w.wilaya_name, w.region,
             a.company_id, c.license_name
)

-- Final join: all agencies present in any stream
SELECT
    COALESCE(dep.year,     pai.year,     frl.year)       AS year,
    COALESCE(dep.month_num,pai.month_num,frl.month_num)  AS month_num,
    COALESCE(dep.year_month,pai.year_month,frl.year_month) AS year_month,
    COALESCE(dep.quarter,  pai.quarter,  frl.quarter)    AS quarter,
    COALESCE(dep.agence_id,pai.agence_id,frl.agence_id)  AS agence_id,
    COALESCE(dep.agence_name,pai.agence_name,frl.agence_name) AS agence_name,
    COALESCE(dep.agence_type,pai.agence_type,frl.agence_type) AS agence_type,
    COALESCE(dep.wilaya_id,pai.wilaya_id,frl.wilaya_id)  AS wilaya_id,
    COALESCE(dep.wilaya_name,pai.wilaya_name,frl.wilaya_name) AS wilaya_name,
    COALESCE(dep.region,   pai.region,   frl.region)     AS region,
    COALESCE(dep.company_id,pai.company_id,frl.company_id) AS company_id,
    COALESCE(dep.company_name,pai.company_name,frl.company_name) AS company_name,

    -- Individual cost stream totals
    COALESCE(dep.total_depenses_dzd, 0)                  AS total_depenses_dzd,
    COALESCE(dep.nbr_depenses, 0)                        AS nbr_depenses,
    COALESCE(pai.total_cout_employeur_dzd, 0)            AS total_cout_employeur_dzd,
    COALESCE(pai.total_brut_dzd, 0)                      AS total_brut_salaires_dzd,
    COALESCE(pai.total_charges_patronales_dzd, 0)        AS total_charges_patronales_dzd,
    COALESCE(pai.nbr_bulletins, 0)                       AS nbr_employes_payes,
    COALESCE(frl.total_freelance_dzd, 0)                 AS total_freelance_dzd,
    COALESCE(frl.nbr_livreurs_actifs, 0)                 AS nbr_livreurs_freelance,
    COALESCE(frl.nbr_colis_livres_freelance, 0)          AS nbr_colis_livres_freelance,

    -- Grand total cost (excludes fund transfers)
    COALESCE(dep.total_depenses_dzd, 0)
    + COALESCE(pai.total_cout_employeur_dzd, 0)
    + COALESCE(frl.total_freelance_dzd, 0)               AS cout_total_dzd,

    NOW()                                                AS refreshed_at

FROM depenses dep
FULL OUTER JOIN paie pai
    ON  dep.year       = pai.year
    AND dep.month_num  = pai.month_num
    AND dep.agence_id  = pai.agence_id
FULL OUTER JOIN freelance frl
    ON  COALESCE(dep.year, pai.year)       = frl.year
    AND COALESCE(dep.month_num, pai.month_num) = frl.month_num
    AND COALESCE(dep.agence_id, pai.agence_id) = frl.agence_id

WITH DATA;

COMMENT ON MATERIALIZED VIEW warehouse.agg_cout_total_mensuel IS
    'Master monthly cost view per agency. Combines expenses + payroll + freelance. Excludes fund transfers.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_ctm_unique
    ON warehouse.agg_cout_total_mensuel (year, month_num, agence_id);

CREATE INDEX IF NOT EXISTS idx_agg_ctm_year_month ON warehouse.agg_cout_total_mensuel (year, month_num);
CREATE INDEX IF NOT EXISTS idx_agg_ctm_agence     ON warehouse.agg_cout_total_mensuel (agence_id);
CREATE INDEX IF NOT EXISTS idx_agg_ctm_wilaya     ON warehouse.agg_cout_total_mensuel (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_agg_ctm_company    ON warehouse.agg_cout_total_mensuel (company_id);
