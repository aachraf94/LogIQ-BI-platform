-- =============================================================================
-- DIMENSION: dim_department
-- Grain     : One row per HRFORCE department (~8 rows)
-- Source    : stg_hrforce_occupations (distinct department fields)
-- ETL       : INSERT ... ON CONFLICT (department_id) DO UPDATE SET department_name, company_id
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_department (
    department_id   INTEGER       PRIMARY KEY,  -- HRFORCE source PK — stable
    department_name VARCHAR(150)  NOT NULL,
    company_id      INTEGER       NOT NULL REFERENCES warehouse.dim_company(company_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_department_company ON warehouse.dim_department (company_id);
