-- =============================================================================
-- DIMENSION: dim_occupation
-- Grain     : One row per HRFORCE job title (~30 rows)
-- Source    : stg_hrforce_occupations
-- ETL       : INSERT ... ON CONFLICT (occupation_id) DO UPDATE SET occupation_name, service_id
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_occupation (
    occupation_id   INTEGER       PRIMARY KEY,  -- HRFORCE source PK — stable
    occupation_name VARCHAR(150)  NOT NULL,     -- always UPPERCASE in source
    service_id      INTEGER       NOT NULL REFERENCES warehouse.dim_service(service_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_occupation_service ON warehouse.dim_occupation (service_id);
