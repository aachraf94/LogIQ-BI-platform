-- =============================================================================
-- FACT: fact_livraisons
-- Grain  : One row per parcel (tracking number) — NOT per event
-- Source : Derived from stg_yalidine_parcel_history by collapsing all events
--          for the same tracking number into a single analytical record.
-- Notes  : delivery_fee and zone are NULL for parcels that never reached the
--          Centre status (early failures or in-progress parcels).
--          nbr_evenements = count of history events for this parcel.
--          duree_livraison_minutes = time from first to last recorded event.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_livraisons (
    livraison_key               BIGSERIAL       PRIMARY KEY,

    -- Date dimension keys
    date_creation_key           INTEGER         NOT NULL            -- date of first parcel event (En préparation)
                                REFERENCES warehouse.dim_date (date_key),
    date_livraison_key          INTEGER                             -- date of final resolved event; NULL if in-progress
                                REFERENCES warehouse.dim_date (date_key),

    -- Agency dimension keys
    agence_origine_key          BIGINT          NOT NULL            -- center where parcel was first scanned
                                REFERENCES warehouse.dim_agence (agence_key),
    agence_destination_key      BIGINT                             -- destination center; NULL if not yet routed
                                REFERENCES warehouse.dim_agence (agence_key),

    -- Geographic dimension keys
    wilaya_origine_key          INTEGER         NOT NULL
                                REFERENCES warehouse.dim_wilaya (wilaya_key),
    wilaya_destination_key      INTEGER                             -- NULL until routing
                                REFERENCES warehouse.dim_wilaya (wilaya_key),
    commune_destination_key     INTEGER                             -- NULL until routing
                                REFERENCES warehouse.dim_commune (commune_key),

    -- Company dimension key (seller's company)
    company_key                 INTEGER         NOT NULL
                                REFERENCES warehouse.dim_company (company_key),

    -- Final status dimension key
    statut_final_key            INTEGER         NOT NULL
                                REFERENCES warehouse.dim_statut_colis (statut_key),

    -- Employee who created the first event (saisie)
    employee_saisie_key         BIGINT
                                REFERENCES warehouse.dim_employee (employee_key),

    -- Degenerate dimensions (low cardinality, no separate lookup needed)
    tracking                    VARCHAR(20)     NOT NULL UNIQUE,    -- yal-XXXXXX or sac-XXXXXX
    delivery_type               VARCHAR(2)
                                CHECK (delivery_type IN ('HD', 'SD')),
    parcel_type                 VARCHAR(30)
                                CHECK (parcel_type IN ('ecommerce', 'internal')),

    -- Seller reference (denormalized — seller_id is not a DW-managed entity)
    seller_id                   INTEGER,

    -- Revenue measures
    delivery_fee                NUMERIC(15,2),                      -- DZD; NULL before Centre status
    zone                        SMALLINT,                           -- pricing zone 0–4+; NULL before routing

    -- Parcel Cost Control (PCC) measures — Axis 2 (Should have)
    -- tarif_theorique: ETL fills by looking up zone + delivery_type from stg_yalidine_pricing
    tarif_theorique             NUMERIC(15,2),                      -- expected fee from pricing grid; NULL until zone + delivery_type are known
    -- ecart_tarif_dzd: revenue deviation from tariff (positive = overcharge, negative = under-tariff)
    -- Used by the alerting mechanism to flag pricing anomalies at parcel level
    ecart_tarif_dzd             NUMERIC(15,2),                      -- = delivery_fee - tarif_theorique; NULL when either is NULL

    -- Volume / duration measures
    nbr_evenements              INTEGER         NOT NULL DEFAULT 1, -- count of source history events
    duree_livraison_minutes     INTEGER,                            -- time from first to last event

    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.fact_livraisons IS
    'Core delivery fact table at parcel grain. One row per unique tracking number. ~550K parcels for 36-month dataset. Includes PCC measures (tarif_theorique, ecart_tarif_dzd) for Parcel Cost Control analysis.';
COMMENT ON COLUMN warehouse.fact_livraisons.tracking IS
    'Natural key from source. Degenerate dimension — no separate dim_parcel needed.';
COMMENT ON COLUMN warehouse.fact_livraisons.delivery_fee IS
    'NULL for parcels that never reached the Centre status (early failures, in-progress). DZD.';
COMMENT ON COLUMN warehouse.fact_livraisons.agence_origine_key IS
    'References the is_current=TRUE row of dim_agence for the origin hub at event time.';
COMMENT ON COLUMN warehouse.fact_livraisons.tarif_theorique IS
    'Expected fee from pricing grid. ETL looks up stg_yalidine_pricing by (zone, delivery_type). NULL until zone and delivery_type are known.';
COMMENT ON COLUMN warehouse.fact_livraisons.ecart_tarif_dzd IS
    'Revenue deviation from tariff: delivery_fee - tarif_theorique. Positive = overcharge vs grid, negative = under-tariff. Used by alerting for PCC anomaly detection.';
COMMENT ON COLUMN warehouse.fact_livraisons.nbr_evenements IS
    'Derived: COUNT of rows in stg_yalidine_parcel_history for this tracking number.';
COMMENT ON COLUMN warehouse.fact_livraisons.duree_livraison_minutes IS
    'Derived: EXTRACT(EPOCH FROM (max(date_statut) - min(date_statut))) / 60.';

-- Primary analytical access patterns
CREATE INDEX IF NOT EXISTS idx_fl_date_creation     ON warehouse.fact_livraisons (date_creation_key);
CREATE INDEX IF NOT EXISTS idx_fl_date_livraison    ON warehouse.fact_livraisons (date_livraison_key);
CREATE INDEX IF NOT EXISTS idx_fl_agence_origine    ON warehouse.fact_livraisons (agence_origine_key);
CREATE INDEX IF NOT EXISTS idx_fl_agence_dest       ON warehouse.fact_livraisons (agence_destination_key);
CREATE INDEX IF NOT EXISTS idx_fl_wilaya_dest       ON warehouse.fact_livraisons (wilaya_destination_key);
CREATE INDEX IF NOT EXISTS idx_fl_statut            ON warehouse.fact_livraisons (statut_final_key);
CREATE INDEX IF NOT EXISTS idx_fl_company           ON warehouse.fact_livraisons (company_key);
CREATE INDEX IF NOT EXISTS idx_fl_delivery_type     ON warehouse.fact_livraisons (delivery_type);
CREATE INDEX IF NOT EXISTS idx_fl_parcel_type       ON warehouse.fact_livraisons (parcel_type);
CREATE INDEX IF NOT EXISTS idx_fl_tracking          ON warehouse.fact_livraisons (tracking);
CREATE INDEX IF NOT EXISTS idx_fl_zone              ON warehouse.fact_livraisons (zone);     -- PCC: pricing zone analysis
CREATE INDEX IF NOT EXISTS idx_fl_ecart_tarif       ON warehouse.fact_livraisons (ecart_tarif_dzd) WHERE ecart_tarif_dzd IS NOT NULL; -- PCC: anomaly detection
