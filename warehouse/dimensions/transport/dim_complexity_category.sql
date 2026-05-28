-- =============================================================================
-- DIMENSION: dim_complexity_category
-- Grain     : One row per routing complexity category (2 rows — static seed)
-- Source    : Static — analytical classification based on nbr_stops_total
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_complexity_category (
    complexity_category_id SMALLINT     PRIMARY KEY,
    complexity_category    VARCHAR(20)  NOT NULL
);

INSERT INTO warehouse.dim_complexity_category (complexity_category_id, complexity_category) VALUES
    (1, 'direct'),
    (2, 'multi-stop')
ON CONFLICT (complexity_category_id) DO NOTHING;
