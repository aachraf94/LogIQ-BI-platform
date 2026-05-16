-- =============================================================================
-- STAGING: stg_hrforce_occupations
-- Source : HRFORCE — GET /hrforce/occupations
-- Grain  : One row per job title (~30 rows)
-- Notes  : Static reference data loaded from real sample file.
--          Nested service + department + company objects are flattened.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_hrforce_occupations (
    stg_id              BIGSERIAL       PRIMARY KEY,

    occupation_id       INTEGER         NOT NULL UNIQUE,            -- source PK
    name                VARCHAR(150)    NOT NULL,                   -- always UPPERCASE in source
    arabic_name         VARCHAR(150),
    trial_period        SMALLINT,                                   -- days; typically 90

    -- Flattened service
    service_id          INTEGER         NOT NULL,
    service_name        VARCHAR(150)    NOT NULL,

    -- Flattened department
    department_id       INTEGER         NOT NULL,
    department_name     VARCHAR(150)    NOT NULL,

    -- Flattened company
    company_id          INTEGER         NOT NULL,

    -- ETL metadata
    loaded_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id            VARCHAR(50),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_hrforce_occupations IS
    'Staging for ~30 HRFORCE job titles. Loaded from real sample data.';
