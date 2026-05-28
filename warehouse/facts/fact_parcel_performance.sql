-- =============================================================================
-- FACT: fact_parcel_performance
-- Grain     : One row per resolved parcel (1:1 with dim_parcel)
-- PK        : parcel_key (same as dim_parcel)
-- Source    : stg_yalidine_parcel_history — aggregated per tracking number
-- Note      : nbr_tentatives_livraison = COUNT of 'Tentative échouée' events.
--             duree_totale_minutes = last_event_ts − first_event_ts in minutes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_parcel_performance (
    parcel_key                BIGINT    PRIMARY KEY REFERENCES warehouse.dim_parcel(parcel_key),
    nbr_evenements            SMALLINT  NOT NULL,             -- total event count per tracking
    duree_totale_minutes      INTEGER,                        -- first event → last event
    nbr_tentatives_livraison  SMALLINT  NOT NULL DEFAULT 0    -- count of 'Tentative échouée' events
);
