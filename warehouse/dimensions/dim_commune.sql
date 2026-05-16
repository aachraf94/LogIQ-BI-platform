-- =============================================================================
-- DIMENSION: dim_commune
-- Grain   : One row per Algerian commune (~1 500 rows)
-- SCD     : None — commune boundaries are stable reference data
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_commune (
    commune_key     SERIAL          PRIMARY KEY,

    commune_id      INTEGER         NOT NULL UNIQUE,                -- real commune numeric ID from Yalidine
    nom             VARCHAR(150)    NOT NULL,                       -- commune name in French
    wilaya_key      INTEGER         NOT NULL                        -- FK → dim_wilaya
                    REFERENCES warehouse.dim_wilaya (wilaya_key),
    wilaya_id       SMALLINT        NOT NULL,                       -- denormalized for direct joins
    code_postal     VARCHAR(10),
    has_stop_desk   BOOLEAN         NOT NULL DEFAULT FALSE,         -- at least one Yalidine center with SD

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.dim_commune IS
    '~1 500 Algerian communes. Loaded from real Yalidine sample data.';
COMMENT ON COLUMN warehouse.dim_commune.wilaya_id IS
    'Denormalized wilaya_id for direct filtering without joining dim_wilaya.';

CREATE INDEX IF NOT EXISTS idx_dim_commune_id       ON warehouse.dim_commune (commune_id);
CREATE INDEX IF NOT EXISTS idx_dim_commune_wilaya   ON warehouse.dim_commune (wilaya_key);
CREATE INDEX IF NOT EXISTS idx_dim_commune_wid      ON warehouse.dim_commune (wilaya_id);
