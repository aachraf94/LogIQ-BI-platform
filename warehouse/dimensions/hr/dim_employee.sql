-- =============================================================================
-- DIMENSION: dim_employee — SCD Type 2
-- Grain     : One row per employee version (~3 000 current + historical rows)
-- Source    : stg_hrforce_users
-- SCD2      : Tracked attributes: employee_status_id, role_id, agence_key,
--             occupation_id, contract_key
-- ETL notes :
--   hire_date_id  — stg_hrforce_users has no hire_date; ETL must JOIN
--                   stg_paie_bulletins ON employee_id to obtain hire_date.
--   occupation_id — stg_hrforce_users stores occupation_name (string, no ID).
--                   ETL resolves via lookup in dim_occupation on occupation_name.
--                   NULL occupation_name rows → occupation_id left NULL.
--   contract_key  — dim_contract must be loaded before dim_employee.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_employee (
    employee_key       SERIAL       PRIMARY KEY,  -- surrogate — required for SCD2
    employee_id        INTEGER      NOT NULL,     -- HRFORCE user_id = whois in parcel_history
    full_name          VARCHAR(200) NOT NULL,
    email              VARCHAR(150) NOT NULL,
    role_id            SMALLINT     NOT NULL REFERENCES warehouse.dim_role(role_id),
    employee_status_id SMALLINT     NOT NULL REFERENCES warehouse.dim_employee_status(employee_status_id),
    agence_key         INTEGER      REFERENCES warehouse.dim_agence(agence_key),
    company_id         INTEGER      NOT NULL REFERENCES warehouse.dim_company(company_id),  -- denormalized for query convenience
    occupation_id      INTEGER      REFERENCES warehouse.dim_occupation(occupation_id),
    contract_key       INTEGER      REFERENCES warehouse.dim_contract(contract_key),
    hire_date_id       DATE         NOT NULL REFERENCES warehouse.dim_date(date_id),
    valid_from         DATE         NOT NULL,
    valid_to           DATE,         -- NULL = current version
    is_current         BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_dim_employee_current
    ON warehouse.dim_employee (employee_id) WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_dim_employee_employee_id ON warehouse.dim_employee (employee_id);
CREATE INDEX IF NOT EXISTS idx_dim_employee_agence      ON warehouse.dim_employee (agence_key);
CREATE INDEX IF NOT EXISTS idx_dim_employee_company     ON warehouse.dim_employee (company_id);
CREATE INDEX IF NOT EXISTS idx_dim_employee_occupation  ON warehouse.dim_employee (occupation_id);
