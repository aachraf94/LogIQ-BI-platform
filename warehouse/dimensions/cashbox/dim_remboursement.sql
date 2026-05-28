-- =============================================================================
-- DIMENSION: dim_remboursement
-- Grain     : One row per parcel reimbursement (~10 K rows)
-- Source    : stg_cashbox_remboursements
-- ETL       : Requires dim_depense (step 41) loaded first.
--             depense_id resolved by joining to dim_depense on depense_id from staging.
-- Note      : montant_rembourse here for reference/traceability only.
--             Actual cost entry lives in fact_charges via the depense_id FK row.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_remboursement (
    remboursement_id        VARCHAR(50)   PRIMARY KEY,  -- RMB-YYYY-MM-NNNNNN — natural key
    colis_tracking          VARCHAR(20)   NOT NULL,     -- reference to the failed/lost parcel
    depense_id              VARCHAR(50)   NOT NULL REFERENCES warehouse.dim_depense(depense_id),  -- dual-tracked nature_id=3 or 4
    parcel_declared_value   DECIMAL(15,2),              -- DZD
    montant_rembourse       DECIMAL(15,2) NOT NULL,     -- 50–100% of declared_value
    sinistre_type_id        SMALLINT      NOT NULL REFERENCES warehouse.dim_sinistre_type(sinistre_type_id),
    date_remboursement_id   DATE          NOT NULL REFERENCES warehouse.dim_date(date_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_remboursement_tracking  ON warehouse.dim_remboursement (colis_tracking);
CREATE INDEX IF NOT EXISTS idx_dim_remboursement_depense   ON warehouse.dim_remboursement (depense_id);
CREATE INDEX IF NOT EXISTS idx_dim_remboursement_date      ON warehouse.dim_remboursement (date_remboursement_id);
CREATE INDEX IF NOT EXISTS idx_dim_remboursement_sinistre  ON warehouse.dim_remboursement (sinistre_type_id);
