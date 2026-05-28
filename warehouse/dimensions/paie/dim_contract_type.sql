-- =============================================================================
-- DIMENSION: dim_contract_type
-- Grain     : One row per Algerian labor contract type (3 rows — static seed)
-- Source    : Static — Algerian labor law categories
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_contract_type (
    contract_type_id SMALLINT     PRIMARY KEY,
    contract_type    VARCHAR(30)  NOT NULL
);

INSERT INTO warehouse.dim_contract_type (contract_type_id, contract_type) VALUES
    (1, 'CDI'),
    (2, 'CDD'),
    (3, 'Intérimaire')
ON CONFLICT (contract_type_id) DO NOTHING;
