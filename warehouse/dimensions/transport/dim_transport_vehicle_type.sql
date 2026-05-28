-- =============================================================================
-- DIMENSION: dim_transport_vehicle_type
-- Grain     : One row per transport vehicle type (5 rows — static seed)
-- Source    : Static — Yalidine's five transport vehicle categories
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_vehicle_type (
    vehicle_type_id SMALLINT     PRIMARY KEY,
    vehicle_type    VARCHAR(30)  NOT NULL
);

INSERT INTO warehouse.dim_transport_vehicle_type (vehicle_type_id, vehicle_type) VALUES
    (1, 'moto'),
    (2, 'citadine'),
    (3, 'break'),
    (4, 'camionnette'),
    (5, 'camion')
ON CONFLICT (vehicle_type_id) DO NOTHING;
