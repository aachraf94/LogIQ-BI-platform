-- =============================================================================
-- DIMENSION: dim_wilaya
-- Grain   : One row per Algerian province (58 wilayas)
-- SCD     : None — wilaya boundaries and names are stable government data
-- Notes   : Region classification (Nord / Hauts Plateaux / Sud) is derived
--           from business_rules.md section 4.4 and added as an analytics attribute.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_wilaya (
    wilaya_key      SERIAL          PRIMARY KEY,

    wilaya_id       SMALLINT        NOT NULL UNIQUE,                -- official Algerian code 1–58
    wilaya_name     VARCHAR(100)    NOT NULL,

    -- Analytics classification (derived from geographic position)
    region          VARCHAR(20)     NOT NULL                        -- Nord, Hauts Plateaux, Sud
                    CHECK (region IN ('Nord', 'Hauts Plateaux', 'Sud')),

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.dim_wilaya IS
    '58 Algerian provinces. Region column enables zone-based cost analysis.';
COMMENT ON COLUMN warehouse.dim_wilaya.region IS
    'Nord: coastal + northern wilayas. Hauts Plateaux: inland plateau. Sud: Saharan wilayas (49–58).';

CREATE INDEX IF NOT EXISTS idx_dim_wilaya_id     ON warehouse.dim_wilaya (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_dim_wilaya_region ON warehouse.dim_wilaya (region);
