-- =============================================================================
-- FACT: fact_transport_billing
-- Grain     : One row per transport request (1:1 with dim_transport)
-- PK        : transport_key
-- Source    : stg_transport_requests (billing fields)
-- Note      : amount_invoiced >= total_cost (markup 1.15–1.45×).
--             marge_brute_dzd and marge_brute_pct are ETL-computed derived measures.
--             invoice_ref is a degenerate dimension (kept for traceability).
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_transport_billing (
    transport_key      INTEGER        PRIMARY KEY REFERENCES warehouse.dim_transport(transport_key),
    date_invoiced_id   DATE           REFERENCES warehouse.dim_date(date_id),    -- NULL if not yet invoiced
    date_paid_id       DATE           REFERENCES warehouse.dim_date(date_id),    -- NULL if unpaid
    invoice_ref        VARCHAR(50),                                               -- degenerate — INV-YYYY-NNNNN
    amount_invoiced    DECIMAL(12,2)  NOT NULL,
    amount_paid        DECIMAL(12,2),                                             -- NULL if unpaid
    marge_brute_dzd    DECIMAL(12,2),                                             -- amount_invoiced − total_cost
    marge_brute_pct    DECIMAL(5,2)
);

CREATE INDEX IF NOT EXISTS idx_fact_tb_date_invoiced ON warehouse.fact_transport_billing (date_invoiced_id);
CREATE INDEX IF NOT EXISTS idx_fact_tb_date_paid     ON warehouse.fact_transport_billing (date_paid_id);
