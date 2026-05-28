-- =============================================================================
-- DIMENSION: dim_bulletin
-- Grain     : One row per payslip — one per employee per month (~108 K rows)
-- Source    : stg_paie_bulletins
-- ETL       : Resolve employee_key from dim_employee SCD2 (is_current=TRUE or
--             version valid at payment_date). Resolve contract_key from dim_contract.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_bulletin (
    bulletin_id      VARCHAR(50)  PRIMARY KEY,   -- PAY-YYYY-MM-{employee_id} — natural key
    period_month     SMALLINT     NOT NULL,       -- 1–12
    period_year      SMALLINT     NOT NULL,
    payment_date_id  DATE         NOT NULL REFERENCES warehouse.dim_date(date_id),
    seniority_months SMALLINT     NOT NULL,       -- total months of seniority at this payslip
    employee_key     INTEGER      NOT NULL REFERENCES warehouse.dim_employee(employee_key),
    contract_key     INTEGER      NOT NULL REFERENCES warehouse.dim_contract(contract_key),

    CONSTRAINT uq_bulletin_employee_period UNIQUE (employee_key, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_dim_bulletin_employee ON warehouse.dim_bulletin (employee_key);
CREATE INDEX IF NOT EXISTS idx_dim_bulletin_period   ON warehouse.dim_bulletin (period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_dim_bulletin_contract ON warehouse.dim_bulletin (contract_key);
