-- =============================================================================
-- DIMENSION: dim_pricing_service_type
-- Grain     : One row per Yalidine pricing service type (5 rows — static seed)
-- Source    : Static — Yalidine product enum
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_pricing_service_type (
    pricing_service_type_id SMALLINT     PRIMARY KEY,
    service_type            VARCHAR(30)  NOT NULL
);

INSERT INTO warehouse.dim_pricing_service_type (pricing_service_type_id, service_type) VALUES
    (1, 'livraison'),
    (2, 'pickup'),
    (3, 'echange'),
    (4, 'recouvrement'),
    (5, 'retours')
ON CONFLICT (pricing_service_type_id) DO NOTHING;
