-- =============================================================================
-- STAGING: stg_hrforce_companies
-- Source : HRFORCE — GET /hrforce/companies
-- Grain  : One row per company (9 rows in DB including TEST id=9)
-- Notes  : All 9 companies are staged including TEST (id=9). The ETL dimension
--          load step filters out id=9. Field name "adress" preserves the source
--          typo intentionally for schema fidelity.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_hrforce_companies (
    stg_id                  BIGSERIAL       PRIMARY KEY,

    company_id              INTEGER         NOT NULL UNIQUE,        -- source PK (1–9)
    license_number          VARCHAR(50)     NOT NULL,               -- short identifier e.g. YALIDINE, GUEPEX
    company_name            VARCHAR(100)    NOT NULL,               -- official French name
    arabic_company_name     VARCHAR(100),
    trade_name              VARCHAR(100),
    arabic_trade_name       VARCHAR(100),
    legal_type              VARCHAR(20),                            -- EURL, SARL
    register_number         VARCHAR(100),                           -- registre de commerce
    nif                     VARCHAR(30),                            -- numéro d'identification fiscale
    nis                     VARCHAR(30),                            -- numéro d'identification statistique
    ai                      VARCHAR(30),                            -- article d'imposition
    path_logo_front         VARCHAR(300),
    path_logo_back          VARCHAR(300),
    manager                 VARCHAR(150),
    arabic_manager          VARCHAR(150),
    email                   VARCHAR(150),
    contact_number          VARCHAR(30),
    adress                  VARCHAR(300),                           -- intentional source typo preserved
    arabic_address          VARCHAR(300),

    -- ETL metadata
    loaded_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id                VARCHAR(50),
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_hrforce_companies IS
    'Staging for HRFORCE companies. Includes TEST company (id=9) — filtered at dim load.';
COMMENT ON COLUMN warehouse.stg_hrforce_companies.adress IS
    'Source field name has a typo ("adress" instead of "address") — preserved intentionally.';
