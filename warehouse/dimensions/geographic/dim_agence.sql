-- =============================================================================
-- DIMENSION: dim_agence — SCD Type 2
-- Grain     : One row per agency version (~284 current + historical rows)
-- Source    : stg_hrforce_agencies
-- SCD2      : Tracked attributes: name, agency_type_id, address, commune_id
--             New version on change; is_current=FALSE on old version.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_agence (
    agence_key      SERIAL       PRIMARY KEY,            -- surrogate — required for SCD2
    agency_id       INTEGER      NOT NULL,               -- HRFORCE business key
    name            VARCHAR(200) NOT NULL,
    agency_type_id  SMALLINT     NOT NULL REFERENCES warehouse.dim_agency_type(agency_type_id),
    code            VARCHAR(30)  NOT NULL,
    address         VARCHAR(300),
    commune_id      INTEGER      REFERENCES warehouse.dim_commune(commune_id),
    company_id      INTEGER      NOT NULL REFERENCES warehouse.dim_company(company_id),
    valid_from      DATE         NOT NULL,
    valid_to        DATE,                                -- NULL = current version
    is_current      BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_dim_agence_current
    ON warehouse.dim_agence (agency_id) WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_dim_agence_agency_id  ON warehouse.dim_agence (agency_id);
CREATE INDEX IF NOT EXISTS idx_dim_agence_company    ON warehouse.dim_agence (company_id);
CREATE INDEX IF NOT EXISTS idx_dim_agence_commune    ON warehouse.dim_agence (commune_id);
