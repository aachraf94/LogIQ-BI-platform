-- =============================================================================
-- LOGIQ Warehouse Validation
-- Checks staging → dimension → fact consistency across all three layers.
--
-- Run (Docker, from logiq/):
--   docker compose exec -T warehouse-db \
--     psql -U logiq_warehouse_user -d logiq_warehouse < warehouse/validate.sql
--
-- Run (local, from logiq/):
--   psql -h localhost -p 5433 -U logiq_warehouse_user -d logiq_warehouse \
--     -f warehouse/validate.sql
--
-- All FAIL rows should be 0. WARN rows are informational.
-- The parcel history COUNT DISTINCT may take a few seconds on large datasets.
-- =============================================================================

\timing on
\pset format aligned
\pset border 2
SET search_path TO warehouse, public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ROW COUNTS — quick sanity check that each table is populated
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '━━━ 1. ROW COUNTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT layer, table_name, row_count,
       CASE WHEN row_count = 0 THEN 'FAIL — empty' ELSE 'ok' END AS status
FROM (
    -- Staging (18 tables)
    SELECT 1 AS s, 'staging'    AS layer, 'stg_yalidine_wilayas'           AS table_name, COUNT(*)::BIGINT AS row_count FROM stg_yalidine_wilayas           UNION ALL
    SELECT 1,'staging','stg_yalidine_communes',          COUNT(*) FROM stg_yalidine_communes           UNION ALL
    SELECT 1,'staging','stg_yalidine_centers',           COUNT(*) FROM stg_yalidine_centers            UNION ALL
    SELECT 1,'staging','stg_yalidine_pricing',           COUNT(*) FROM stg_yalidine_pricing            UNION ALL
    SELECT 1,'staging','stg_yalidine_parcel_history',    COUNT(*) FROM stg_yalidine_parcel_history     UNION ALL
    SELECT 1,'staging','stg_hrforce_companies',          COUNT(*) FROM stg_hrforce_companies           UNION ALL
    SELECT 1,'staging','stg_hrforce_agencies',           COUNT(*) FROM stg_hrforce_agencies            UNION ALL
    SELECT 1,'staging','stg_hrforce_users',              COUNT(*) FROM stg_hrforce_users               UNION ALL
    SELECT 1,'staging','stg_hrforce_occupations',        COUNT(*) FROM stg_hrforce_occupations         UNION ALL
    SELECT 1,'staging','stg_cashbox_natures',            COUNT(*) FROM stg_cashbox_natures             UNION ALL
    SELECT 1,'staging','stg_cashbox_rubriques',          COUNT(*) FROM stg_cashbox_rubriques           UNION ALL
    SELECT 1,'staging','stg_cashbox_depenses',           COUNT(*) FROM stg_cashbox_depenses            UNION ALL
    SELECT 1,'staging','stg_cashbox_paiements_livreurs', COUNT(*) FROM stg_cashbox_paiements_livreurs  UNION ALL
    SELECT 1,'staging','stg_cashbox_remboursements',     COUNT(*) FROM stg_cashbox_remboursements      UNION ALL
    SELECT 1,'staging','stg_cashbox_transferts',         COUNT(*) FROM stg_cashbox_transferts          UNION ALL
    SELECT 1,'staging','stg_paie_bulletins',             COUNT(*) FROM stg_paie_bulletins              UNION ALL
    SELECT 1,'staging','stg_transport_requests',         COUNT(*) FROM stg_transport_requests          UNION ALL
    SELECT 1,'staging','stg_transport_stops',            COUNT(*) FROM stg_transport_stops             UNION ALL
    -- Dimensions
    SELECT 2,'dimensions','dim_wilaya',                  COUNT(*) FROM dim_wilaya                      UNION ALL
    SELECT 2,'dimensions','dim_commune',                 COUNT(*) FROM dim_commune                     UNION ALL
    SELECT 2,'dimensions','dim_agence (all SCD2)',       COUNT(*) FROM dim_agence                      UNION ALL
    SELECT 2,'dimensions','dim_agence (current)',        COUNT(*) FROM dim_agence   WHERE is_current   UNION ALL
    SELECT 2,'dimensions','dim_center',                  COUNT(*) FROM dim_center                      UNION ALL
    SELECT 2,'dimensions','dim_company',                 COUNT(*) FROM dim_company                     UNION ALL
    SELECT 2,'dimensions','dim_department',              COUNT(*) FROM dim_department                  UNION ALL
    SELECT 2,'dimensions','dim_service',                 COUNT(*) FROM dim_service                     UNION ALL
    SELECT 2,'dimensions','dim_occupation',              COUNT(*) FROM dim_occupation                  UNION ALL
    SELECT 2,'dimensions','dim_contract',                COUNT(*) FROM dim_contract                    UNION ALL
    SELECT 2,'dimensions','dim_employee (all SCD2)',     COUNT(*) FROM dim_employee                    UNION ALL
    SELECT 2,'dimensions','dim_employee (current)',      COUNT(*) FROM dim_employee WHERE is_current   UNION ALL
    SELECT 2,'dimensions','dim_livreur_freelance',       COUNT(*) FROM dim_livreur_freelance           UNION ALL
    SELECT 2,'dimensions','dim_bulletin',                COUNT(*) FROM dim_bulletin                    UNION ALL
    SELECT 2,'dimensions','dim_pricing',                 COUNT(*) FROM dim_pricing                     UNION ALL
    SELECT 2,'dimensions','dim_depense',                 COUNT(*) FROM dim_depense                     UNION ALL
    SELECT 2,'dimensions','dim_paiement_livreurs',       COUNT(*) FROM dim_paiement_livreurs           UNION ALL
    SELECT 2,'dimensions','dim_remboursement',           COUNT(*) FROM dim_remboursement               UNION ALL
    SELECT 2,'dimensions','dim_transport',               COUNT(*) FROM dim_transport                   UNION ALL
    SELECT 2,'dimensions','dim_parcel',                  COUNT(*) FROM dim_parcel                      UNION ALL
    -- Facts
    SELECT 3,'facts','fact_parcel_revenue',              COUNT(*) FROM fact_parcel_revenue             UNION ALL
    SELECT 3,'facts','fact_parcel_performance',          COUNT(*) FROM fact_parcel_performance         UNION ALL
    SELECT 3,'facts','fact_cost_salaire',                COUNT(*) FROM fact_cost_salaire               UNION ALL
    SELECT 3,'facts','fact_charges',                     COUNT(*) FROM fact_charges                    UNION ALL
    SELECT 3,'facts','fact_transport_cost',              COUNT(*) FROM fact_transport_cost             UNION ALL
    SELECT 3,'facts','fact_transport_billing',           COUNT(*) FROM fact_transport_billing          UNION ALL
    SELECT 3,'facts','fact_transport_performance',       COUNT(*) FROM fact_transport_performance
) t
ORDER BY s, table_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SCD2 INTEGRITY — each business key must have exactly one current row
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '━━━ 2. SCD2 INTEGRITY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT check_name, violations,
       CASE WHEN violations > 0 THEN 'FAIL' ELSE 'ok' END AS status
