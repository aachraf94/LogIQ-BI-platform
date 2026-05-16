-- =============================================================================
-- DIMENSION: dim_occupation
-- Grain   : One row per job title (~30 rows)
-- SCD     : None — occupation definitions are stable reference data
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_occupation (
    occupation_key      SERIAL          PRIMARY KEY,

    occupation_id       INTEGER         NOT NULL UNIQUE,            -- HRFORCE source PK
    occupation_name     VARCHAR(150)    NOT NULL,                   -- always UPPERCASE in source
    service_name        VARCHAR(150)    NOT NULL,                   -- e.g. Finance et Comptabilité
    department_name     VARCHAR(150)    NOT NULL,
    company_key         INTEGER         NOT NULL
                        REFERENCES warehouse.dim_company (company_key),

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.dim_occupation IS
    '~30 HRFORCE job titles. Loaded from real sample data. Stable reference.';

CREATE INDEX IF NOT EXISTS idx_dim_occupation_name ON warehouse.dim_occupation (occupation_name);
