-- =============================================================================
-- FACT: fact_charges
-- Grain     : One row per cashbox expense record (1:1 with dim_depense)
-- PK        : depense_id (same as dim_depense)
-- Source    : stg_cashbox_depenses → dim_depense → this fact
-- Note      : Only VALIDATED expenses (depense_status_id = 2) should be included
--             in profitability calculations. All statuses are loaded here for
--             completeness; KPI queries must filter on dim_depense.depense_status_id.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_charges (
    depense_id VARCHAR(50)   PRIMARY KEY REFERENCES warehouse.dim_depense(depense_id),
    date_id    DATE          NOT NULL REFERENCES warehouse.dim_date(date_id),
    montant    DECIMAL(15,2) NOT NULL    -- expense amount (DZD)
);

CREATE INDEX IF NOT EXISTS idx_fact_charges_date ON warehouse.fact_charges (date_id);
