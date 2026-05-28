-- =============================================================================
-- DIMENSION: dim_wilaya
-- Grain     : One row per Algerian wilaya (58 rows)
-- Source    : stg_yalidine_wilayas + static region mapping applied by ETL
-- ETL       : INSERT ... ON CONFLICT (wilaya_id) DO UPDATE SET wilaya_name, region_id
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_wilaya (
    wilaya_id   SMALLINT      PRIMARY KEY,   -- official Algerian code 1–58
    wilaya_name VARCHAR(100)  NOT NULL,
    region_id   SMALLINT      NOT NULL REFERENCES warehouse.dim_region(region_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_wilaya_region ON warehouse.dim_wilaya (region_id);
