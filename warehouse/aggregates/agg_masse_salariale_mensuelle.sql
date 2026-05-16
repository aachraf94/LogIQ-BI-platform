-- =============================================================================
-- AGGREGATE: agg_masse_salariale_mensuelle
-- Grain   : One row per (year, month, agence, occupation)
-- Source  : fact_bulletins_salaire + dim_employee + dim_agence + dim_occupation
-- Purpose : Monthly payroll mass analysis by agency and job category
--           Includes both employee-side net and employer-side total labor cost
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS warehouse.agg_masse_salariale_mensuelle AS
SELECT
    -- Time
    fbs.period_year                         AS year,
    fbs.period_month                        AS month_num,
    TO_CHAR(
        MAKE_DATE(fbs.period_year, fbs.period_month, 1), 'YYYY-MM'
    )                                       AS year_month,
    EXTRACT(QUARTER FROM
        MAKE_DATE(fbs.period_year, fbs.period_month, 1)
    )::SMALLINT                             AS quarter,

    -- Agency
    a.agence_id,
    a.name                                  AS agence_name,
    a.type                                  AS agence_type,
    w.wilaya_id,
    w.wilaya_name,
    w.region,

    -- Company
    c.company_id,
    c.license_name                          AS company_name,

    -- Occupation (job category analysis)
    o.occupation_name,
    o.service_name,

    -- Contract breakdown
    fbs.contract_type,
    fbs.regime,

    -- Headcount
    COUNT(*)                                AS nbr_bulletins,
    COUNT(DISTINCT fbs.employee_key)        AS nbr_employes,

    -- Gross salary components (DZD) — population totals
    SUM(fbs.base_salary)                    AS total_base_salary_dzd,
    SUM(fbs.anciennete)                     AS total_anciennete_dzd,
    SUM(fbs.prime_rendement)                AS total_prime_rendement_dzd,
    SUM(fbs.prime_panier)                   AS total_prime_panier_dzd,
    SUM(fbs.prime_transport)                AS total_prime_transport_dzd,
    SUM(fbs.heures_sup_amount)              AS total_heures_sup_dzd,
    SUM(fbs.total_brut)                     AS total_brut_dzd,

    -- Employee deductions
    SUM(fbs.cotisation_securite_sociale)    AS total_cotisation_ss_dzd,
    SUM(fbs.irg)                            AS total_irg_dzd,
    SUM(fbs.total_deductions)              AS total_deductions_dzd,
    SUM(fbs.net_a_payer)                    AS total_net_paye_dzd,

    -- Employer charges (key for total labor cost)
    SUM(fbs.cotisation_patronale_cnas)      AS total_cnas_dzd,
    SUM(fbs.cotisation_retraite)            AS total_retraite_dzd,
    SUM(fbs.accident_travail)               AS total_accident_dzd,
    SUM(fbs.total_charges_patronales)       AS total_charges_patronales_dzd,

    -- Total employer cost = brut + employer charges
    SUM(fbs.total_brut + fbs.total_charges_patronales) AS cout_total_employeur_dzd,

    -- Averages (per employee)
    AVG(fbs.base_salary)                    AS avg_base_salary_dzd,
    AVG(fbs.total_brut)                     AS avg_brut_dzd,
    AVG(fbs.net_a_payer)                    AS avg_net_dzd,

    -- Absence analysis
    SUM(fbs.jours_absence)                  AS total_jours_absence,
    SUM(fbs.jours_conge)                    AS total_jours_conge,
    SUM(fbs.jours_maladie)                  AS total_jours_maladie,
    SUM(fbs.heures_sup)                     AS total_heures_sup,

    NOW()                                   AS refreshed_at

FROM warehouse.fact_bulletins_salaire fbs
JOIN warehouse.dim_agence     a ON fbs.agence_key     = a.agence_key
JOIN warehouse.dim_wilaya     w ON a.wilaya_key       = w.wilaya_key
JOIN warehouse.dim_company    c ON fbs.company_key    = c.company_key
JOIN warehouse.dim_occupation o ON fbs.occupation_key = o.occupation_key

GROUP BY
    fbs.period_year, fbs.period_month, year_month, quarter,
    a.agence_id, a.name, a.type,
    w.wilaya_id, w.wilaya_name, w.region,
    c.company_id, c.license_name,
    o.occupation_name, o.service_name,
    fbs.contract_type, fbs.regime

WITH DATA;

COMMENT ON MATERIALIZED VIEW warehouse.agg_masse_salariale_mensuelle IS
    'Monthly payroll mass by agency, occupation, and contract type. Includes employer-side total labor cost.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_ms_unique
    ON warehouse.agg_masse_salariale_mensuelle
    (year, month_num, agence_id, occupation_name, contract_type, regime);

CREATE INDEX IF NOT EXISTS idx_agg_ms_year_month  ON warehouse.agg_masse_salariale_mensuelle (year, month_num);
CREATE INDEX IF NOT EXISTS idx_agg_ms_agence      ON warehouse.agg_masse_salariale_mensuelle (agence_id);
CREATE INDEX IF NOT EXISTS idx_agg_ms_company     ON warehouse.agg_masse_salariale_mensuelle (company_id);
CREATE INDEX IF NOT EXISTS idx_agg_ms_occupation  ON warehouse.agg_masse_salariale_mensuelle (occupation_name);
CREATE INDEX IF NOT EXISTS idx_agg_ms_wilaya      ON warehouse.agg_masse_salariale_mensuelle (wilaya_id);
