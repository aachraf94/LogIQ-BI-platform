-- =============================================================================
-- FACT: fact_parcel_revenue
-- Grain     : One row per resolved parcel (1:1 with dim_parcel)
-- PK        : parcel_key (same as dim_parcel)
-- Source    : stg_yalidine_parcel_history — terminal events only
-- Note      : delivery_fee taken from the terminal event; tarif_theorique looked
--             up from dim_pricing at destination wilaya (from dim_parcel → dim_center
--             → dim_agence → dim_commune → dim_wilaya or dim_parcel.zone).
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.fact_parcel_revenue (
    parcel_key        BIGINT        PRIMARY KEY REFERENCES warehouse.dim_parcel(parcel_key),
    delivery_fee      DECIMAL(10,2) NOT NULL,    -- applied logistics fee (DZD)
    tarif_theorique   DECIMAL(10,2),             -- reference from dim_pricing at destination wilaya
    ecart_tarif       DECIMAL(10,2)              -- delivery_fee − tarif_theorique
);

CREATE INDEX IF NOT EXISTS idx_fact_pr_fee ON warehouse.fact_parcel_revenue (delivery_fee);
