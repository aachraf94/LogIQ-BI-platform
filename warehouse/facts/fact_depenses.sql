-- =============================================================================
-- FACT: fact_depenses
-- Grain  : One row per validated or pending expense record
-- Source : stg_cashbox_depenses
-- Notes  : Fund transfers (stg_cashbox_transferts) are a separate fact table
--          and must NEVER be mixed with this table in cost calculations.
--          Only status = 'validée' expenses contribute to actual cost KPIs;
--          'en_attente' and 'rejetée' are retained for workflow analysis.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_depenses (
    depense_key                 BIGSERIAL       PRIMARY KEY,

    -- Date dimension keys
    date_depense_key            INTEGER         NOT NULL
                                REFERENCES warehouse.dim_date (date_key),
    date_creation_key           INTEGER         NOT NULL
                                REFERENCES warehouse.dim_date (date_key),

    -- Dimension keys
    agence_key                  BIGINT          NOT NULL
                                REFERENCES warehouse.dim_agence (agence_key),
    company_key                 INTEGER         NOT NULL
                                REFERENCES warehouse.dim_company (company_key),
    nature_depense_key          INTEGER         NOT NULL
                                REFERENCES warehouse.dim_nature_depense (nature_depense_key),

    -- Employee keys (nullable — BRQ may be absent for old records)
    employee_requester_key      BIGINT
                                REFERENCES warehouse.dim_employee (employee_key),
    employee_validator_key      BIGINT
                                REFERENCES warehouse.dim_employee (employee_key),

    -- Degenerate dimensions
    depense_id                  VARCHAR(50)     NOT NULL UNIQUE,    -- DEP-{YYYY}-{MM}-{NNNNNN}
    status                      VARCHAR(20)     NOT NULL
                                CHECK (status IN ('en_attente', 'validée', 'rejetée')),
    mode_paiement               VARCHAR(20)     NOT NULL
                                CHECK (mode_paiement IN ('espèces', 'virement', 'chèque')),

    -- Measures
    montant                     NUMERIC(15,2)   NOT NULL,           -- DZD
    quantite                    NUMERIC(10,3),                      -- optional quantity (litres, km, units…)

    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.fact_depenses IS
    'Operational expense fact table. ~500K rows at full scale. Excludes fund transfers.';
COMMENT ON COLUMN warehouse.fact_depenses.status IS
    'Filter on status = ''validée'' for actual cost KPIs. ''rejetée'' records should be excluded from cost sums.';
COMMENT ON COLUMN warehouse.fact_depenses.montant IS
    'Expense amount in DZD. Always positive. Only meaningful for cost analysis when status = ''validée''.';

CREATE INDEX IF NOT EXISTS idx_fd_date_depense  ON warehouse.fact_depenses (date_depense_key);
CREATE INDEX IF NOT EXISTS idx_fd_agence        ON warehouse.fact_depenses (agence_key);
CREATE INDEX IF NOT EXISTS idx_fd_company       ON warehouse.fact_depenses (company_key);
CREATE INDEX IF NOT EXISTS idx_fd_nature        ON warehouse.fact_depenses (nature_depense_key);
CREATE INDEX IF NOT EXISTS idx_fd_status        ON warehouse.fact_depenses (status);
CREATE INDEX IF NOT EXISTS idx_fd_requester     ON warehouse.fact_depenses (employee_requester_key);
CREATE INDEX IF NOT EXISTS idx_fd_validator     ON warehouse.fact_depenses (employee_validator_key);
