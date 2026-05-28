-- =============================================================================
-- DIMENSION: dim_agency_type
-- Grain     : One row per HRFORCE agency type (9 rows)
-- Source    : stg_hrforce_agencies (SELECT DISTINCT type) + is_operational flag added by ETL
-- ETL       : INSERT ... ON CONFLICT (agency_type) DO UPDATE SET is_operational
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_agency_type (
    agency_type_id SMALLSERIAL  PRIMARY KEY,
    agency_type    VARCHAR(50)  UNIQUE NOT NULL,
    is_operational BOOLEAN      NOT NULL  -- TRUE for Hub, Agence, Centre de tri, Corner
);
