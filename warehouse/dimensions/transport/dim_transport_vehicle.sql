-- =============================================================================
-- DIMENSION: dim_transport_vehicle
-- Grain     : One row per vehicle (V-NNNN format)
-- Source    : stg_transport_requests (DISTINCT vehicle_id fields)
-- ETL       : INSERT ... ON CONFLICT (vehicle_id) DO UPDATE SET vehicle_type_id,
--             vehicle_plate, vehicle_brand, vehicle_model, payload, volume
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_vehicle (
    vehicle_id          VARCHAR(20)   PRIMARY KEY,  -- V-NNNN — natural key
    vehicle_type_id     SMALLINT      NOT NULL REFERENCES warehouse.dim_transport_vehicle_type(vehicle_type_id),
    vehicle_plate       VARCHAR(20)   NOT NULL,
    vehicle_brand       VARCHAR(50),
    vehicle_model       VARCHAR(50),
    payload_capacity_kg DECIMAL(8,2),
    volume_capacity_m3  DECIMAL(6,2)
);

CREATE INDEX IF NOT EXISTS idx_dim_vehicle_type ON warehouse.dim_transport_vehicle (vehicle_type_id);
