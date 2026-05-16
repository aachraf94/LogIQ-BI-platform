-- =============================================================================
-- FACT: fact_transferts_caisse
-- Grain  : One row per internal fund transfer between cash boxes
-- Source : stg_cashbox_transferts
-- CRITICAL: Fund transfers are INTERNAL CASH MOVEMENTS — NOT expenses.
--           This fact table must NEVER be joined or unioned with fact_depenses
--           in any cost calculation or dashboard widget.
--           Purpose: cash flow and treasury analysis only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_transferts_caisse (
    transfert_key               BIGSERIAL       PRIMARY KEY,

    -- Date dimension key
    date_transfert_key          INTEGER         NOT NULL
                                REFERENCES warehouse.dim_date (date_key),

    -- Dimension keys
    agence_source_key           BIGINT          NOT NULL
                                REFERENCES warehouse.dim_agence (agence_key),
    agence_destination_key      BIGINT          NOT NULL
                                REFERENCES warehouse.dim_agence (agence_key),
    employee_validator_key      BIGINT
                                REFERENCES warehouse.dim_employee (employee_key),

    -- Degenerate dimensions
    transfert_id                VARCHAR(50)     NOT NULL UNIQUE,    -- TRF-{YYYY}-{MM}-{NNNNNN}
    banque_name                 VARCHAR(100),                       -- BNA, CPA, BEA, BDL, BADR; NULL for direct cash

    -- Measure (DZD)
    montant                     NUMERIC(15,2)   NOT NULL,

    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.fact_transferts_caisse IS
    'Cash box fund transfer fact — internal treasury movements only. NOT an expense. Never include in cost KPIs.';
COMMENT ON COLUMN warehouse.fact_transferts_caisse.banque_name IS
    'NULL for approximately 40% of transfers (direct cash handover without bank intermediary).';

CREATE INDEX IF NOT EXISTS idx_ftc_date    ON warehouse.fact_transferts_caisse (date_transfert_key);
CREATE INDEX IF NOT EXISTS idx_ftc_source  ON warehouse.fact_transferts_caisse (agence_source_key);
CREATE INDEX IF NOT EXISTS idx_ftc_dest    ON warehouse.fact_transferts_caisse (agence_destination_key);