FROM (
    SELECT 'dim_agence: duplicate current rows per agency_id' AS check_name,
           COUNT(*) AS violations
    FROM (
        SELECT agency_id FROM dim_agence WHERE is_current = TRUE
        GROUP BY agency_id HAVING COUNT(*) > 1
    ) x
    UNION ALL
    SELECT 'dim_employee: duplicate current rows per employee_id',
           COUNT(*)
    FROM (
        SELECT employee_id FROM dim_employee WHERE is_current = TRUE
        GROUP BY employee_id HAVING COUNT(*) > 1
    ) x
    UNION ALL
    SELECT 'dim_agence: overlapping valid periods for same agency_id',
           COUNT(*)
    FROM (
        SELECT a1.agence_key
        FROM dim_agence a1
        JOIN dim_agence a2
          ON a1.agency_id = a2.agency_id
         AND a1.agence_key <> a2.agence_key
         AND a1.valid_from <= COALESCE(a2.valid_to, 'infinity'::date)
         AND a2.valid_from <= COALESCE(a1.valid_to, 'infinity'::date)
    ) x
    UNION ALL
    SELECT 'dim_employee: overlapping valid periods for same employee_id',
           COUNT(*)
    FROM (
        SELECT e1.employee_key
        FROM dim_employee e1
        JOIN dim_employee e2
          ON e1.employee_id = e2.employee_id
         AND e1.employee_key <> e2.employee_key
         AND e1.valid_from <= COALESCE(e2.valid_to, 'infinity'::date)
         AND e2.valid_from <= COALESCE(e1.valid_to, 'infinity'::date)
    ) x
) checks;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. STAGING → DIMENSION COVERAGE
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '━━━ 3. STAGING → DIM COVERAGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT check_name, in_staging, in_dim,
       CASE WHEN in_staging > 0
            THEN ROUND(in_dim::NUMERIC / in_staging * 100, 1) || '%'
            ELSE 'n/a'
       END AS coverage,
       CASE
           WHEN in_staging = 0         THEN 'WARN — staging empty'
           WHEN in_dim = 0             THEN 'FAIL — dim empty'
           WHEN in_dim < in_staging * 0.95 THEN 'WARN — <95% coverage'
           ELSE 'ok'
       END AS status
