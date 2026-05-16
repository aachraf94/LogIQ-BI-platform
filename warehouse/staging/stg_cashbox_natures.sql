-- =============================================================================
-- STAGING: stg_cashbox_natures
-- Source : Cash Box — GET /cashbox/natures (natures portion)
-- Grain  : One row per expense nature (13 rows — static seed data)
-- Notes  : The /cashbox/natures endpoint returns natures with embedded
--          rubriques arrays. Natures and rubriques are staged separately.
--          See stg_cashbox_rubriques.sql for the child records.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_cashbox_natures (
    stg_id              BIGSERIAL       PRIMARY KEY,

    nature_id           INTEGER         NOT NULL UNIQUE,
    name                VARCHAR(100)    NOT NULL,
    arabic_name         VARCHAR(100),
    category_group      VARCHAR(50)     NOT NULL,                   -- Exploitation, Maintenance parc, Sinistres, etc.

    -- ETL metadata
    loaded_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id            VARCHAR(50),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_cashbox_natures IS
    'Staging for 13 Cash Box expense natures (categories). Static seed data.';
COMMENT ON COLUMN warehouse.stg_cashbox_natures.category_group IS
    'High-level grouping for dashboard cost breakdown: Exploitation, Immobilier, RH, Financier, etc.';
