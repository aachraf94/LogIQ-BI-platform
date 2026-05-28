-- =============================================================================
-- LOGIQ Data Warehouse — Master Initialization Script
-- Target   : PostgreSQL 17
-- Schema   : warehouse
-- Project  : LOGIQ BI Platform — Yalidine Express
-- =============================================================================
--
-- EXECUTION ORDER (respects full FK dependency chain):
--   0. Schema
--   1. Staging tables        (no inter-table FK dependencies)
--   2. Seeded enum dims      (no DW FK dependencies — loaded first)
--   3. Reference dims        (depend only on enum dims or on each other in order)
--   4. SCD2 and derived dims (depend on reference dims)
--   5. Cashbox dims          (2-pass ETL pattern — back-ref FKs added after)
--   6. Salary dims
--   7. Transport dims        (transport → stops order enforced)
--   8. Parcel dim
--   9. Fact tables           (depend on all dimensions)
--   10. Aggregate views      (defined separately — refresh after ETL)
--
-- USAGE:
--   psql -U <user> -d <database> -f warehouse/init.sql
--
-- RE-RUN SAFETY:
--   All CREATE TABLE statements use IF NOT EXISTS.
--   All seed INSERTs use ON CONFLICT DO NOTHING.
--   dim_date INSERT uses ON CONFLICT (date_id) DO NOTHING.
--   Safe to re-run without data loss.
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

-- ─── 2. Seeded Enum Dimensions ────────────────────────────────────────────────
-- No FK dependencies on other warehouse tables — loaded first.
-- Static seeds are inserted inline; dynamic dims are seeded by ETL.

-- Geographic
\i dimensions/geographic/dim_region.sql

-- Parcel
\i dimensions/parcel/dim_parcels_status.sql
\i dimensions/parcel/dim_parcel_type.sql
\i dimensions/parcel/dim_delivery_type.sql
\i dimensions/parcel/dim_zone.sql
\i dimensions/parcel/dim_pricing_service_type.sql

-- HR
\i dimensions/hr/dim_role.sql
\i dimensions/hr/dim_employee_status.sql
\i dimensions/hr/dim_livreur_vehicule_type.sql

-- Cashbox
\i dimensions/cashbox/dim_nature_category.sql
\i dimensions/cashbox/dim_depense_status.sql
\i dimensions/cashbox/dim_sinistre_type.sql

-- Salary / Paie
\i dimensions/paie/dim_contract_type.sql
\i dimensions/paie/dim_contract_regime.sql

-- Transport
\i dimensions/transport/dim_transport_status.sql
\i dimensions/transport/dim_transport_service_type.sql
\i dimensions/transport/dim_transport_sub_service_type.sql
\i dimensions/transport/dim_transport_payment_status.sql
\i dimensions/transport/dim_transport_merchandise_type.sql
\i dimensions/transport/dim_distance_category.sql
\i dimensions/transport/dim_complexity_category.sql
\i dimensions/transport/dim_location_type.sql
\i dimensions/transport/dim_stop_type.sql
\i dimensions/transport/dim_client_type.sql

-- ─── 3. Time Dimension ────────────────────────────────────────────────────────
-- Must exist before any dim with a DATE FK → dim_date.

\i dimensions/time/dim_date.sql

-- ─── 4. Reference Dimensions ─────────────────────────────────────────────────
-- Depend on enum dims and on each other in dependency order.

-- Company hierarchy (company → department → service → occupation)
\i dimensions/hr/dim_company.sql
\i dimensions/hr/dim_department.sql
\i dimensions/hr/dim_service.sql
\i dimensions/hr/dim_occupation.sql

-- Geographic hierarchy (region already seeded in step 2 → wilaya → commune)
\i dimensions/geographic/dim_wilaya.sql
\i dimensions/geographic/dim_commune.sql

-- Agency type (dynamically seeded by ETL — table created here)
\i dimensions/geographic/dim_agency_type.sql

-- Agency SCD2 (depends on dim_agency_type, dim_commune, dim_company)
\i dimensions/geographic/dim_agence.sql

-- Yalidine center (depends on dim_agence)
\i dimensions/geographic/dim_center.sql

-- Contract (must exist before dim_employee)
\i dimensions/paie/dim_contract.sql

-- Employee SCD2 (depends on dim_role, dim_employee_status, dim_agence, dim_company,
--                dim_occupation, dim_contract, dim_date)
\i dimensions/hr/dim_employee.sql

-- Freelance driver (depends on dim_livreur_vehicule_type, dim_agence)
\i dimensions/hr/dim_livreur_freelance.sql

-- Pricing (depends on dim_pricing_service_type, dim_wilaya, dim_date)
\i dimensions/parcel/dim_pricing.sql

