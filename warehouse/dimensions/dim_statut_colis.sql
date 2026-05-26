-- =============================================================================
-- DIMENSION: dim_statut_colis
-- Grain   : One row per official parcel status (14 statuses + 1 unknown)
-- SCD     : None — Yalidine status list is a fixed business reference
-- Notes   : Seeded with all 14 official Yalidine statuses plus their analytics
--           groupings (phase and status_group). Terminal flags indicate whether
--           no further status progression is expected.
-- =============================================================================


CREATE TABLE IF NOT EXISTS warehouse.dim_statut_colis (
    statut_key      SERIAL          PRIMARY KEY,

    statut_name     VARCHAR(50)     NOT NULL UNIQUE,                -- exact API status string

-- Analytics groupings (derived from business_rules.md section 3)
phase VARCHAR(30) NOT NULL CHECK (
    phase IN (
        'creation',
        'outbound',
        'transit',
        'delivery_prep',
        'delivery_attempt',
        'delivered',
        'failed',
        'return_transit',
        'return_final',
        'unknown'
    )
),
status_group VARCHAR(30) NOT NULL CHECK (
    status_group IN (
        'creation',
        'outbound',
        'transit',
        'delivery_prep',
        'delivery_attempt',
        'delivered',
        'failed',
        'return_transit',
        'return_final',
        'unknown'
    )
),

-- Terminal flags
is_terminal BOOLEAN NOT NULL DEFAULT FALSE, -- no further status follows
is_success BOOLEAN NOT NULL DEFAULT FALSE, -- Livré only

-- Display ordering
sort_order      SMALLINT        NOT NULL,

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON
TABLE warehouse.dim_statut_colis IS '14 official Yalidine parcel statuses with analytics phase/group classification.';

COMMENT ON COLUMN warehouse.dim_statut_colis.is_terminal IS 'TRUE for Livré, Echec, retourné au vendeur — no subsequent status events expected.';

COMMENT ON COLUMN warehouse.dim_statut_colis.status_group IS 'Used for dashboard KPI grouping: delivered/failed/in_return etc.';

-- Seed all 14 official statuses
INSERT INTO
    warehouse.dim_statut_colis (
        statut_name,
        phase,
        status_group,
        is_terminal,
        is_success,
        sort_order
    )
VALUES (
        'En préparation',
        'creation',
        'creation',
        FALSE,
        FALSE,
        1
    ),
    (
        'Prêt à expédier',
        'creation',
        'creation',
        FALSE,
        FALSE,
        2
    ),
    (
        'Expédié',
        'outbound',
        'outbound',
        FALSE,
        FALSE,
        3
    ),
    (
        'Vers wilaya',
        'transit',
        'transit',
        FALSE,
        FALSE,
        4
    ),
    (
        'Transfert',
        'transit',
        'transit',
        FALSE,
        FALSE,
        5
    ),
    (
        'Reçu à wilaya',
        'transit',
        'transit',
        FALSE,
        FALSE,
        6
    ),
    (
        'Centre',
        'delivery_prep',
        'delivery_prep',
        FALSE,
        FALSE,
        7
    ),
    (
        'Tentative',
        'delivery_attempt',
        'delivery_attempt',
        FALSE,
        FALSE,
        8
    ),
    (
        'Livré',
        'delivered',
        'delivered',
        TRUE,
        TRUE,
        9
    ),
    (
        'Echec',
        'failed',
        'failed',
        TRUE,
        FALSE,
        10
    ),
    (
        'Retourner au centre',
        'return_transit',
        'return_transit',
        FALSE,
        FALSE,
        11
    ),
    (
        'Retourner vers centre',
        'return_transit',
        'return_transit',
        FALSE,
        FALSE,
        12
    ),
    (
        'Retour groupé',
        'return_transit',
        'return_transit',
        FALSE,
        FALSE,
        13
    ),
    (
        'Retour à retirer',
        'return_final',
        'return_final',
        TRUE,
        FALSE,
        14
    ),
    (
        'retourné au vendeur',
        'return_final',
        'return_final',
        TRUE,
        FALSE,
        15
    ),
    (
        'Inconnu',
        'unknown',
        'unknown',
        FALSE,
        FALSE,
        99
    ) ON CONFLICT (statut_name) DO NOTHING;