-- =============================================================================
-- DIMENSION: dim_company
-- Grain   : One row per Yalidine network company (8 rows — excludes TEST id=9)
-- SCD     : None — company legal structure is stable over the dataset period
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_company (
    company_key     SERIAL          PRIMARY KEY,

    company_id      INTEGER         NOT NULL UNIQUE                 -- source HRFORCE id (1–8, never 9)
                    CHECK (company_id != 9),
    license_name    VARCHAR(50)     NOT NULL,                       -- e.g. YALIDINE, GUEPEX
    company_name    VARCHAR(100)    NOT NULL,                       -- official legal name
    legal_type      VARCHAR(20),                                    -- EURL, SARL
    manager         VARCHAR(150),
    email           VARCHAR(150),

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.dim_company IS
    '8 Yalidine network subsidiary companies. TEST company (id=9) is permanently excluded.';
COMMENT ON COLUMN warehouse.dim_company.company_id IS
    'CHECK (company_id != 9) enforces the business rule that TEST company never enters the DW.';

CREATE INDEX IF NOT EXISTS idx_dim_company_id ON warehouse.dim_company (company_id);
