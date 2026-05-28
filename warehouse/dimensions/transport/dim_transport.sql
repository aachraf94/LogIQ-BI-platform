-- =============================================================================
-- DIMENSION: dim_transport — Central Transport Entity
-- Grain     : One row per transport request
-- Source    : stg_transport_requests
-- Note      : All categorical attributes of a transport request.
--             dim_transport_stops references this table (transport_key FK) —
--             dim_transport must be loaded BEFORE dim_transport_stops.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport (
    transport_key           SERIAL       PRIMARY KEY,
    request_id              VARCHAR(50)  UNIQUE NOT NULL,  -- DT-YYYY-NNNNN
    created_date_id         DATE         REFERENCES warehouse.dim_date(date_id),
    client_id               INTEGER      REFERENCES warehouse.dim_transport_client(client_id),
    dispatched_from_hub_id  INTEGER      REFERENCES warehouse.dim_center(center_id),     -- NULL if private garage
    dispatched_from_wilaya_id SMALLINT   NOT NULL REFERENCES warehouse.dim_wilaya(wilaya_id),  -- always set; fallback when hub_id is NULL
    service_type_id         SMALLINT     NOT NULL REFERENCES warehouse.dim_transport_service_type(service_type_id),
    sub_service_id          SMALLINT     REFERENCES warehouse.dim_transport_sub_service_type(sub_service_id),  -- NULL for courrier/manutention
    status_id               SMALLINT     NOT NULL REFERENCES warehouse.dim_transport_status(status_id),
    payment_status_id       SMALLINT     NOT NULL REFERENCES warehouse.dim_transport_payment_status(payment_status_id),
    vehicle_id              VARCHAR(20)  NOT NULL REFERENCES warehouse.dim_transport_vehicle(vehicle_id),
    driver_key              INTEGER      NOT NULL REFERENCES warehouse.dim_employee(employee_key),   -- SCD2 surrogate at request date
    second_driver_key       INTEGER      REFERENCES warehouse.dim_employee(employee_key),   -- NULL for trips ≤ 400 km
    departure_key           INTEGER      NOT NULL REFERENCES warehouse.dim_transport_departure(departure_key),
    arrival_key             INTEGER      NOT NULL REFERENCES warehouse.dim_transport_arrival(arrival_key),
    cargo_key               SMALLINT     NOT NULL REFERENCES warehouse.dim_transport_cargo(cargo_key),
    routing_profile_key     SMALLINT     NOT NULL REFERENCES warehouse.dim_transport_routing(routing_profile_key)
);

CREATE INDEX IF NOT EXISTS idx_dim_transport_request_id  ON warehouse.dim_transport (request_id);
CREATE INDEX IF NOT EXISTS idx_dim_transport_client      ON warehouse.dim_transport (client_id);
CREATE INDEX IF NOT EXISTS idx_dim_transport_status      ON warehouse.dim_transport (status_id);
CREATE INDEX IF NOT EXISTS idx_dim_transport_date        ON warehouse.dim_transport (created_date_id);
CREATE INDEX IF NOT EXISTS idx_dim_transport_driver      ON warehouse.dim_transport (driver_key);
CREATE INDEX IF NOT EXISTS idx_dim_transport_vehicle     ON warehouse.dim_transport (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_dim_transport_wilaya_from ON warehouse.dim_transport (dispatched_from_wilaya_id);
