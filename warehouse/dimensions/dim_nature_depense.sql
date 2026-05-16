-- =============================================================================
-- DIMENSION: dim_nature_depense
-- Grain   : One row per (nature, rubrique) pair — rubrique grain for max precision
--           Some natures have no rubrique: those are represented with rubrique_id = NULL
-- SCD     : None — expense categories are static seed data
-- Notes   : Denormalizing nature attributes into each rubrique row avoids a
--           snowflake join. Queries can filter on nature_id, category_group,
--           or rubrique_id without additional joins.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_nature_depense (
    nature_depense_key  SERIAL          PRIMARY KEY,

    -- Nature (parent)
    nature_id           INTEGER         NOT NULL,                   -- cashbox.natures.nature_id
    nature_name         VARCHAR(100)    NOT NULL,
    category_group      VARCHAR(50)     NOT NULL                    -- Exploitation, Maintenance parc, Sinistres, RH, Immobilier, Financier, Divers
                        CHECK (category_group IN (
                            'Exploitation', 'Maintenance parc', 'Sinistres',
                            'RH externalisée', 'RH', 'Immobilier', 'Financier', 'Divers'
                        )),

    -- Rubrique (child — nullable when expense has no rubrique)
    rubrique_id         INTEGER,                                    -- cashbox.rubriques.rubrique_id
    rubrique_name       VARCHAR(150),

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    UNIQUE (nature_id, rubrique_id)
);

COMMENT ON TABLE warehouse.dim_nature_depense IS
    'Denormalized expense category dimension at rubrique grain (~48 rows: 13 natures × avg rubriques + nulls).';
COMMENT ON COLUMN warehouse.dim_nature_depense.rubrique_id IS
    'NULL when an expense record has no rubrique assigned. Always match on (nature_id, rubrique_id) from fact.';
COMMENT ON COLUMN warehouse.dim_nature_depense.category_group IS
    'High-level grouping for dashboard cost breakdown widgets.';

-- Seed all 13 natures + their rubriques
INSERT INTO warehouse.dim_nature_depense (nature_id, nature_name, category_group, rubrique_id, rubrique_name) VALUES
-- Nature 1: Carburant (Exploitation) — 3 rubriques
(1, 'Carburant', 'Exploitation', 1,    'Carburant véhicules livraison'),
(1, 'Carburant', 'Exploitation', 2,    'Carburant véhicules ramassage'),
(1, 'Carburant', 'Exploitation', 3,    'Carburant véhicules direction'),
-- Nature 2: Réparation véhicules (Maintenance parc)
(2, 'Réparation véhicules', 'Maintenance parc', 4,  'Réparation moteur'),
(2, 'Réparation véhicules', 'Maintenance parc', 5,  'Réparation carrosserie'),
(2, 'Réparation véhicules', 'Maintenance parc', 6,  'Maintenance préventive'),
-- Nature 3: Remboursement colis perdu (Sinistres)
(3, 'Remboursement colis perdu', 'Sinistres', 7,    'Indemnisation perte totale'),
-- Nature 4: Remboursement colis endommagé (Sinistres)
(4, 'Remboursement colis endommagé', 'Sinistres', 8, 'Indemnisation dommage partiel'),
-- Nature 5: Paiement livreurs freelance (RH externalisée)
(5, 'Paiement livreurs freelance', 'RH externalisée', 9, 'Paiement à la course'),
-- Nature 6: Charges consommables (Exploitation)
(6, 'Charges consommables', 'Exploitation', 10, 'Fournitures de bureau'),
(6, 'Charges consommables', 'Exploitation', 11, 'Emballages et consommables logistiques'),
-- Nature 7: Amortissement (Financier)
(7, 'Amortissement', 'Financier', 12, 'Amortissement véhicules'),
(7, 'Amortissement', 'Financier', 13, 'Amortissement matériel informatique'),
-- Nature 8: Loyer et charges locatives (Immobilier)
(8, 'Loyer et charges locatives', 'Immobilier', 14, 'Loyer agence'),
(8, 'Loyer et charges locatives', 'Immobilier', 15, 'Charges locatives (eau, électricité)'),
-- Nature 9: Entretien locaux (Immobilier)
(9, 'Entretien locaux', 'Immobilier', 16, 'Nettoyage et entretien'),
(9, 'Entretien locaux', 'Immobilier', 17, 'Travaux de réparation'),
-- Nature 10: Achat pièces parc véhicules (Maintenance parc)
(10, 'Achat pièces parc véhicules', 'Maintenance parc', 18, 'Pièces mécaniques'),
(10, 'Achat pièces parc véhicules', 'Maintenance parc', 19, 'Pneus et pneumatiques'),
-- Nature 11: Frais bancaires (Financier)
(11, 'Frais bancaires', 'Financier', 20, 'Commissions bancaires'),
(11, 'Frais bancaires', 'Financier', 21, 'Frais de virement'),
-- Nature 12: Avance sur salaire (RH)
(12, 'Avance sur salaire', 'RH', 22, 'Avance exceptionnelle'),
-- Nature 13: Autres charges (Divers)
(13, 'Autres charges', 'Divers', 23, 'Charges diverses non catégorisées'),
-- Catch-all rows for expenses with no rubrique (rubrique_id = NULL)
(1,  'Carburant',                   'Exploitation',     NULL, NULL),
(2,  'Réparation véhicules',        'Maintenance parc', NULL, NULL),
(3,  'Remboursement colis perdu',   'Sinistres',        NULL, NULL),
(4,  'Remboursement colis endommagé','Sinistres',       NULL, NULL),
(5,  'Paiement livreurs freelance', 'RH externalisée',  NULL, NULL),
(6,  'Charges consommables',        'Exploitation',     NULL, NULL),
(7,  'Amortissement',               'Financier',        NULL, NULL),
(8,  'Loyer et charges locatives',  'Immobilier',       NULL, NULL),
(9,  'Entretien locaux',            'Immobilier',       NULL, NULL),
(10, 'Achat pièces parc véhicules', 'Maintenance parc', NULL, NULL),
(11, 'Frais bancaires',             'Financier',        NULL, NULL),
(12, 'Avance sur salaire',          'RH',               NULL, NULL),
(13, 'Autres charges',              'Divers',           NULL, NULL)
ON CONFLICT (nature_id, rubrique_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_dim_nature_id    ON warehouse.dim_nature_depense (nature_id);
CREATE INDEX IF NOT EXISTS idx_dim_rubrique_id  ON warehouse.dim_nature_depense (rubrique_id);
CREATE INDEX IF NOT EXISTS idx_dim_cat_group    ON warehouse.dim_nature_depense (category_group);
