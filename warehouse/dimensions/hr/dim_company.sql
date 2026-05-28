-- =============================================================================
-- DIMENSION: dim_company
-- Grain     : One row per HRFORCE company (10 rows, TEST company_id=9 excluded)
-- Source    : stg_hrforce_companies (WHERE company_id != 9)
-- ETL       : INSERT ... ON CONFLICT (company_id) DO UPDATE SET company_name
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_company (
    company_id   INTEGER       PRIMARY KEY,  -- HRFORCE source PK — stable
    company_name VARCHAR(100)  NOT NULL
);
