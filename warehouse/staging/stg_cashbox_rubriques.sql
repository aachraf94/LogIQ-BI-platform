-- =============================================================================
-- STAGING: stg_cashbox_rubriques
-- Source : Cash Box — GET /cashbox/natures (embedded rubriques arrays)
-- Grain  : One row per expense sub-category (~35 rows — static seed data)
-- Notes  : Rubriques are embedded inside the natures API response. They are
--          unpacked and staged separately for clean dimensional modeling.
--          Each rubrique belongs to exactly one nature.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_cashbox_rubriques (
    stg_id          BIGSERIAL       PRIMARY KEY,

    rubrique_id     INTEGER         NOT NULL UNIQUE,
    name            VARCHAR(150)    NOT NULL,
    nature_id       INTEGER         NOT NULL,                       -- parent nature FK

    -- ETL metadata
    loaded_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id        VARCHAR(50),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_cashbox_rubriques IS
    'Staging for ~35 Cash Box expense sub-categories (rubriques). Unpacked from natures response.';

CREATE INDEX IF NOT EXISTS idx_stg_rubriques_nature ON warehouse.stg_cashbox_rubriques (nature_id);
