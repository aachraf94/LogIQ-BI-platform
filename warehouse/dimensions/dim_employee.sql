-- =============================================================================
-- DIMENSION: dim_employee
-- Grain   : One SCD row per (employee, time period)
-- SCD     : Type 2 — tracks changes to status, agency, occupation, and role
-- Notes   : employee_id is the natural business key, stable across SCD versions.
--           The same employee_id can appear in multiple rows with different
--           valid_from / valid_to ranges as their status/agency/occupation changes.
--           Fact tables join using employee_key (surrogate), not employee_id.
--           Sensitive fields (password, CIN, NSS, RIB) are NEVER loaded here.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_employee (
    employee_key        BIGSERIAL       PRIMARY KEY,

    -- Natural / business key
    employee_id         INTEGER         NOT NULL,                   -- HRFORCE user.id (= whois in parcel_history)

    -- Stable attributes (same across all SCD versions)
    family_name         VARCHAR(100)    NOT NULL,
    first_name          VARCHAR(100)    NOT NULL,
    full_name           VARCHAR(200)    NOT NULL,                   -- computed: family_name || ' ' || first_name
    email               VARCHAR(150)    NOT NULL,
    employee_code       VARCHAR(50)     NOT NULL,                   -- format: {id}-{FAMILYNAME}

    -- Tracked attributes (SCD Type 2 — changes create a new row)
    status              VARCHAR(20)     NOT NULL
                        CHECK (status IN ('Actif', 'Inactif')),
    role                VARCHAR(30)     NOT NULL
                        CHECK (role IN ('Employé', 'Manager', 'Admin')),
    is_supervisor       BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Agency at this point in time
    agence_key          BIGINT
                        REFERENCES warehouse.dim_agence (agence_key), -- nullable: some employees have no agency
    agence_id           INTEGER,                                    -- denormalized for direct filtering

    -- Occupation at this point in time
    occupation_key      INTEGER
                        REFERENCES warehouse.dim_occupation (occupation_key),
    occupation_name     VARCHAR(150),                               -- denormalized

    -- Company (stable — employees don't change company)
    company_key         INTEGER         NOT NULL
                        REFERENCES warehouse.dim_company (company_key),
    company_id          INTEGER         NOT NULL,                   -- denormalized

    -- SCD Type 2 tracking columns
    valid_from          DATE            NOT NULL DEFAULT CURRENT_DATE,
    valid_to            DATE,                                       -- NULL = currently active record
    is_current          BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.dim_employee IS
    'SCD Type 2 dimension for ~3 000 employees. Tracks status, agency, and occupation changes.';
COMMENT ON COLUMN warehouse.dim_employee.employee_id IS
    'Stable HRFORCE user ID. Same as "whois" in parcel history and employee_id in payslips.';
COMMENT ON COLUMN warehouse.dim_employee.is_current IS
    'TRUE for the active SCD version. Join facts on employee_key, not employee_id.';
COMMENT ON COLUMN warehouse.dim_employee.agence_key IS
    'Points to the is_current=TRUE row of dim_agence for the employee''s agency at this time.';

-- Only one current row per employee_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_dim_emp_current
    ON warehouse.dim_employee (employee_id) WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_dim_emp_id          ON warehouse.dim_employee (employee_id);
CREATE INDEX IF NOT EXISTS idx_dim_emp_agence      ON warehouse.dim_employee (agence_key);
CREATE INDEX IF NOT EXISTS idx_dim_emp_company     ON warehouse.dim_employee (company_key);
CREATE INDEX IF NOT EXISTS idx_dim_emp_occupation  ON warehouse.dim_employee (occupation_key);
CREATE INDEX IF NOT EXISTS idx_dim_emp_status      ON warehouse.dim_employee (status);
CREATE INDEX IF NOT EXISTS idx_dim_emp_is_current  ON warehouse.dim_employee (is_current);
CREATE INDEX IF NOT EXISTS idx_dim_emp_valid       ON warehouse.dim_employee (valid_from, valid_to);
