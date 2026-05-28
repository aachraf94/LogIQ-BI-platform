-- =============================================================================
-- DIMENSION: dim_nature
-- Grain     : One row per cashbox expense nature (13 rows)
-- Source    : stg_cashbox_natures
-- ETL       : INSERT ... ON CONFLICT (nature_id) DO UPDATE SET nature_name, category_id
-- Notable   : nature_id=3 (Remboursement colis perdu/volé),
--             nature_id=4 (Remboursement colis endommagé),
--             nature_id=5 (Paiement livreurs freelance) — dual-tracked with cashbox dims
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_nature (
    nature_id   INTEGER       PRIMARY KEY,  -- Cashbox source nature_id — natural key
    nature_name VARCHAR(100)  NOT NULL,
    category_id SMALLINT      NOT NULL REFERENCES warehouse.dim_nature_category(category_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_nature_category ON warehouse.dim_nature (category_id);
