-- =============================================================================
-- DIMENSION: dim_parcel
-- Grain     : One row per unique parcel tracking number (~27 M rows)
-- Source    : stg_yalidine_parcel_history — collapsed by tracking number
-- ETL       : First event → date_creation_id + center_depart_key;
--             Terminal event (is_terminal=TRUE) → date_terminal_id;
--             current_status_id from most recent event.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_parcel (
    parcel_key               BIGSERIAL    PRIMARY KEY,
    tracking                 VARCHAR(20)  UNIQUE NOT NULL,  -- yal-XXXXXX or sac-XXXXXX
    current_status_id        SMALLINT     REFERENCES warehouse.dim_parcels_status(status_id),
    delivery_type_id         SMALLINT     REFERENCES warehouse.dim_delivery_type(delivery_type_id),
    zone_id                  SMALLINT     REFERENCES warehouse.dim_zone(zone_id),         -- NULL before Centre status
    parcel_type_id           SMALLINT     REFERENCES warehouse.dim_parcel_type(parcel_type_id),
    date_creation_id         DATE         REFERENCES warehouse.dim_date(date_id),          -- date of first status event
    date_terminal_id         DATE         REFERENCES warehouse.dim_date(date_id),          -- NULL for in-progress parcels
    center_depart_key        INTEGER      REFERENCES warehouse.dim_center(center_id),      -- first center where parcel enters
    center_destination_key   INTEGER      REFERENCES warehouse.dim_center(center_id)       -- destination center
);

CREATE INDEX IF NOT EXISTS idx_dim_parcel_tracking         ON warehouse.dim_parcel (tracking);
CREATE INDEX IF NOT EXISTS idx_dim_parcel_current_status   ON warehouse.dim_parcel (current_status_id);
CREATE INDEX IF NOT EXISTS idx_dim_parcel_date_creation    ON warehouse.dim_parcel (date_creation_id);
CREATE INDEX IF NOT EXISTS idx_dim_parcel_date_terminal    ON warehouse.dim_parcel (date_terminal_id);
CREATE INDEX IF NOT EXISTS idx_dim_parcel_center_depart    ON warehouse.dim_parcel (center_depart_key);
CREATE INDEX IF NOT EXISTS idx_dim_parcel_center_dest      ON warehouse.dim_parcel (center_destination_key);
