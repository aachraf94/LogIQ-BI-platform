-- =============================================================================
-- DIMENSION: dim_role
-- Grain     : One row per HRFORCE role (3 rows — static seed)
-- Source    : Static — defined by HRFORCE role enum
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_role (
    role_id   SMALLINT     PRIMARY KEY,
    role_name VARCHAR(30)  NOT NULL
);

INSERT INTO warehouse.dim_role (role_id, role_name) VALUES
    (1, 'Employé'),
    (2, 'Manager'),
    (3, 'Admin')
ON CONFLICT (role_id) DO NOTHING;
