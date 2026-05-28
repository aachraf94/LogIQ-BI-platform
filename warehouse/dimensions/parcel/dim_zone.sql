-- =============================================================================
-- DIMENSION: dim_zone
-- Grain     : One row per pricing zone (5 rows — static seed)
-- Source    : Static — zones 0–4 defined by Yalidine's pricing model
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_zone (
    zone_id       SMALLINT     PRIMARY KEY,
    zone_num      SMALLINT     NOT NULL,   -- 0–4
    fee_range_dzd VARCHAR(20)  NOT NULL    -- e.g. '350–500'
);

INSERT INTO warehouse.dim_zone (zone_id, zone_num, fee_range_dzd) VALUES
    (1, 0, '350–500'),
    (2, 1, '500–700'),
    (3, 2, '700–950'),
    (4, 3, '950–1200'),
    (5, 4, '1200–1600')
ON CONFLICT (zone_id) DO NOTHING;