FROM (
    -- Parcels: distinct trackings in stg vs dim_parcel rows
    SELECT 'stg_yalidine_parcel_history trackings → dim_parcel'   AS check_name,
           (SELECT COUNT(DISTINCT tracking) FROM stg_yalidine_parcel_history)::BIGINT AS in_staging,
           (SELECT COUNT(*) FROM dim_parcel)::BIGINT                                   AS in_dim

    UNION ALL
    -- Agencies (excl. TEST company)
    SELECT 'stg_hrforce_agencies (non-TEST) → dim_agence (current)',
           (SELECT COUNT(*) FROM stg_hrforce_agencies WHERE company_id != 9),
           (SELECT COUNT(*) FROM dim_agence WHERE is_current = TRUE)

    UNION ALL
    -- Employees (excl. TEST)
    SELECT 'stg_hrforce_users (non-TEST) → dim_employee (current)',
           (SELECT COUNT(*) FROM stg_hrforce_users WHERE company_id != 9),
           (SELECT COUNT(*) FROM dim_employee WHERE is_current = TRUE)

    UNION ALL
    -- Bulletins (excl. TEST, within dim_date range)
    SELECT 'stg_paie_bulletins (non-TEST, in date range) → dim_bulletin',
           (SELECT COUNT(*) FROM stg_paie_bulletins
            WHERE company_id != 9
              AND payment_date IN (SELECT date_id FROM dim_date)),
           (SELECT COUNT(*) FROM dim_bulletin)

    UNION ALL
    -- Depenses → dim_depense
    SELECT 'stg_cashbox_depenses → dim_depense',
           (SELECT COUNT(*) FROM stg_cashbox_depenses),
           (SELECT COUNT(*) FROM dim_depense)

    UNION ALL
    -- Transport requests → dim_transport
    SELECT 'stg_transport_requests → dim_transport',
           (SELECT COUNT(*) FROM stg_transport_requests),
           (SELECT COUNT(*) FROM dim_transport)

    UNION ALL
    -- Centers → dim_center
    SELECT 'stg_yalidine_centers → dim_center',
           (SELECT COUNT(*) FROM stg_yalidine_centers),
           (SELECT COUNT(*) FROM dim_center)

    UNION ALL
    -- Wilayas → dim_wilaya
    SELECT 'stg_yalidine_wilayas → dim_wilaya',
           (SELECT COUNT(*) FROM stg_yalidine_wilayas),
           (SELECT COUNT(*) FROM dim_wilaya)
) t;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DIMENSION → FACT COVERAGE
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '━━━ 4. DIM → FACT COVERAGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT check_name, in_dim, in_fact,
       CASE WHEN in_dim > 0
            THEN ROUND(in_fact::NUMERIC / in_dim * 100, 1) || '%'
            ELSE 'n/a'
       END AS coverage,
       CASE
           WHEN in_dim = 0  THEN 'WARN — dim empty'
           WHEN in_fact = 0 THEN 'FAIL — fact empty'
           WHEN in_fact < in_dim * 0.95 THEN 'WARN — <95% coverage'
           ELSE 'ok'
       END AS status
