-- =============================================================================
-- DIMENSION: dim_agence
-- Grain   : One SCD row per (agency, time period)
-- SCD     : Type 2 — tracks changes to name, type, and address over time
-- Source  : Merged from hrforce.agencies (284 rows) + yalidine.centers (253 rows)
--           linked via agencies.codeYal = centers.hub_id
-- Notes   : Operational agencies (Agence, Hub, Centre de tri, Corner) have a
--           non-null hub_id linking them to the Yalidine center network.
--           Non-operational types (Direction, Parc, Call center…) have hub_id = NULL.
--           The surrogate key agence_key is used in all fact tables.
--           To get the current version of a dim, filter WHERE is_current = TRUE.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_agence (
    agence_key              BIGSERIAL       PRIMARY KEY,

    -- Natural / business key
    agence_id               INTEGER         NOT NULL,               -- HRFORCE agency.id (stable across SCD versions)
    hub_id                  INTEGER,                                -- Yalidine center hub_id; NULL for non-operational

    -- Tracked attributes (SCD Type 2 — changes create a new row)
    name                    VARCHAR(200)    NOT NULL,
    type                    VARCHAR(50)     NOT NULL
                            CHECK (type IN (
                                'Agence', 'Hub', 'Centre de tri', 'Corner',
                                'Centre service clients', 'Direction générale',
                                'Direction régionale', 'Sous direction',
                                'Parc', 'Call center', 'Usine'
                            )),
    address                 VARCHAR(300),

    -- Stable attributes (same across all SCD versions)
    code                    VARCHAR(30)     NOT NULL,               -- HRFORCE code: {seq}-{zipCode}
    code_yal                VARCHAR(20),                            -- hub_id as string; "" for non-operational
    code_yal_two            VARCHAR(10),                            -- short code e.g. HUS1

    -- Geographic foreign keys
    company_key             INTEGER         NOT NULL
                            REFERENCES warehouse.dim_company (company_key),
    wilaya_key              INTEGER         NOT NULL
                            REFERENCES warehouse.dim_wilaya (wilaya_key),
    commune_key             INTEGER
                            REFERENCES warehouse.dim_commune (commune_key),

    -- Denormalized geographic for query performance
    wilaya_id               SMALLINT        NOT NULL,
    wilaya_name             VARCHAR(100)    NOT NULL,
    company_id              INTEGER         NOT NULL,

    -- Operational flags
    is_operational          BOOLEAN         NOT NULL DEFAULT TRUE,  -- FALSE for Direction/Parc/Call center
    service_stopdesk        BOOLEAN         NOT NULL DEFAULT FALSE, -- from yalidine.centers
    service_depot_colis     BOOLEAN         NOT NULL DEFAULT FALSE, -- from yalidine.centers
    gps                     VARCHAR(60),                            -- "lat,lng" from yalidine.centers

    -- SCD Type 2 tracking columns
    valid_from              DATE            NOT NULL DEFAULT CURRENT_DATE,
    valid_to                DATE,                                   -- NULL = currently active record
    is_current              BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.dim_agence IS
    'SCD Type 2 dimension combining HRFORCE agencies and Yalidine centers. ~284 current rows.';
COMMENT ON COLUMN warehouse.dim_agence.agence_id IS
    'Stable business key from HRFORCE. Multiple rows may exist for the same agence_id across SCD versions.';
COMMENT ON COLUMN warehouse.dim_agence.hub_id IS
    'Yalidine center identifier. NULL for non-operational agencies (Direction générale, Parc, etc.).';
COMMENT ON COLUMN warehouse.dim_agence.is_current IS
    'TRUE for the active SCD version. Always filter fact joins with is_current = TRUE when looking up current attributes.';
COMMENT ON COLUMN warehouse.dim_agence.valid_to IS
    'NULL means this record is the current active version. Non-null means it was superseded.';
COMMENT ON COLUMN warehouse.dim_agence.is_operational IS
    'FALSE for Direction générale, Direction régionale, Parc, Call center — these handle no parcels directly.';

-- Composite index for SCD lookups (most common join pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dim_agence_current
    ON warehouse.dim_agence (agence_id) WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_dim_agence_id           ON warehouse.dim_agence (agence_id);
CREATE INDEX IF NOT EXISTS idx_dim_agence_hub_id       ON warehouse.dim_agence (hub_id);
CREATE INDEX IF NOT EXISTS idx_dim_agence_wilaya       ON warehouse.dim_agence (wilaya_key);
CREATE INDEX IF NOT EXISTS idx_dim_agence_company      ON warehouse.dim_agence (company_key);
CREATE INDEX IF NOT EXISTS idx_dim_agence_is_current   ON warehouse.dim_agence (is_current);
CREATE INDEX IF NOT EXISTS idx_dim_agence_valid        ON warehouse.dim_agence (valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_dim_agence_type         ON warehouse.dim_agence (type);
