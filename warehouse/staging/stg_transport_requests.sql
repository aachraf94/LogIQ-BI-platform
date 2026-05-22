-- =============================================================================
-- STAGING: stg_transport_requests
-- Source : Dedicated Transport — GET /transport/requests
-- Grain  : One row per dedicated transport request (~10–15 per day)
-- Notes  : All nested objects are flattened. Stops are staged separately in
--          stg_transport_stops. Hard constraints enforced at ETL load:
--          distance_extra_km = distance_real_km - distance_unit_km (exact),
--          total_cost = sum of all cout_* fields (exact),
--          cout_assurance >= 5000 always.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_transport_requests (
    stg_id                          BIGSERIAL       PRIMARY KEY,

    request_id                      VARCHAR(50)     NOT NULL UNIQUE, -- DT-{YYYY}-{NNNNN}
    created_at_src                  TIMESTAMP       NOT NULL,
    confirmed_at                    TIMESTAMP,
    completed_at                    TIMESTAMP,
    cancelled_at                    TIMESTAMP,
    cancellation_reason             TEXT,
    status                          VARCHAR(20)     NOT NULL,        -- en_attente, confirmée, en_cours, terminée, annulée
    service_type                    VARCHAR(30)     NOT NULL,        -- course_dediee, courrier, manutention
    sub_service_type                VARCHAR(20),                     -- livraison, pickup, echange; null for courrier/manutention

    -- Client
    client_id                       INTEGER         NOT NULL,
    client_name                     VARCHAR(200)    NOT NULL,
    client_type                     VARCHAR(20)     NOT NULL,        -- conventionné, divers
    client_company_id               INTEGER,
    client_company_name             VARCHAR(150),
    client_contact_phone            VARCHAR(20),
    client_contact_email            VARCHAR(150),

    -- Vehicle dispatch origin
    dispatched_from_hub_id          INTEGER,                         -- FK → yalidine.centers.hub_id; null if private garage
    dispatched_from_hub_name        VARCHAR(200),
    dispatched_from_wilaya_id       SMALLINT        NOT NULL,
    vehicle_departure_dt            TIMESTAMP,
    vehicle_return_dt               TIMESTAMP,
    total_vehicle_km                NUMERIC(8,2),

    -- Departure point
    depart_location_type            VARCHAR(30)     NOT NULL,        -- client_depot, client_magasin, yalidine_center, autre
    depart_location_name            VARCHAR(200)    NOT NULL,
    depart_address                  VARCHAR(300),
    depart_wilaya_id                SMALLINT        NOT NULL,
    depart_wilaya_name              VARCHAR(100),
    depart_commune_id               INTEGER,
    depart_commune_name             VARCHAR(150),
    depart_gps                      VARCHAR(60),
    depart_scheduled_dt             TIMESTAMP       NOT NULL,
    depart_actual_dt                TIMESTAMP,

    -- Arrival point
    arrival_location_type           VARCHAR(30)     NOT NULL,
    arrival_location_name           VARCHAR(200)    NOT NULL,
    arrival_address                 VARCHAR(300),
    arrival_wilaya_id               SMALLINT        NOT NULL,
    arrival_wilaya_name             VARCHAR(100),
    arrival_commune_id              INTEGER,
    arrival_commune_name            VARCHAR(150),
    arrival_gps                     VARCHAR(60),
    arrival_scheduled_dt            TIMESTAMP       NOT NULL,
    arrival_actual_dt               TIMESTAMP,

    -- Vehicle
    vehicle_id                      VARCHAR(20)     NOT NULL,        -- V-{NNNN}
    vehicle_type                    VARCHAR(20)     NOT NULL,        -- moto, citadine, break, camionnette, camion
    vehicle_plate                   VARCHAR(20)     NOT NULL,
    vehicle_brand                   VARCHAR(50),
    vehicle_model                   VARCHAR(50),
    payload_capacity_kg             NUMERIC(8,2),
    volume_capacity_m3              NUMERIC(6,2),
    driver_id                       INTEGER         NOT NULL,        -- FK → hrforce.users.id (CHAUFFEUR)
    driver_name                     VARCHAR(150)    NOT NULL,
    driver_phone                    VARCHAR(20),
    second_driver_id                INTEGER,                         -- only for trips > 400 km
    second_driver_name              VARCHAR(150),

    -- Cargo
    merchandise_type                VARCHAR(100),
    merchandise_description         TEXT,
    fragile                         BOOLEAN         NOT NULL DEFAULT FALSE,
    hazardous                       BOOLEAN         NOT NULL DEFAULT FALSE,
    total_weight_kg                 NUMERIC(10,2)   NOT NULL,
    total_volume_m3                 NUMERIC(8,2),
    nbr_pieces                      INTEGER         NOT NULL,
    nbr_pieces_lt50kg               INTEGER         NOT NULL DEFAULT 0,
    nbr_pieces_50_99kg              INTEGER         NOT NULL DEFAULT 0,
    nbr_pieces_100_199kg            INTEGER         NOT NULL DEFAULT 0,
    nbr_pieces_gte200kg             INTEGER         NOT NULL DEFAULT 0, -- >= 200kg triggers clark
    requires_clark                  BOOLEAN         NOT NULL DEFAULT FALSE,
    requires_packaging              BOOLEAN         NOT NULL DEFAULT FALSE,
    declared_value_dzd              NUMERIC(15,2),

    -- Routing
    nbr_stops_pickup                INTEGER         NOT NULL,
    nbr_stops_delivery              INTEGER         NOT NULL,
    nbr_stops_total                 INTEGER         NOT NULL,        -- = nbr_stops_pickup + nbr_stops_delivery
    distance_unit_km                NUMERIC(8,2)    NOT NULL,
    distance_real_km                NUMERIC(8,2)    NOT NULL,
    distance_extra_km               NUMERIC(8,2)    NOT NULL,        -- = distance_real_km - distance_unit_km
    total_duration_minutes          INTEGER,
    total_waiting_time_minutes      INTEGER,
    is_night_shift                  BOOLEAN         NOT NULL DEFAULT FALSE,
    night_shift_hours               INTEGER,
    nbr_floors                      INTEGER         NOT NULL DEFAULT 0,
    return_trip                     BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Cost breakdown (DZD)
    cout_base                       NUMERIC(15,2)   NOT NULL,
    cout_distance_supp              NUMERIC(15,2)   NOT NULL DEFAULT 0,
    cout_ramassage                  NUMERIC(15,2)   NOT NULL DEFAULT 0,
    cout_livraison                  NUMERIC(15,2)   NOT NULL DEFAULT 0,
    cout_manutention                NUMERIC(15,2)   NOT NULL DEFAULT 0,
    cout_emballage                  NUMERIC(15,2)   NOT NULL DEFAULT 0,
    cout_tarif_nuit                 NUMERIC(15,2)   NOT NULL DEFAULT 0,
    cout_prod_frais                 NUMERIC(15,2)   NOT NULL DEFAULT 0,
    cout_assurance                  NUMERIC(15,2)   NOT NULL,        -- minimum 5000 DZD always
    cout_carburant                  NUMERIC(15,2),
    cout_peage                      NUMERIC(15,2),
    total_cost                      NUMERIC(15,2)   NOT NULL,        -- exact sum of all cout_* fields

    -- Billing
    amount_invoiced                 NUMERIC(15,2),                           -- NULL for annulée requests
    amount_paid                     NUMERIC(15,2),
    payment_method                  VARCHAR(20),
    payment_status                  VARCHAR(20)     NOT NULL,        -- en_attente, payé, annulé
    invoice_ref                     VARCHAR(50),                     -- INV-{YYYY}-{NNNNN}
    invoiced_at                     TIMESTAMP,
    paid_at                         TIMESTAMP,

    -- Performance
    departure_delay_minutes         INTEGER,
    arrival_delay_minutes           INTEGER,
    on_time                         BOOLEAN,
    client_rating                   SMALLINT,                        -- 1–5
    client_feedback                 TEXT,

    -- ETL metadata
    loaded_at                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id                        VARCHAR(50),
    created_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_transport_requests IS
    'Staging for dedicated transport requests. ~10–15 per day, ~13K rows for 36-month dataset.';
COMMENT ON COLUMN warehouse.stg_transport_requests.cout_assurance IS
    'Always >= 5000 DZD per business rule. Validated by ETL load.';
COMMENT ON COLUMN warehouse.stg_transport_requests.total_cost IS
    'Must equal exact sum of all cout_* fields. Validated by ETL load.';
COMMENT ON COLUMN warehouse.stg_transport_requests.nbr_pieces_gte200kg IS
    'Pieces >= 200kg require Clark forklift: requires_clark must be TRUE when > 0.';

CREATE INDEX IF NOT EXISTS idx_stg_tr_status         ON warehouse.stg_transport_requests (status);
CREATE INDEX IF NOT EXISTS idx_stg_tr_created        ON warehouse.stg_transport_requests (created_at_src);
CREATE INDEX IF NOT EXISTS idx_stg_tr_driver         ON warehouse.stg_transport_requests (driver_id);
CREATE INDEX IF NOT EXISTS idx_stg_tr_hub            ON warehouse.stg_transport_requests (dispatched_from_hub_id);
CREATE INDEX IF NOT EXISTS idx_stg_tr_service        ON warehouse.stg_transport_requests (service_type);
CREATE INDEX IF NOT EXISTS idx_stg_tr_wilaya_depart  ON warehouse.stg_transport_requests (depart_wilaya_id);
CREATE INDEX IF NOT EXISTS idx_stg_tr_wilaya_arrivee ON warehouse.stg_transport_requests (arrival_wilaya_id);
