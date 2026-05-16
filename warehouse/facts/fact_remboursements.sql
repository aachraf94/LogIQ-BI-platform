-- =============================================================================
-- FACT: fact_remboursements
-- Grain  : One row per parcel reimbursement (~3–5 per operational agency per month)
-- Source : stg_cashbox_remboursements
-- Notes  : colis_tracking is a soft reference to fact_livraisons.tracking
--          (no FK constraint — the parcel must exist but the join is managed
--          by ETL, not DB constraint, to avoid circular dependency).
--          taux_remboursement is a convenience measure: montant / declared_value.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_remboursements (
    remboursement_key           BIGSERIAL       PRIMARY KEY,

    -- Date dimension key
    date_remboursement_key      INTEGER         NOT NULL
                                REFERENCES warehouse.dim_date (date_key),

    -- Dimension keys
    agence_key                  BIGINT          NOT NULL            -- responsible agency
                                REFERENCES warehouse.dim_agence (agence_key),
    company_key                 INTEGER         NOT NULL
                                REFERENCES warehouse.dim_company (company_key),
    employee_validator_key      BIGINT
                                REFERENCES warehouse.dim_employee (employee_key),

    -- Degenerate dimensions
    remboursement_id            VARCHAR(50)     NOT NULL UNIQUE,    -- RMB-{YYYY}-{MM}-{NNNNNN}
    colis_tracking              VARCHAR(20)     NOT NULL,           -- soft ref → fact_livraisons.tracking
    sinistre_type               VARCHAR(20)     NOT NULL
                                CHECK (sinistre_type IN ('perdu', 'endommagé', 'vol')),
    delivery_type               VARCHAR(2)
                                CHECK (delivery_type IN ('HD', 'SD')),
    mode_paiement               VARCHAR(20)     NOT NULL
                                CHECK (mode_paiement IN ('espèces', 'virement', 'chèque')),

    -- Measures (all DZD)
    declared_value              NUMERIC(15,2),                      -- NULL if seller didn't declare value
    montant_rembourse           NUMERIC(15,2)   NOT NULL,
    taux_remboursement          NUMERIC(5,2),                       -- montant_rembourse / declared_value × 100; NULL if no declared_value

    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.fact_remboursements IS
    'Parcel reimbursement fact table. References failed/lost parcels via tracking number.';
COMMENT ON COLUMN warehouse.fact_remboursements.colis_tracking IS
    'Soft reference to fact_livraisons.tracking. Validated by ETL — no DB FK to avoid circular dependency.';
COMMENT ON COLUMN warehouse.fact_remboursements.taux_remboursement IS
    'Percentage of declared value reimbursed (50–100% per business rules). NULL if declared_value is unknown.';

CREATE INDEX IF NOT EXISTS idx_fr_date       ON warehouse.fact_remboursements (date_remboursement_key);
CREATE INDEX IF NOT EXISTS idx_fr_agence     ON warehouse.fact_remboursements (agence_key);
CREATE INDEX IF NOT EXISTS idx_fr_sinistre   ON warehouse.fact_remboursements (sinistre_type);
CREATE INDEX IF NOT EXISTS idx_fr_tracking   ON warehouse.fact_remboursements (colis_tracking);
CREATE INDEX IF NOT EXISTS idx_fr_company    ON warehouse.fact_remboursements (company_key);
