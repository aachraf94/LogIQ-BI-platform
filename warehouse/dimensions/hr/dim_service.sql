-- =============================================================================
-- DIMENSION: dim_service
-- Grain     : One row per HRFORCE service (~18 rows)
-- Source    : stg_hrforce_occupations (distinct service fields)
-- ETL       : INSERT ... ON CONFLICT (service_id) DO UPDATE SET service_name, department_id
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_service (
    service_id    INTEGER       PRIMARY KEY,  -- HRFORCE source PK — stable
    service_name  VARCHAR(150)  NOT NULL,
    department_id INTEGER       NOT NULL REFERENCES warehouse.dim_department(department_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_service_department ON warehouse.dim_service (department_id);
