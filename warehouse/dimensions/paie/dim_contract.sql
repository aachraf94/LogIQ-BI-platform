-- =============================================================================
-- DIMENSION: dim_contract
-- Grain     : One row per distinct contract configuration
-- Source    : stg_paie_bulletins (contract fields — hire_date, type, regime, hours)
-- ETL       : Must be loaded before dim_employee (employee.contract_key FK).
--             Dedup by (contract_type_id, regime_id, hire_date_id, work_hours_per_week).
-- Note      : seniority_months removed — it changes each month and belongs to
--             dim_bulletin (snapshot), not the contract definition.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_contract (
    contract_key         SERIAL        PRIMARY KEY,  -- surrogate (no single stable natural key)
    contract_type_id     SMALLINT      NOT NULL REFERENCES warehouse.dim_contract_type(contract_type_id),
    regime_id            SMALLINT      NOT NULL REFERENCES warehouse.dim_contract_regime(regime_id),
    hire_date_id         DATE          NOT NULL REFERENCES warehouse.dim_date(date_id),
    work_hours_per_week  DECIMAL(4,1)  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dim_contract_type  ON warehouse.dim_contract (contract_type_id);
CREATE INDEX IF NOT EXISTS idx_dim_contract_hire  ON warehouse.dim_contract (hire_date_id);
