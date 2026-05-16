-- =============================================================================
-- STAGING: stg_hrforce_agencies
-- Source : HRFORCE — GET /hrforce/agencies
-- Grain  : One row per HRFORCE agency (284 rows)
-- Notes  : Nested city + state objects are flattened at staging load time.
--          code_yal contains the Yalidine hub_id as a string for operational
--          agencies; empty string "" for non-operational types (Direction, Parc…).
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_hrforce_agencies (
    stg_id              BIGSERIAL       PRIMARY KEY,

    agency_id           INTEGER         NOT NULL UNIQUE,            -- HRFORCE agency PK
    name                VARCHAR(200)    NOT NULL,                   -- full name with company tag
    type                VARCHAR(50)     NOT NULL,                   -- Agence, Hub, Centre de tri, Corner, etc.
    code                VARCHAR(30)     NOT NULL,                   -- HRFORCE code: {seq}-{zipCode}
    code_yal            VARCHAR(20),                                -- Yalidine hub_id as string; "" if non-operational
    code_yal_two        VARCHAR(10),                                -- short code e.g. HUS1
    address             VARCHAR(300),
    created_at_src      TIMESTAMP,                                  -- source createdAt (ISO 8601)
    updated_at_src      TIMESTAMP,                                  -- source updateAt (note: source typo)

    -- Flattened company
    company_id          INTEGER         NOT NULL,                   -- FK → hrforce.companies.id
    company_name        VARCHAR(100)    NOT NULL,

    -- Flattened city
    city_id             INTEGER         NOT NULL,
    city_zip            INTEGER         NOT NULL,
    city_latin          VARCHAR(150)    NOT NULL,
    city_arabic         VARCHAR(150),
    city_code_yal       VARCHAR(10),                                -- commune code in Yalidine system

    -- Flattened state (wilaya)
    state_id            INTEGER         NOT NULL,
    state_code          VARCHAR(5)      NOT NULL,                   -- wilaya number as string e.g. "16"
    state_latin         VARCHAR(100)    NOT NULL,
    state_arabic        VARCHAR(100),

    -- ETL metadata
    loaded_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id            VARCHAR(50),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_hrforce_agencies IS
    'Staging for 284 HRFORCE agencies. City and state nested objects are flattened.';
COMMENT ON COLUMN warehouse.stg_hrforce_agencies.code_yal IS
    'Yalidine hub_id as string. Cast to INTEGER to join with stg_yalidine_centers.hub_id. Empty string means non-operational.';
COMMENT ON COLUMN warehouse.stg_hrforce_agencies.state_code IS
    'Wilaya number as VARCHAR from source — must be CAST to SMALLINT for geographic joins.';

CREATE INDEX IF NOT EXISTS idx_stg_agencies_company   ON warehouse.stg_hrforce_agencies (company_id);
CREATE INDEX IF NOT EXISTS idx_stg_agencies_state     ON warehouse.stg_hrforce_agencies (state_code);
CREATE INDEX IF NOT EXISTS idx_stg_agencies_type      ON warehouse.stg_hrforce_agencies (type);
CREATE INDEX IF NOT EXISTS idx_stg_agencies_code_yal  ON warehouse.stg_hrforce_agencies (code_yal);