FROM (
    -- Terminal parcels → fact_parcel_revenue
    SELECT 'dim_parcel (terminal) → fact_parcel_revenue'        AS check_name,
           (SELECT COUNT(*) FROM dim_parcel p
            JOIN dim_parcels_status ps ON ps.status_id = p.current_status_id AND ps.is_terminal) AS in_dim,
           (SELECT COUNT(*) FROM fact_parcel_revenue)::BIGINT   AS in_fact

    UNION ALL
    -- All parcels → fact_parcel_performance
    SELECT 'dim_parcel (all) → fact_parcel_performance',
           (SELECT COUNT(*) FROM dim_parcel),
           (SELECT COUNT(*) FROM fact_parcel_performance)

    UNION ALL
    -- dim_bulletin → fact_cost_salaire
    SELECT 'dim_bulletin → fact_cost_salaire',
           (SELECT COUNT(*) FROM dim_bulletin),
           (SELECT COUNT(*) FROM fact_cost_salaire)

    UNION ALL
    -- dim_depense → fact_charges
    SELECT 'dim_depense → fact_charges',
           (SELECT COUNT(*) FROM dim_depense),
           (SELECT COUNT(*) FROM fact_charges)

    UNION ALL
    -- dim_transport → fact_transport_cost
    SELECT 'dim_transport → fact_transport_cost',
           (SELECT COUNT(*) FROM dim_transport),
           (SELECT COUNT(*) FROM fact_transport_cost)

    UNION ALL
    -- dim_transport → fact_transport_billing
    SELECT 'dim_transport → fact_transport_billing',
           (SELECT COUNT(*) FROM dim_transport),
           (SELECT COUNT(*) FROM fact_transport_billing)

    UNION ALL
    -- dim_transport → fact_transport_performance
    SELECT 'dim_transport → fact_transport_performance',
           (SELECT COUNT(*) FROM dim_transport),
           (SELECT COUNT(*) FROM fact_transport_performance)
) t;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. BUSINESS RULE CHECKS — all violations must be 0
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '━━━ 5. BUSINESS RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT check_name, violations,
       CASE WHEN violations > 0 THEN 'FAIL' ELSE 'ok' END AS status
FROM (
    -- TEST company (id=9) must never appear in dims or facts
    SELECT 'dim_company: TEST company (id=9) present' AS check_name,
           COUNT(*) AS violations FROM dim_company WHERE company_id = 9

    UNION ALL
    SELECT 'dim_employee: employees from TEST company present',
           COUNT(*) FROM dim_employee WHERE company_id = 9

    UNION ALL
    SELECT 'dim_bulletin: bulletins from TEST company (via stg)',
           COUNT(*) FROM stg_paie_bulletins b
           JOIN dim_bulletin db ON db.bulletin_id = b.bulletin_id
           WHERE b.company_id = 9

    UNION ALL
    -- cout_assurance >= 5000 DZD (business rule on every transport)
    SELECT 'fact_transport_cost: cout_assurance < 5000 DZD',
           COUNT(*) FROM fact_transport_cost WHERE cout_assurance < 5000

    UNION ALL
    -- total_cost must equal sum of all cout_* components
    SELECT 'fact_transport_cost: total_cost ≠ sum(cout_*) (tolerance 0.01 DZD)',
           COUNT(*) FROM fact_transport_cost
           WHERE ABS(total_cost - (
               cout_base + cout_distance_supp + cout_ramassage + cout_livraison +
               cout_manutention + cout_emballage + cout_tarif_nuit + cout_prod_frais +
               cout_assurance + COALESCE(cout_carburant, 0) + COALESCE(cout_peage, 0)
           )) > 0.01

    UNION ALL
    -- fact_parcel_revenue: delivery_fee must be positive
    SELECT 'fact_parcel_revenue: delivery_fee <= 0',
           COUNT(*) FROM fact_parcel_revenue WHERE delivery_fee <= 0

    UNION ALL
    -- fact_cost_salaire: total_brut must be positive
    SELECT 'fact_cost_salaire: total_brut <= 0',
           COUNT(*) FROM fact_cost_salaire WHERE total_brut <= 0

    UNION ALL
    -- fact_charges: montant must be positive
    SELECT 'fact_charges: montant <= 0',
           COUNT(*) FROM fact_charges WHERE montant <= 0

    UNION ALL
    -- dim_parcel: no two rows with same tracking
    SELECT 'dim_parcel: duplicate tracking values',
           COUNT(*) FROM (
               SELECT tracking FROM dim_parcel GROUP BY tracking HAVING COUNT(*) > 1
           ) x

    UNION ALL
    -- dim_bulletin: no two rows with same bulletin_id
    SELECT 'dim_bulletin: duplicate bulletin_id values',
           COUNT(*) FROM (
               SELECT bulletin_id FROM dim_bulletin GROUP BY bulletin_id HAVING COUNT(*) > 1
           ) x

    UNION ALL
    -- dim_depense backref update: every paiement_livreur depense should have backref set
    SELECT 'dim_depense: paiement_livreur_id NULL for depenses that have a matching paiement',
           COUNT(*) FROM dim_depense d
           JOIN dim_paiement_livreurs pl ON pl.depense_id = d.depense_id
           WHERE d.paiement_livreur_id IS NULL

    UNION ALL
    -- Same for remboursement backref
    SELECT 'dim_depense: remboursement_id NULL for depenses that have a matching remboursement',
           COUNT(*) FROM dim_depense d
           JOIN dim_remboursement r ON r.depense_id = d.depense_id
           WHERE d.remboursement_id IS NULL
) checks;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. NULL CHECKS — mandatory FK columns in fact tables
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '━━━ 6. FACT NULL CHECKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT check_name, nulls,
       CASE WHEN nulls > 0 THEN 'WARN — some FKs unresolved' ELSE 'ok' END AS status
