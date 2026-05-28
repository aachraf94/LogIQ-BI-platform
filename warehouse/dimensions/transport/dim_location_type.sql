-- =============================================================================
-- DIMENSION: dim_location_type
-- Grain     : One row per transport location type (4 rows — static seed)
-- Source    : Static — shared by departure, arrival, and stops
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_location_type (
    location_type_id SMALLINT     PRIMARY KEY,
    location_type    VARCHAR(30)  UNIQUE NOT NULL
);

INSERT INTO warehouse.dim_location_type (location_type_id, location_type) VALUES
    (1, 'client_depot'),
    (2, 'client_magasin'),
    (3, 'yalidine_center'),
    (4, 'autre')
ON CONFLICT (location_type_id) DO NOTHING;
