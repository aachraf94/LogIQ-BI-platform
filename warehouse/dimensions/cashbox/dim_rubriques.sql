-- =============================================================================
-- DIMENSION: dim_rubriques
-- Grain     : One row per cashbox expense sub-category (~35 rows)
-- Source    : stg_cashbox_rubriques
-- ETL       : INSERT ... ON CONFLICT (rubrique_id) DO UPDATE SET rubrique_name, nature_id
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_rubriques (
    rubrique_id   INTEGER       PRIMARY KEY,  -- Cashbox source rubrique_id — natural key
    rubrique_name VARCHAR(150)  NOT NULL,
    nature_id     INTEGER       NOT NULL REFERENCES warehouse.dim_nature(nature_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_rubriques_nature ON warehouse.dim_rubriques (nature_id);