FROM (
    -- fact_transport_cost: date_id resolvable from dim_date?
    SELECT 'fact_transport_cost: date_id NULL (created_at_src out of dim_date range)' AS check_name,
           COUNT(*) AS nulls FROM fact_transport_cost WHERE date_id IS NULL

    UNION ALL
    SELECT 'fact_transport_billing: date_invoiced_id NULL (invoiced_at out of range or not set)',
           COUNT(*) FROM fact_transport_billing WHERE date_invoiced_id IS NULL

    UNION ALL
    SELECT 'fact_transport_performance: date_completion_id NULL (not terminée or out of range)',
           COUNT(*) FROM fact_transport_performance WHERE date_completion_id IS NULL

    UNION ALL
    -- dim_center: centers with no agence_key (no matching HRFORCE agency)
    SELECT 'dim_center: centers with no agence_key (unlinked to any agency)',
           COUNT(*) FROM dim_center WHERE agence_key IS NULL

    UNION ALL
    -- dim_employee: employees with NULL agence_key (no current agency match)
    SELECT 'dim_employee (current): NULL agence_key',
           COUNT(*) FROM dim_employee WHERE is_current AND agence_key IS NULL

    UNION ALL
    -- fact_parcel_revenue: tarif_theorique NULL (pricing missing for destination wilaya)
    SELECT 'fact_parcel_revenue: tarif_theorique NULL (wilaya not in dim_pricing)',
           COUNT(*) FROM fact_parcel_revenue WHERE tarif_theorique IS NULL
) checks;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SUMMARY
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '━━━ 7. SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

WITH combined AS (
    -- row count failures
    SELECT 'row_counts'   AS section, CASE WHEN COUNT(*) = 0 THEN 'empty table' ELSE '' END AS issue,
           SUM(CASE WHEN row_count = 0 THEN 1 ELSE 0 END) AS fails
    FROM (
        SELECT COUNT(*)::BIGINT AS row_count FROM stg_yalidine_parcel_history UNION ALL
        SELECT COUNT(*) FROM dim_parcel UNION ALL
        SELECT COUNT(*) FROM fact_parcel_revenue UNION ALL
        SELECT COUNT(*) FROM fact_parcel_performance UNION ALL
        SELECT COUNT(*) FROM fact_cost_salaire UNION ALL
        SELECT COUNT(*) FROM fact_charges UNION ALL
        SELECT COUNT(*) FROM fact_transport_cost UNION ALL
        SELECT COUNT(*) FROM fact_transport_billing UNION ALL
        SELECT COUNT(*) FROM fact_transport_performance
    ) t
)
SELECT
    CASE WHEN fails = 0
         THEN 'ALL KEY TABLES POPULATED — run sections 2-6 above for full details'
         ELSE fails || ' key table(s) are empty — check section 1 for details'
    END AS summary
FROM combined;

\echo ''
\echo 'Done. Look for FAIL rows above — WARN rows are informational.'
\echo ''
