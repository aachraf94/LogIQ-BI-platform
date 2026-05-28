-- =============================================================================
-- DIMENSION: dim_parcel_type
-- Grain     : One row per parcel type (2 rows — static seed)
-- Source    : Static — ecommerce / internal two-value enum
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_parcel_type (
    parcel_type_id SMALLINT     PRIMARY KEY,
    parcel_type    VARCHAR(30)  NOT NULL
);

INSERT INTO warehouse.dim_parcel_type (parcel_type_id, parcel_type) VALUES
    (1, 'ecommerce'),
    (2, 'internal')
ON CONFLICT (parcel_type_id) DO NOTHING;
