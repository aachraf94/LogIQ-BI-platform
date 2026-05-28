-- =============================================================================
-- DIMENSION: dim_client_type
-- Grain     : One row per transport client type (2 rows — static seed)
-- Source    : Static — conventionné / divers two-value enum
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_client_type (
    client_type_id SMALLINT     PRIMARY KEY,
    client_type    VARCHAR(30)  NOT NULL
);

INSERT INTO warehouse.dim_client_type (client_type_id, client_type) VALUES
    (1, 'conventionné'),
    (2, 'divers')
ON CONFLICT (client_type_id) DO NOTHING;
