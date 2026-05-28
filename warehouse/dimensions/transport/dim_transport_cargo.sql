-- =============================================================================
-- DIMENSION: dim_transport_cargo — Junk Dimension
-- Grain     : One row per distinct combination of cargo flags (~variable)
-- Source    : stg_transport_requests — distinct (merchandise_type_id, fragile,
--             hazardous, requires_clark, requires_packaging) combinations
-- ETL       : INSERT ... ON CONFLICT (merchandise_type_id, fragile, hazardous,
--             requires_clark, requires_packaging) DO NOTHING
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_transport_cargo (
    cargo_key            SMALLSERIAL PRIMARY KEY,
    merchandise_type_id  SMALLINT    REFERENCES warehouse.dim_transport_merchandise_type(merchandise_type_id),
    fragile              BOOLEAN     NOT NULL,
    hazardous            BOOLEAN     NOT NULL,
    requires_clark       BOOLEAN     NOT NULL,  -- TRUE when nbr_pieces_gte200kg > 0
    requires_packaging   BOOLEAN     NOT NULL,

    CONSTRAINT uq_cargo_profile UNIQUE (merchandise_type_id, fragile, hazardous, requires_clark, requires_packaging)
);

