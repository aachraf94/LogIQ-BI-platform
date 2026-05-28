-- =============================================================================
-- DIMENSION: dim_employee_status
-- Grain     : One row per HRFORCE employee status (2 rows — static seed)
-- Source    : Static — defined by HRFORCE status enum
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_employee_status (
    employee_status_id SMALLINT     PRIMARY KEY,
    status_name        VARCHAR(30)  NOT NULL
);

INSERT INTO warehouse.dim_employee_status (employee_status_id, status_name) VALUES
    (1, 'Actif'),
    (2, 'Inactif')
ON CONFLICT (employee_status_id) DO NOTHING;
