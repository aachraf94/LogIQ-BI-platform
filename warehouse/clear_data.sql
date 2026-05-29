-- =============================================================================
-- LOGIQ Warehouse — Clear All ETL Data
--
-- Truncates every staging table, every ETL-managed dimension table, and every
-- fact table. Sequences are reset so the next ETL run starts from 1.
--
-- Tables PRESERVED (seeded by init.sql, never touched by ETL):
--   dim_date, dim_region, dim_delivery_type, dim_parcel_type, dim_zone,
--   dim_distance_category, dim_complexity_category
--
-- After running this script, re-run the full ETL pipeline from Dagster to
-- repopulate all staging, dimension, and fact tables.
--
-- Run (Docker, from logiq/):
--   docker compose exec -T warehouse-db \
--     psql -U logiq_warehouse_user -d logiq_warehouse < warehouse/clear_data.sql
--
-- Run (local, from logiq/):
--   psql -h localhost -p 5433 -U logiq_warehouse_user -d logiq_warehouse \
--     -f warehouse/clear_data.sql
-- =============================================================================

SET search_path TO warehouse, public;

BEGIN;

-- ─── Facts ───────────────────────────────────────────────────────────────────
-- Truncated first so their FKs into dims are removed before dims are cleared.

TRUNCATE
    fact_parcel_revenue,
    fact_parcel_performance,
    fact_cost_salaire,
    fact_charges,
    fact_transport_cost,
    fact_transport_billing,
    fact_transport_performance
RESTART IDENTITY CASCADE;

-- ─── Parcel dimension ────────────────────────────────────────────────────────

TRUNCATE dim_parcel RESTART IDENTITY CASCADE;

-- dim_parcels_status: ETL-managed enum (21 known statuses + any new ones added
-- at runtime). Cleared here so ETL re-seeds it cleanly on the next run.
-- If you need the seed data back immediately without running ETL, re-run init.sql.
TRUNCATE dim_parcels_status RESTART IDENTITY CASCADE;

-- ─── Transport dimensions ─────────────────────────────────────────────────────
-- Stops must be cleared before dim_transport (stops.transport_key → dim_transport).

TRUNCATE
    dim_transport_stops,
    dim_transport,
    dim_transport_departure,
    dim_transport_arrival,
    dim_transport_cargo,
    dim_transport_routing,
    dim_transport_vehicle,
    dim_transport_client,
    dim_transport_client_company
RESTART IDENTITY CASCADE;

-- ETL-populated transport enum dims
TRUNCATE
    dim_transport_vehicle_type,
    dim_transport_service_type,
    dim_transport_sub_service_type,
    dim_transport_status,
    dim_transport_payment_status,
    dim_transport_merchandise_type,
    dim_location_type,
    dim_stop_type,
    dim_client_type
RESTART IDENTITY CASCADE;

-- ─── Salary dimensions ────────────────────────────────────────────────────────

TRUNCATE dim_bulletin RESTART IDENTITY CASCADE;

-- ─── Cashbox dimensions (2-pass, circular FK) ─────────────────────────────────
-- The deferred FK constraints dim_depense ↔ dim_paiement_livreurs and
-- dim_depense ↔ dim_remboursement are circular. Truncating all three in a single
-- statement lets PostgreSQL resolve the constraint cycle atomically.

TRUNCATE
    dim_paiement_livreurs,
    dim_remboursement,
    dim_depense
RESTART IDENTITY CASCADE;

-- ETL-populated cashbox enum dims
TRUNCATE
    dim_sinistre_type,
    dim_depense_status,
    dim_rubriques,
    dim_nature,
    dim_nature_category
RESTART IDENTITY CASCADE;

-- ─── HR / Contract dimensions ─────────────────────────────────────────────────

TRUNCATE dim_livreur_freelance  RESTART IDENTITY CASCADE;
TRUNCATE dim_employee           RESTART IDENTITY CASCADE;  -- SCD2 — all versions cleared
TRUNCATE dim_contract           RESTART IDENTITY CASCADE;

-- ETL-populated HR enum dims
TRUNCATE
    dim_role,
    dim_employee_status,
    dim_livreur_vehicule_type,
    dim_contract_type,
    dim_contract_regime
RESTART IDENTITY CASCADE;

-- ─── Geographic dimensions ────────────────────────────────────────────────────

TRUNCATE dim_pricing            RESTART IDENTITY CASCADE;
TRUNCATE dim_center             RESTART IDENTITY CASCADE;
TRUNCATE dim_agence             RESTART IDENTITY CASCADE;  -- SCD2 — all versions cleared
TRUNCATE dim_commune            RESTART IDENTITY CASCADE;
TRUNCATE dim_wilaya             RESTART IDENTITY CASCADE;
TRUNCATE dim_agency_type        RESTART IDENTITY CASCADE;

-- ETL-populated pricing enum dim
TRUNCATE dim_pricing_service_type RESTART IDENTITY CASCADE;

-- Org hierarchy
TRUNCATE dim_occupation         RESTART IDENTITY CASCADE;
TRUNCATE dim_service            RESTART IDENTITY CASCADE;
TRUNCATE dim_department         RESTART IDENTITY CASCADE;
TRUNCATE dim_company            RESTART IDENTITY CASCADE;

-- ─── Staging tables ───────────────────────────────────────────────────────────
-- Cleared last — no other warehouse table references staging.

TRUNCATE
    stg_yalidine_parcel_history,
    stg_yalidine_pricing,
    stg_yalidine_centers,
    stg_yalidine_communes,
    stg_yalidine_wilayas,
    stg_hrforce_companies,
    stg_hrforce_agencies,
    stg_hrforce_users,
    stg_hrforce_occupations,
    stg_cashbox_natures,
    stg_cashbox_rubriques,
    stg_cashbox_depenses,
    stg_cashbox_paiements_livreurs,
    stg_cashbox_remboursements,
    stg_cashbox_transferts,
    stg_paie_bulletins,
    stg_transport_requests,
    stg_transport_stops
RESTART IDENTITY CASCADE;

COMMIT;

-- ─── Confirmation ─────────────────────────────────────────────────────────────

\echo ''
\echo 'Warehouse data cleared. Preserved: dim_date, dim_region, dim_delivery_type,'
\echo '  dim_parcel_type, dim_zone, dim_distance_category, dim_complexity_category.'
\echo ''
\echo 'Re-run the full ETL pipeline from Dagster to repopulate all tables.'
\echo ''
