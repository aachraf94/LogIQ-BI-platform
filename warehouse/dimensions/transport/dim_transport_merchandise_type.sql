-- =============================================================================
-- DIMENSION: dim_transport_merchandise_type
-- Grain     : One row per merchandise type (dynamically loaded)
-- Source    : stg_transport_requests (SELECT DISTINCT merchandise_type WHERE NOT NULL)
-- ETL       : INSERT ... ON CONFLICT (merchandise_type) DO NOTHING
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_merchandise_type (
    merchandise_type_id SMALLSERIAL   PRIMARY KEY,
    merchandise_type    VARCHAR(100)  UNIQUE NOT NULL  -- electronique, alimentaire, textile…
);
