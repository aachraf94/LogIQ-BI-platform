-- =============================================================================
-- FACT: fact_transport
-- Grain  : One row per dedicated transport request
-- Source : stg_transport_requests
-- Notes  : All 10 cost components are stored individually for transparent cost
--          decomposition analysis. total_cost must equal their exact sum.
--          cout_assurance has a hard minimum of 5000 DZD enforced by CHECK.
--          Stops are stored in a separate companion table (not modeled as a
--          fact here — they are operational detail, not an analytical subject).
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_transport (
    transport_key                   BIGSERIAL       PRIMARY KEY,

    -- Date dimension keys
    date_creation_key               INTEGER         NOT NULL
                                    REFERENCES warehouse.dim_date (date_key),
    date_completion_key             INTEGER                         -- NULL for non-terminal requests
                                    REFERENCES warehouse.dim_date (date_key),

    -- Agency / location dimension keys
    agence_dispatch_key             BIGINT                          -- NULL if dispatched from private garage
                                    REFERENCES warehouse.dim_agence (agence_key),
    wilaya_depart_key               INTEGER         NOT NULL
                                    REFERENCES warehouse.dim_wilaya (wilaya_key),
    wilaya_arrivee_key              INTEGER         NOT NULL
                                    REFERENCES warehouse.dim_wilaya (wilaya_key),
    commune_depart_key              INTEGER
                                    REFERENCES warehouse.dim_commune (commune_key),
    commune_arrivee_key             INTEGER
                                    REFERENCES warehouse.dim_commune (commune_key),

    -- Employee dimension keys
    driver_employee_key             BIGINT          NOT NULL        -- CHAUFFEUR LIVRAISON or CHAUFFEUR RAMASSAGE
                                    REFERENCES warehouse.dim_employee (employee_key),
    second_driver_key               BIGINT                          -- only for trips > 400 km or > 600 min
                                    REFERENCES warehouse.dim_employee (employee_key),

    -- Vehicle and company dimension keys
    vehicle_type_key                INTEGER         NOT NULL
                                    REFERENCES warehouse.dim_vehicle_type (vehicle_type_key),
    company_key                     INTEGER                         -- client's company; NULL for divers clients
                                    REFERENCES warehouse.dim_company (company_key),

    -- Degenerate dimensions
    request_id                      VARCHAR(50)     NOT NULL UNIQUE, -- DT-{YYYY}-{NNNNN}
    service_type                    VARCHAR(30)     NOT NULL
                                    CHECK (service_type IN ('course_dediee', 'courrier', 'manutention')),
    sub_service_type                VARCHAR(20)
                                    CHECK (sub_service_type IN ('livraison', 'pickup', 'echange')), -- NULL for courrier/manutention
    status                          VARCHAR(20)     NOT NULL
                                    CHECK (status IN ('en_attente', 'confirmée', 'en_cours', 'terminée', 'annulée')),
    client_type                     VARCHAR(20)     NOT NULL
                                    CHECK (client_type IN ('conventionné', 'divers')),
    payment_status                  VARCHAR(20)     NOT NULL
                                    CHECK (payment_status IN ('en_attente', 'payé', 'annulé')),
    merchandise_type                VARCHAR(100),

    -- Cargo measures            --- to remove
    total_weight_kg                 NUMERIC(10,2)   NOT NULL,
    total_volume_m3                 NUMERIC(8,2),
    nbr_pieces                      INTEGER         NOT NULL,
    nbr_pieces_lt50kg               INTEGER         NOT NULL DEFAULT 0,
    nbr_pieces_50_99kg              INTEGER         NOT NULL DEFAULT 0,
    nbr_pieces_100_199kg            INTEGER         NOT NULL DEFAULT 0,
    nbr_pieces_gte200kg             INTEGER         NOT NULL DEFAULT 0,
    declared_value_dzd              NUMERIC(15,2),

    -- Routing measures
    nbr_stops_pickup                INTEGER         NOT NULL,
    nbr_stops_delivery              INTEGER         NOT NULL,
    nbr_stops_total                 INTEGER         NOT NULL,       -- = nbr_stops_pickup + nbr_stops_delivery
    distance_unit_km                NUMERIC(8,2)    NOT NULL,
    distance_real_km                NUMERIC(8,2)    NOT NULL,
    distance_extra_km               NUMERIC(8,2)    NOT NULL,       -- = distance_real_km - distance_unit_km (exact)
    total_vehicle_km                NUMERIC(8,2),                   -- >= distance_real_km always
    total_duration_minutes          INTEGER,
    total_waiting_time_minutes      INTEGER,
    night_shift_hours               INTEGER,
    nbr_floors                      INTEGER         NOT NULL DEFAULT 0,  -- number of floors

    -- Cost breakdown — all DZD (sum = total_cost exactly)
    cout_base                       NUMERIC(15,2)   NOT NULL,       -- flat base rate
    cout_distance_supp              NUMERIC(15,2)   NOT NULL DEFAULT 0, -- distance_extra_km × rate
    cout_ramassage                  NUMERIC(15,2)   NOT NULL DEFAULT 0, -- nbr_stops_pickup × unit_rate
    cout_livraison                  NUMERIC(15,2)   NOT NULL DEFAULT 0,
    cout_manutention                NUMERIC(15,2)   NOT NULL DEFAULT 0,
    cout_emballage                  NUMERIC(15,2)   NOT NULL DEFAULT 0, -- 0 if not requested
    cout_tarif_nuit                 NUMERIC(15,2)   NOT NULL DEFAULT 0, -- 0 if not is_night_shift
    cout_prod_frais                 NUMERIC(15,2)   NOT NULL DEFAULT 0,
    cout_assurance                  NUMERIC(15,2)   NOT NULL        -- minimum 5000 DZD always
                                    CHECK (cout_assurance >= 5000),
    cout_carburant                  NUMERIC(15,2),                  -- estimated fuel cost
    cout_peage                      NUMERIC(15,2),                  -- toll costs
    total_cost                      NUMERIC(15,2)   NOT NULL,       -- exact sum of all cout_* fields

    -- Billing measures
    amount_invoiced                 NUMERIC(15,2),                  -- NULL for annulée requests
    amount_paid                     NUMERIC(15,2),                  -- NULL if unpaid

    -- Performance measures
    departure_delay_minutes         INTEGER,
    arrival_delay_minutes           INTEGER,
    client_rating                   SMALLINT
                                    CHECK (client_rating BETWEEN 1 AND 5),

    -- Boolean flags (low cardinality — kept in fact for direct WHERE filtering)
    fragile                         BOOLEAN         NOT NULL DEFAULT FALSE,
    hazardous                       BOOLEAN         NOT NULL DEFAULT FALSE,
    requires_clark                  BOOLEAN         NOT NULL DEFAULT FALSE, -- TRUE when nbr_pieces_gte200kg > 0
    requires_packaging              BOOLEAN         NOT NULL DEFAULT FALSE,
    is_night_shift                  BOOLEAN         NOT NULL DEFAULT FALSE,
    return_trip                     BOOLEAN         NOT NULL DEFAULT FALSE,
    on_time                         BOOLEAN,

    created_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()  --- To remove + boolean
);

