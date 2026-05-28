-- =============================================================================
-- FACT: fact_cost_salaire
-- Grain     : One row per payslip (1:1 with dim_bulletin)
-- PK        : bulletin_id (same as dim_bulletin)
-- Source    : stg_paie_bulletins → dim_bulletin → this fact
-- Note      : Full employer cost = total_brut + total_charges_patronales.
--             net_a_payer (= total_brut - total_deductions) is not stored here —
--             it is a derived measure computable from these columns.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_cost_salaire (
    bulletin_id              VARCHAR(50)   PRIMARY KEY REFERENCES warehouse.dim_bulletin(bulletin_id),
    date_id                  DATE          NOT NULL REFERENCES warehouse.dim_date(date_id),
    total_brut               DECIMAL(12,2) NOT NULL,    -- gross salary (DZD)
    total_deductions         DECIMAL(12,2) NOT NULL,    -- employee deductions
    total_charges_patronales DECIMAL(12,2) NOT NULL     -- employer charges (~25% of total_brut)
);

CREATE INDEX IF NOT EXISTS idx_fact_cs_date ON warehouse.fact_cost_salaire (date_id);
