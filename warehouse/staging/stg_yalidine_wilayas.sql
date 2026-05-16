-- =============================================================================
-- STAGING: stg_yalidine_wilayas
-- Source : Yalidine App — GET /yalidine/wilayas
-- Grain  : One row per Algerian wilaya (58 rows — flat array)
-- Notes  : Static reference data loaded from real sample file. Never regenerated.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_yalidine_wilayas (
    stg_id          BIGSERIAL       PRIMARY KEY,

    wilaya_id       SMALLINT        NOT NULL UNIQUE,                -- official Algerian code 1–58
    wilaya_name     VARCHAR(100)    NOT NULL,                       -- name in French

    -- ETL metadata
    loaded_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id        VARCHAR(50),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_yalidine_wilayas IS
    'Staging for the 58 Algerian wilayas. Loaded from real Yalidine sample data.';