COMMENT ON TABLE warehouse.fact_transport IS
    'Dedicated transport request fact table. ~13K rows for 36-month dataset (10–15/day).';
COMMENT ON COLUMN warehouse.fact_transport.total_cost IS
    'Must equal: cout_base + cout_distance_supp + cout_ramassage + cout_livraison + cout_manutention + cout_emballage + cout_tarif_nuit + cout_prod_frais + cout_assurance + COALESCE(cout_carburant,0) + COALESCE(cout_peage,0).';
COMMENT ON COLUMN warehouse.fact_transport.cout_assurance IS
    'Enforced minimum 5000 DZD by CHECK constraint (business rule from transport spec).';
COMMENT ON COLUMN warehouse.fact_transport.distance_extra_km IS
    'Invariant: distance_extra_km = distance_real_km - distance_unit_km. Validated by ETL.';

CREATE INDEX IF NOT EXISTS idx_ft_date_creation   ON warehouse.fact_transport (date_creation_key);
CREATE INDEX IF NOT EXISTS idx_ft_date_completion ON warehouse.fact_transport (date_completion_key);
CREATE INDEX IF NOT EXISTS idx_ft_agence_dispatch ON warehouse.fact_transport (agence_dispatch_key);
CREATE INDEX IF NOT EXISTS idx_ft_wilaya_depart   ON warehouse.fact_transport (wilaya_depart_key);
CREATE INDEX IF NOT EXISTS idx_ft_wilaya_arrivee  ON warehouse.fact_transport (wilaya_arrivee_key);
CREATE INDEX IF NOT EXISTS idx_ft_driver          ON warehouse.fact_transport (driver_employee_key);
CREATE INDEX IF NOT EXISTS idx_ft_company         ON warehouse.fact_transport (company_key);
CREATE INDEX IF NOT EXISTS idx_ft_service_type    ON warehouse.fact_transport (service_type);
CREATE INDEX IF NOT EXISTS idx_ft_status          ON warehouse.fact_transport (status);
CREATE INDEX IF NOT EXISTS idx_ft_vehicle_type    ON warehouse.fact_transport (vehicle_type_key);
