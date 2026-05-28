-- =============================================================================
-- DIMENSION: dim_region
-- Grain     : One row per Algerian geographic region (3 rows — static seed)
-- Source    : Static — no source table; arithmetic classification
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_region (
    region_id    SMALLINT     PRIMARY KEY,
    region_name  VARCHAR(50)  NOT NULL,
    wilaya_count SMALLINT     NOT NULL
);

INSERT INTO warehouse.dim_region (region_id, region_name, wilaya_count) VALUES
    (1, 'Nord',           28),
    (2, 'Hauts Plateaux', 20),
    (3, 'Sud',            10)
ON CONFLICT (region_id) DO NOTHING;
