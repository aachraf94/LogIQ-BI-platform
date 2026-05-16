-- =============================================================================
-- STAGING: stg_yalidine_communes
-- Source : Yalidine App — GET /yalidine/communes
-- Grain  : One row per commune (~1 500 rows)
-- Notes  : API returns a dict keyed by positional index — the dict key is
--          meaningless; commune_id is extracted from the inner object key
--          in the real sample file. Loaded from real sample data.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_yalidine_communes (
    stg_id          BIGSERIAL       PRIMARY KEY,

    commune_id      INTEGER         NOT NULL UNIQUE,                -- real commune numeric ID (sample file dict key)
    nom             VARCHAR(150)    NOT NULL,                       -- commune name in French
    wilaya_id       SMALLINT        NOT NULL,                       -- parent wilaya 1–58
    code_postal     VARCHAR(10),                                    -- Algerian postal code
    has_stop_desk   SMALLINT        NOT NULL DEFAULT 0,             -- 1 = at least one center with SD

    -- ETL metadata
    loaded_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id        VARCHAR(50),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_yalidine_communes IS
    'Staging for ~1 500 Algerian communes. Loaded from real Yalidine sample data.';
COMMENT ON COLUMN warehouse.stg_yalidine_communes.has_stop_desk IS
    'Pre-computed in the source sample: 1 if any center in this commune offers stop desk.';

CREATE INDEX IF NOT EXISTS idx_stg_communes_wilaya ON warehouse.stg_yalidine_communes (wilaya_id);
