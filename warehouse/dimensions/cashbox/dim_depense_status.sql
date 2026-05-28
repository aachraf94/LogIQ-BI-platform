-- =============================================================================
-- DIMENSION: dim_depense_status
-- Grain     : One row per cashbox expense workflow status (3 rows)
-- Source    : stg_cashbox_depenses (SELECT DISTINCT status)
-- ETL       : INSERT ... ON CONFLICT (status) DO NOTHING
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_depense_status (
    depense_status_id SMALLINT     PRIMARY KEY,
    status            VARCHAR(30)  UNIQUE NOT NULL
);

INSERT INTO warehouse.dim_depense_status (depense_status_id, status) VALUES
    (1, 'en_attente'),
    (2, 'validée'),
    (3, 'rejetée')
ON CONFLICT (depense_status_id) DO NOTHING;
