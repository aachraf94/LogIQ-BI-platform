-- =============================================================================
-- DIMENSION: dim_delivery_type
-- Grain     : One row per delivery type (2 rows — static seed)
-- Source    : Static — HD (home delivery) / SD (stop desk) two-value product enum
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_delivery_type (
    delivery_type_id SMALLINT    PRIMARY KEY,
    type_code        VARCHAR(2)  NOT NULL
);

INSERT INTO warehouse.dim_delivery_type (delivery_type_id, type_code) VALUES
    (1, 'HD'),
    (2, 'SD')
ON CONFLICT (delivery_type_id) DO NOTHING;
