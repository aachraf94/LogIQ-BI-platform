-- =============================================================================
-- DIMENSION: dim_commune
-- Grain     : One row per commune (~1 500 rows)
-- Source    : stg_yalidine_communes
-- ETL       : INSERT ... ON CONFLICT (commune_id) DO UPDATE SET nom, code_postal, has_stop_desk, wilaya_id
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_commune (
    commune_id    INTEGER       PRIMARY KEY,  -- source commune numeric ID
    nom           VARCHAR(150)  NOT NULL,
    code_postal   VARCHAR(10),
    has_stop_desk BOOLEAN       NOT NULL DEFAULT FALSE,
    wilaya_id     SMALLINT      NOT NULL REFERENCES warehouse.dim_wilaya(wilaya_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_commune_wilaya ON warehouse.dim_commune (wilaya_id);
