-- =============================================================================
-- STAGING: stg_yalidine_centers
-- Source : Yalidine App — GET /yalidine/centers
-- Grain  : One row per Yalidine operational center (253 rows)
-- Notes  : Refreshed periodically (every few hours per source API spec).
--          Existing rows are overwritten on each full refresh (SCD handled
--          at the dimension layer). Mirrors yalidine.centers exactly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_yalidine_centers (
    stg_id                  BIGSERIAL       PRIMARY KEY,

    -- Source natural key
    hub_id                  INTEGER         NOT NULL UNIQUE,        -- source PK (format: wilaya_id_padded + commune_seq)
    code                    VARCHAR(10)     NOT NULL,               -- short code e.g. ADR1, HUS1
    name                    VARCHAR(200)    NOT NULL,               -- full name including company tag
    company_id              INTEGER         NOT NULL,               -- FK → hrforce.companies.id (never 9)
    show_for_others         SMALLINT        NOT NULL DEFAULT 1,     -- Yalidine 0/1 boolean
    address                 VARCHAR(300),
    gps                     VARCHAR(60),                            -- "lat,lng" as a single string
    service_stopdesk        SMALLINT        NOT NULL DEFAULT 1,     -- 1 = offers stop desk
    service_depot_colis     SMALLINT        NOT NULL DEFAULT 1,     -- 1 = accepts parcel drop-off
    wilaya_id               SMALLINT        NOT NULL,               -- official Algerian wilaya code 1–58
    commune_id              INTEGER         NOT NULL,
    wilaya_name             VARCHAR(100)    NOT NULL,
    commune_name            VARCHAR(150)    NOT NULL,
    manager                 VARCHAR(150),

    -- ETL metadata
    loaded_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id                VARCHAR(50),
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_yalidine_centers IS
    'Staging for Yalidine operational centers. 253 rows loaded from real sample data.';
COMMENT ON COLUMN warehouse.stg_yalidine_centers.gps IS
    'GPS as a single "lat,lng" string — split at the ETL dimension load step.';
COMMENT ON COLUMN warehouse.stg_yalidine_centers.show_for_others IS
    'Yalidine 0/1 boolean: 1 = center is visible to other network companies.';

CREATE INDEX IF NOT EXISTS idx_stg_centers_wilaya    ON warehouse.stg_yalidine_centers (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_stg_centers_company   ON warehouse.stg_yalidine_centers (company_id);
