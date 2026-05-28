-- =============================================================================
-- DIMENSION: dim_nature_category
-- Grain     : One row per expense category group (8 rows)
-- Source    : stg_cashbox_depenses (SELECT DISTINCT category_group)
-- ETL       : INSERT ... ON CONFLICT (category) DO NOTHING
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_nature_category (
    category_id SMALLINT     PRIMARY KEY,
    category    VARCHAR(50)  UNIQUE NOT NULL
);

INSERT INTO warehouse.dim_nature_category (category_id, category) VALUES
    (1, 'Exploitation'),
    (2, 'Maintenance parc'),
    (3, 'Sinistres'),
    (4, 'RH externalisée'),
    (5, 'RH'),
    (6, 'Immobilier'),
    (7, 'Financier'),
    (8, 'Divers')
ON CONFLICT (category_id) DO NOTHING;
