-- =============================================================================
-- DIMENSION: dim_vehicle_type
-- Grain   : One row per vehicle category (5 types — static)
-- SCD     : None — vehicle categories are a fixed business reference
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_vehicle_type (
    vehicle_type_key    SERIAL          PRIMARY KEY,

    vehicle_type        VARCHAR(20)     NOT NULL UNIQUE
                        CHECK (vehicle_type IN ('moto', 'citadine', 'break', 'camionnette', 'camion')),
    description_fr      VARCHAR(100)    NOT NULL,
    payload_class       VARCHAR(20)     NOT NULL,                   -- léger, moyen, lourd

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.dim_vehicle_type IS
    '5 dedicated transport vehicle categories. Payload class enables weight-tier analysis.';

-- Seed static vehicle types
INSERT INTO warehouse.dim_vehicle_type (vehicle_type, description_fr, payload_class) VALUES
    ('moto',        'Moto / scooter de livraison',        'léger'),
    ('citadine',    'Voiture de tourisme citadine',        'léger'),
    ('break',       'Break utilitaire',                    'léger'),
    ('camionnette', 'Camionnette / fourgon utilitaire',    'moyen'),
    ('camion',      'Camion poids lourd',                  'lourd')
ON CONFLICT (vehicle_type) DO NOTHING;
