-- =============================================================================
-- FACT: fact_transport_cost
-- Grain     : One row per transport request (1:1 with dim_transport)
-- PK        : transport_key
-- Source    : stg_transport_requests (cost breakdown fields)
-- Constraint: cout_assurance >= 5 000 DZD — always enforced by source.
--             total_cost = exact sum of all cout_* fields.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_transport_cost (
    transport_key        INTEGER        PRIMARY KEY REFERENCES warehouse.dim_transport(transport_key),
    date_id              DATE           REFERENCES warehouse.dim_date(date_id),
    cout_base            DECIMAL(12,2)  NOT NULL,
    cout_distance_supp   DECIMAL(12,2)  NOT NULL DEFAULT 0,
    cout_ramassage       DECIMAL(12,2)  NOT NULL DEFAULT 0,
    cout_livraison       DECIMAL(12,2)  NOT NULL DEFAULT 0,
    cout_manutention     DECIMAL(12,2)  NOT NULL DEFAULT 0,
    cout_emballage       DECIMAL(12,2)  NOT NULL DEFAULT 0,
    cout_tarif_nuit      DECIMAL(12,2)  NOT NULL DEFAULT 0,
    cout_prod_frais      DECIMAL(12,2)  NOT NULL DEFAULT 0,
    cout_assurance       DECIMAL(12,2)  NOT NULL,
    cout_carburant       DECIMAL(12,2),
    cout_peage           DECIMAL(12,2),
    total_cost           DECIMAL(12,2)  NOT NULL,

    CONSTRAINT chk_assurance CHECK (cout_assurance >= 5000)
);

CREATE INDEX IF NOT EXISTS idx_fact_tc_date ON warehouse.fact_transport_cost (date_id);
