-- =============================================================================
-- DIMENSION: dim_transport_client_company
-- Grain     : One row per transport client company
-- Source    : stg_transport_requests (DISTINCT client_company_id / client_company_name)
-- ETL       : INSERT ... ON CONFLICT (client_company_id) DO UPDATE SET client_company_name
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_client_company (
    client_company_id   INTEGER       PRIMARY KEY,  -- source client_company_id
    client_company_name VARCHAR(150)  NOT NULL
);
