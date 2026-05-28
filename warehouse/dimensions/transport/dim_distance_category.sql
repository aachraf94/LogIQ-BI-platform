-- =============================================================================
-- DIMENSION: dim_distance_category
-- Grain     : One row per analytical distance category (3 rows — static seed)
-- Source    : Static — analytical classification, not a source field
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_distance_category (
    distance_category_id SMALLINT     PRIMARY KEY,
    distance_category    VARCHAR(30)  NOT NULL,
    km_range             VARCHAR(20)  NOT NULL   -- descriptive, e.g. '< 50 km'
);

INSERT INTO warehouse.dim_distance_category (distance_category_id, distance_category, km_range) VALUES
    (1, 'local',    '< 50 km'),
    (2, 'regional', '50–200 km'),
    (3, 'national', '> 200 km')
ON CONFLICT (distance_category_id) DO NOTHING;
