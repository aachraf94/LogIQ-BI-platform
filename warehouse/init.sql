-- =============================================================================
-- LOGIQ Data Warehouse — Master Initialization Script
-- Target   : PostgreSQL 17
-- Schema   : warehouse
-- Project  : LOGIQ BI Platform — Yalidine Express
-- =============================================================================
--
-- EXECUTION ORDER (respect dependency chain):
--   1. Schema creation
--   2. Staging tables        (no inter-table dependencies)
--   3. Dimension tables      (dependency order: company → wilaya → commune →
--                             occupation → agence → employee → others)
--   4. Fact tables           (depend on all dimensions)
--   5. Aggregate views       (depend on fact tables and dimensions)
--
-- USAGE:
--   psql -U <user> -d <database> -f warehouse/init.sql
--
-- RE-RUN SAFETY:
--   All CREATE statements use IF NOT EXISTS.
--   Dimension seed INSERTs use ON CONFLICT DO NOTHING.
--   dim_date INSERT uses ON CONFLICT (full_date) DO NOTHING.
--   Safe to re-run without data loss.
--
-- REFRESH AGGREGATES after ETL loads:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_livraisons_journalieres;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_depenses_mensuelles;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_cout_total_mensuel;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_performance_livraison;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_masse_salariale_mensuelle;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_transport_mensuel;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_demande_transport;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_profitabilite_colis;
-- =============================================================================

-- ─── 0. Schema ───────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS warehouse;

SET search_path TO warehouse, public;

-- ─── 1. Staging Tables ───────────────────────────────────────────────────────
-- Mirror raw source data with no business transformations.
-- One staging table per API endpoint (+ stops and rubriques unpacked separately).

\i staging/stg_yalidine_wilayas.sql
\i staging/stg_yalidine_communes.sql
\i staging/stg_yalidine_centers.sql
\i staging/stg_yalidine_pricing.sql
\i staging/stg_yalidine_parcel_history.sql
\i staging/stg_hrforce_companies.sql
\i staging/stg_hrforce_agencies.sql
\i staging/stg_hrforce_occupations.sql
\i staging/stg_hrforce_users.sql
\i staging/stg_cashbox_natures.sql
\i staging/stg_cashbox_rubriques.sql
\i staging/stg_cashbox_depenses.sql
\i staging/stg_cashbox_paiements_livreurs.sql
\i staging/stg_cashbox_remboursements.sql
\i staging/stg_cashbox_transferts.sql
\i staging/stg_paie_bulletins.sql
\i staging/stg_transport_requests.sql
\i staging/stg_transport_stops.sql

-- ─── 2. Dimension Tables ─────────────────────────────────────────────────────
-- Load order respects foreign key dependencies.
-- SCD Type 2 dimensions: dim_agence, dim_employee.

-- 2a. Independent reference dimensions (no FK to other dims)
\i dimensions/dim_date.sql
\i dimensions/dim_company.sql
\i dimensions/dim_vehicle_type.sql
\i dimensions/dim_statut_colis.sql
\i dimensions/dim_nature_depense.sql

-- 2b. Geographic dimensions (wilaya → commune)
\i dimensions/dim_wilaya.sql
\i dimensions/dim_commune.sql

-- 2c. Occupation (depends on dim_company)
\i dimensions/dim_occupation.sql

-- 2d. Agence — SCD Type 2 (depends on dim_company, dim_wilaya, dim_commune)
\i dimensions/dim_agence.sql

-- 2e. Employee — SCD Type 2 (depends on dim_agence, dim_occupation, dim_company)
\i dimensions/dim_employee.sql

-- 2f. Freelance driver (depends on dim_agence)
\i dimensions/dim_freelance_driver.sql

-- ─── 3. Fact Tables ──────────────────────────────────────────────────────────
-- All facts depend on dimensions. Load after all dims are populated.

\i facts/fact_livraisons.sql
\i facts/fact_depenses.sql
\i facts/fact_remboursements.sql
\i facts/fact_paiements_livreurs.sql
\i facts/fact_bulletins_salaire.sql
\i facts/fact_transport.sql
\i facts/fact_transferts_caisse.sql

-- ─── 4. Aggregate Materialized Views ─────────────────────────────────────────
-- Created after facts. Initial WITH DATA populates them immediately.
-- Requires at least some fact data to compute; safe to run on empty facts.

\i aggregates/agg_livraisons_journalieres.sql
\i aggregates/agg_depenses_mensuelles.sql
\i aggregates/agg_cout_total_mensuel.sql
\i aggregates/agg_performance_livraison.sql
\i aggregates/agg_masse_salariale_mensuelle.sql
\i aggregates/agg_transport_mensuel.sql

-- Axis 1 — Transport Requests (Must have): origin-destination demand matrix
\i aggregates/agg_demande_transport.sql

-- Axis 2 — Parcel Cost Control (Should have): fee vs tariff deviation detection
\i aggregates/agg_profitabilite_colis.sql

-- ─── Axis 3 — Route Analysis (Could have) — NOT IMPLEMENTED ──────────────────
--
-- This axis would connect the DW to a route optimization solver (e.g. Google OR-Tools)
-- and present actual vs. optimized route comparisons.
--
-- When implemented, it would require:
--   New fact table   : fact_routes_optimisees
--     Grain          : one row per (optimization run × transport request)
--     Key measures   : distance_reel_km, distance_optimise_km, ecart_distance_km
--                      cout_reel_dzd, cout_optimise_dzd, economie_potentielle_dzd
--                      duree_reelle_min, duree_optimisee_min
--     New dimensions : dim_route (route definition: fixed corridor, recurring pattern)
--                      dim_optimization_run (solver run metadata, algorithm version)
--
--   New aggregate    : agg_optimisation_routes
--     Grain          : one row per (year, month, corridor wilaya_depart × wilaya_arrivee)
--     KPIs           : avg economies_km, avg economies_cout_dzd,
--                      taux_ecart_pct (actual vs optimal), nbr_runs
--
--   Integration note : OR-Tools output would be loaded via a dedicated ETL asset
--                      (Dagster op) after fact_transport is populated.
--                      stg_transport_stops already holds stop-level detail needed
--                      by the solver as input.
--
-- Plug-in point in this script (after existing aggregates, before Done):
--   \i facts/fact_routes_optimisees.sql
--   \i dimensions/dim_route.sql
--   \i aggregates/agg_optimisation_routes.sql
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Done ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'LOGIQ warehouse schema initialized successfully.';
    RAISE NOTICE '  Staging tables : 18';
    RAISE NOTICE '  Dimensions     : 11 (2 SCD Type 2)';
    RAISE NOTICE '  Fact tables    : 7  (fact_livraisons includes PCC measures)';
    RAISE NOTICE '  Aggregates     : 8 materialized views';
    RAISE NOTICE '  Axis 1 (Must)  : fact_transport + agg_transport_mensuel + agg_demande_transport';
    RAISE NOTICE '  Axis 2 (Should): fact_livraisons PCC + agg_profitabilite_colis';
    RAISE NOTICE '  Axis 3 (Could) : NOT IMPLEMENTED — see placeholder comment above';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Next step: run the Dagster ETL pipeline to load data.';
    RAISE NOTICE 'After loading, refresh aggregates with:';
    RAISE NOTICE '  REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_livraisons_journalieres;';
    RAISE NOTICE '  ... (see init.sql header for full list)';
END $$;
