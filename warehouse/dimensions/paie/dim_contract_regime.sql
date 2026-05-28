-- =============================================================================
-- DIMENSION: dim_contract_regime
-- Grain     : One row per work regime (2 rows — static seed)
-- Source    : Static — Algerian labor law work regimes
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_contract_regime (
    regime_id SMALLINT     PRIMARY KEY,
    regime    VARCHAR(30)  NOT NULL
);

INSERT INTO warehouse.dim_contract_regime (regime_id, regime) VALUES
    (1, 'Temps plein'),
    (2, 'Temps partiel')
ON CONFLICT (regime_id) DO NOTHING;