-- ─── 5. Cashbox Dimensions (2-pass ETL) ──────────────────────────────────────
-- dim_depense is loaded first with NULL back-ref FKs (paiement_livreur_id,
-- remboursement_id). After dim_paiement_livreurs and dim_remboursement are created,
-- the deferred FK constraints are added and then the second-pass UPDATE fills them.

-- Cashbox reference dims
\i dimensions/cashbox/dim_nature.sql
\i dimensions/cashbox/dim_rubriques.sql

-- Step 41: dim_depense (back-ref FKs added later)
\i dimensions/cashbox/dim_depense.sql

-- Step 42–43: depends on dim_depense
\i dimensions/cashbox/dim_paiement_livreurs.sql
\i dimensions/cashbox/dim_remboursement.sql

-- Deferred FK constraints: dim_depense ↔ dim_paiement_livreurs / dim_remboursement
\i dimensions/cashbox/dim_depense_backref_fk.sql

-- ─── 6. Salary Dimensions ─────────────────────────────────────────────────────
-- dim_bulletin depends on dim_employee SCD2 and dim_contract.

\i dimensions/paie/dim_bulletin.sql

-- ─── 7. Transport Dimensions ──────────────────────────────────────────────────
-- dim_transport MUST be loaded before dim_transport_stops
-- (stops.transport_key FK → dim_transport).

\i dimensions/transport/dim_transport_client_company.sql
\i dimensions/transport/dim_transport_client.sql
\i dimensions/transport/dim_transport_vehicle_type.sql
\i dimensions/transport/dim_transport_vehicle.sql
\i dimensions/transport/dim_transport_cargo.sql
\i dimensions/transport/dim_transport_routing.sql
\i dimensions/transport/dim_transport_departure.sql
\i dimensions/transport/dim_transport_arrival.sql
\i dimensions/transport/dim_transport.sql
\i dimensions/transport/dim_transport_stops.sql

-- ─── 8. Express Service Parcel Dimension ─────────────────────────────────────
-- dim_parcel depends on dim_parcels_status, dim_delivery_type, dim_zone,
-- dim_parcel_type, dim_date, dim_center.

\i dimensions/parcel/dim_parcel.sql

-- ─── 9. Fact Tables ───────────────────────────────────────────────────────────
-- All facts depend on dimensions. Load only after all dims are populated.

\i facts/fact_parcel_revenue.sql
\i facts/fact_parcel_performance.sql
\i facts/fact_cost_salaire.sql
\i facts/fact_charges.sql
\i facts/fact_transport_cost.sql
\i facts/fact_transport_billing.sql
\i facts/fact_transport_performance.sql

-- ─── 10. Aggregate Materialized Views ────────────────────────────────────────
-- NOT IMPLEMENTED YET — aggregate SQL files pending.
-- Uncomment once aggregates/agg_*.sql files are created.

-- \i aggregates/agg_livraisons_journalieres.sql
-- \i aggregates/agg_depenses_mensuelles.sql
-- \i aggregates/agg_cout_total_mensuel.sql
-- \i aggregates/agg_performance_livraison.sql
-- \i aggregates/agg_masse_salariale_mensuelle.sql
-- \i aggregates/agg_transport_mensuel.sql
-- \i aggregates/agg_demande_transport.sql
-- \i aggregates/agg_profitabilite_colis.sql

-- ─── Axis 3 — Route Analysis (Could have) — NOT IMPLEMENTED ──────────────────
--
-- When implemented, requires:
--   New fact    : facts/fact_routes_optimisees.sql
--   New dims    : dimensions/dim_route.sql
--                 dimensions/dim_optimization_run.sql
--   New agg     : aggregates/agg_optimisation_routes.sql
--
-- stg_transport_stops already holds stop-level detail needed by the OR-Tools solver.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Done ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'LOGIQ warehouse schema initialized successfully.';
    RAISE NOTICE '  Staging tables : 18';
    RAISE NOTICE '  Dimensions     : 55 (2 SCD Type 2, 2 junk dims)';
    RAISE NOTICE '  Fact tables    : 7';
    RAISE NOTICE '  Aggregates     : 0 (pending — aggregate files not yet created)';
    RAISE NOTICE '  Financial perimeters: Express Service / On-Demand Transport';
    RAISE NOTICE '  Express cost tracks : Salary (fact_cost_salaire) /';
    RAISE NOTICE '                        Cashbox (fact_charges)';
    RAISE NOTICE '  Axis 3 (Could) : NOT IMPLEMENTED — see placeholder comment';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Next step: run the Dagster ETL pipeline to load data.';
    RAISE NOTICE 'Aggregates: create aggregates/agg_*.sql files then re-run phase 10.';
END $$;
