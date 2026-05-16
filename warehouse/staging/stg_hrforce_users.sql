-- =============================================================================
-- STAGING: stg_hrforce_users
-- Source : HRFORCE — GET /hrforce/users
-- Grain  : One row per employee (~3 000 rows)
-- Notes  : Sensitive fields (password, CIN, NSS, RIB) are EXCLUDED from
--          this staging table — they must never enter the DW. Nested company,
--          occupation, and agency objects are flattened. supervision.agencies
--          stored as JSONB (array of agency IDs).
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.stg_hrforce_users (
    stg_id              BIGSERIAL       PRIMARY KEY,

    user_id             INTEGER         NOT NULL UNIQUE,            -- source PK — same as whois in parcel_history
    email               VARCHAR(150)    NOT NULL,
    code                VARCHAR(50)     NOT NULL,                   -- format: {id}-{FAMILYNAME}
    role                VARCHAR(30)     NOT NULL,                   -- Employé, Manager, Admin
    status              VARCHAR(20)     NOT NULL,                   -- Actif, Inactif
    family_name         VARCHAR(100)    NOT NULL,
    first_name          VARCHAR(100)    NOT NULL,

    -- Flattened company
    company_id          INTEGER         NOT NULL,
    company_name        VARCHAR(100)    NOT NULL,

    -- Occupation (string only — no ID in source)
    occupation_name     VARCHAR(150),

    -- Flattened agency
    agency_id           INTEGER,                                    -- FK → hrforce.agencies.id
    agency_name         VARCHAR(200),
    agency_code         VARCHAR(30),

    -- Supervisor metadata
    is_supervisor       BOOLEAN         NOT NULL DEFAULT FALSE,
    supervision_agencies JSONB,                                     -- array of supervised agency IDs

    -- ETL metadata
    loaded_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    batch_id            VARCHAR(50),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.stg_hrforce_users IS
    'Staging for ~3 000 HRFORCE employees. Password, CIN, NSS, RIB intentionally excluded.';
COMMENT ON COLUMN warehouse.stg_hrforce_users.user_id IS
    'Matches whois in stg_yalidine_parcel_history and employee_id in stg_paie_bulletins.';
COMMENT ON COLUMN warehouse.stg_hrforce_users.supervision_agencies IS
    'JSONB array of agency IDs supervised by this employee. Empty array [] for non-supervisors.';

CREATE INDEX IF NOT EXISTS idx_stg_users_agency     ON warehouse.stg_hrforce_users (agency_id);
CREATE INDEX IF NOT EXISTS idx_stg_users_company    ON warehouse.stg_hrforce_users (company_id);
CREATE INDEX IF NOT EXISTS idx_stg_users_status     ON warehouse.stg_hrforce_users (status);
CREATE INDEX IF NOT EXISTS idx_stg_users_occupation ON warehouse.stg_hrforce_users (occupation_name);
