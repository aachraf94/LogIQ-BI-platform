-- =============================================================================
-- DIMENSION: dim_stop_type
-- Grain     : One row per transport stop type (2 rows — static seed)
-- Source    : Static — pickup / delivery two-value enum
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_stop_type (
    stop_type_id SMALLINT     PRIMARY KEY,
    stop_type    VARCHAR(20)  NOT NULL
);

INSERT INTO warehouse.dim_stop_type (stop_type_id, stop_type) VALUES
    (1, 'pickup'),
    (2, 'delivery')
ON CONFLICT (stop_type_id) DO NOTHING;
