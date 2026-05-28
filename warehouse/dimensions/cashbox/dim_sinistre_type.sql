-- =============================================================================
-- DIMENSION: dim_sinistre_type
-- Grain     : One row per parcel incident type (3 rows)
-- Source    : stg_cashbox_remboursements (SELECT DISTINCT sinistre_type)
-- ETL       : INSERT ... ON CONFLICT (sinistre_type) DO NOTHING
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_sinistre_type (
    sinistre_type_id SMALLINT     PRIMARY KEY,
    sinistre_type    VARCHAR(30)  UNIQUE NOT NULL
);

INSERT INTO warehouse.dim_sinistre_type (sinistre_type_id, sinistre_type) VALUES
    (1, 'perdu'),
    (2, 'endommagé'),
    (3, 'vol')
ON CONFLICT (sinistre_type_id) DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS warehouse.dim_sinistre_type_seq START 4;
