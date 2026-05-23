-- =============================================================================
-- STAGING: stg_transport_stops
-- Source : Dedicated Transport — GET /transport/stops (dedicated endpoint)
-- Grain  : One row per stop within a transport request
-- Notes  : Stops are embedded in the transport request API response and stored
--          separately in transport.stops. They are unpacked and staged here.
--          stop_order is sequential starting at 1 with no gaps per request.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_transport_stops (
    stg_id                      BIGSERIAL       PRIMARY KEY,

    stop_id                     VARCHAR(70)     NOT NULL UNIQUE,    -- ST-{request_id}-{NNN}
    request_id                  VARCHAR(50)     NOT NULL,           -- FK → stg_transport_requests.request_id
    stop_order                  SMALLINT        NOT NULL,           -- sequence starting at 1
    stop_type                   VARCHAR(20)     NOT NULL,           -- pickup, delivery
    location_type               VARCHAR(30)     NOT NULL,           -- client_depot, client_magasin, yalidine_center, autre
    location_name               VARCHAR(200)    NOT NULL,
    address                     VARCHAR(300),
    wilaya_id                   SMALLINT        NOT NULL,
    commune_id                  INTEGER,
    gps                         VARCHAR(60),
    scheduled_datetime          TIMESTAMP       NOT NULL,
    actual_datetime             TIMESTAMP,                          -- null if stop is in the future
    waiting_time_minutes        INTEGER,
    distance_from_prev_km       NUMERIC(8,2),                       -- distance from previous stop (null for first)

    -- ETL metadata
    loaded_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id                    VARCHAR(50),
    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_transport_stops IS
    'Staging for transport request stops — unpacked from embedded stops array in requests response.';
COMMENT ON COLUMN warehouse.stg_transport_stops.distance_from_prev_km IS
    'Distance from the previous stop. NULL for the first stop (stop_order = 1).';

CREATE INDEX IF NOT EXISTS idx_stg_stops_request ON warehouse.stg_transport_stops (request_id);
CREATE INDEX IF NOT EXISTS idx_stg_stops_wilaya  ON warehouse.stg_transport_stops (wilaya_id);
