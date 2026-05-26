"""
Fact table loader assets — one asset per fact table.
All facts use UPSERT on their business key to support re-runs safely.
Dimension key lookups are done via SQL JOINs inside the INSERT statement for performance.
"""

from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.database import WarehousePostgresResource


@asset(
    group_name="facts",
    deps=[
        "stg_yalidine_parcel_history", "stg_yalidine_pricing",
        "dim_agence", "dim_wilaya", "dim_commune", "dim_company",
        "dim_statut_colis", "dim_employee", "dim_date",
    ],
    description=(
        "Aggregate stg_yalidine_parcel_history to parcel grain → fact_livraisons. "
        "Computes tarif_theorique (PCC) from stg_yalidine_pricing via zone+delivery_type lookup."
    ),
)
def fact_livraisons(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_livraisons (
                    date_creation_key, date_livraison_key,
                    agence_origine_key, agence_destination_key,
                    wilaya_origine_key, wilaya_destination_key, commune_destination_key,
                    company_key, statut_final_key, employee_saisie_key,
                    tracking, delivery_type, parcel_type, seller_id,
                    delivery_fee, zone,
                    tarif_theorique, ecart_tarif_dzd,
                    nbr_evenements, duree_livraison_minutes
                )
                WITH first_event AS (
                    -- First event per tracking (parcel creation — En préparation)
                    SELECT DISTINCT ON (tracking)
                        tracking, date_statut, hub_id, whois, seller_company_id, depart_wilaya_id
                    FROM warehouse.stg_yalidine_parcel_history
                    ORDER BY tracking, date_statut ASC
                ),
                last_event AS (
                    -- Last event per tracking (final resolved state)
                    SELECT DISTINCT ON (tracking)
                        tracking, date_statut AS last_date
                    FROM warehouse.stg_yalidine_parcel_history
                    ORDER BY tracking, date_statut DESC
                ),
                parcel_agg AS (
                    SELECT
                        h.tracking,
                        MIN(h.date_statut)                                              AS first_dt,
                        MAX(h.date_statut)                                              AS last_dt,
                        MAX(h.current_status)                                           AS current_status,
                        MAX(h.hub_id)          FILTER (WHERE h.hub_id IS NOT NULL)      AS hub_id,
                        MAX(h.destination_hub_id) FILTER (WHERE h.destination_hub_id IS NOT NULL) AS dest_hub_id,
                        MAX(h.depart_wilaya_id) FILTER (WHERE h.depart_wilaya_id IS NOT NULL) AS depart_wilaya_id,
                        MAX(h.destination_wilaya_id) FILTER (WHERE h.destination_wilaya_id IS NOT NULL) AS dest_wilaya_id,
                        MAX(h.destination_commune_id) FILTER (WHERE h.destination_commune_id IS NOT NULL) AS dest_commune_id,
                        MAX(h.delivery_type)   FILTER (WHERE h.delivery_type IS NOT NULL) AS delivery_type,
                        MAX(h.zone)            FILTER (WHERE h.zone IS NOT NULL)        AS zone,
                        MAX(h.delivery_fee)    FILTER (WHERE h.delivery_fee IS NOT NULL) AS delivery_fee,
                        MAX(h.parcel_type)     FILTER (WHERE h.parcel_type IS NOT NULL) AS parcel_type,
                        MAX(h.seller_id)       FILTER (WHERE h.seller_id IS NOT NULL)   AS seller_id,
                        MAX(h.seller_company_id)                                        AS seller_company_id,
                        COUNT(*)                                                        AS nbr_evenements,
                        EXTRACT(EPOCH FROM (MAX(h.date_statut) - MIN(h.date_statut)))::INTEGER / 60
                                                                                        AS duree_minutes
                    FROM warehouse.stg_yalidine_parcel_history h
                    GROUP BY h.tracking
                ),
                -- Resolve whether a livraison_date applies (only for terminal statuses)
                is_terminal AS (
                    SELECT statut_name,
                           statut_name IN ('Livré','retourné au vendeur','Retour à retirer','Echec',
                                           'Retour groupé') AS terminal
                    FROM warehouse.dim_statut_colis
                ),
                pricing AS (
                    SELECT wilaya_id, tarif::NUMERIC(15,2) AS tarif_hd, tarif_stopdesk::NUMERIC(15,2) AS tarif_sd
                    FROM warehouse.stg_yalidine_pricing
                    WHERE service_type = 'livraison' AND is_active = TRUE
                ),
                -- hub_id is not unique in dim_agence (multiple agence_id may share one hub_id);
                -- deduplicate so the JOIN below never fans out.
                hub_agences AS (
                    SELECT DISTINCT ON (hub_id) hub_id, agence_key
                    FROM warehouse.dim_agence
                    WHERE is_current = TRUE AND hub_id IS NOT NULL
                    ORDER BY hub_id, agence_key
                )
                SELECT
                    dd_c.date_key                       AS date_creation_key,
                    CASE WHEN t.terminal THEN dd_l.date_key END AS date_livraison_key,
                    ao.agence_key                       AS agence_origine_key,
                    ad.agence_key                       AS agence_destination_key,
                    wo.wilaya_key                       AS wilaya_origine_key,
                    wd.wilaya_key                       AS wilaya_destination_key,
                    cd.commune_key                      AS commune_destination_key,
                    dc.company_key,
                    sc.statut_key                       AS statut_final_key,
                    emp.employee_key                    AS employee_saisie_key,
                    pa.tracking,
                    pa.delivery_type,
                    pa.parcel_type,
                    pa.seller_id,
                    pa.delivery_fee,
                    pa.zone,
                    -- PCC: tarif_theorique lookup by destination_wilaya + delivery_type
                    CASE pa.delivery_type
                        WHEN 'HD' THEN pr.tarif_hd
                        WHEN 'SD' THEN pr.tarif_sd
                    END                                 AS tarif_theorique,
                    CASE
                        WHEN pa.delivery_fee IS NOT NULL
                         AND CASE pa.delivery_type WHEN 'HD' THEN pr.tarif_hd WHEN 'SD' THEN pr.tarif_sd END IS NOT NULL
                        THEN pa.delivery_fee - CASE pa.delivery_type WHEN 'HD' THEN pr.tarif_hd WHEN 'SD' THEN pr.tarif_sd END
                    END                                 AS ecart_tarif_dzd,
                    pa.nbr_evenements,
                    pa.duree_minutes                    AS duree_livraison_minutes
                FROM parcel_agg pa
                -- Date keys
                JOIN warehouse.dim_date dd_c ON dd_c.full_date = pa.first_dt::DATE
                LEFT JOIN warehouse.dim_date dd_l ON dd_l.full_date = pa.last_dt::DATE
                LEFT JOIN is_terminal t ON t.statut_name = pa.current_status
                -- Agency keys (current SCD2 rows)
                LEFT JOIN hub_agences ao ON ao.hub_id = pa.hub_id
                LEFT JOIN hub_agences ad ON ad.hub_id = pa.dest_hub_id
                -- Wilaya/commune keys
                LEFT JOIN warehouse.dim_wilaya wo ON wo.wilaya_id = pa.depart_wilaya_id
                LEFT JOIN warehouse.dim_wilaya wd ON wd.wilaya_id = pa.dest_wilaya_id
                LEFT JOIN warehouse.dim_commune cd ON cd.commune_id = pa.dest_commune_id
                -- Company key (seller company)
                LEFT JOIN warehouse.dim_company dc ON dc.company_id = pa.seller_company_id
                -- Status key
                LEFT JOIN warehouse.dim_statut_colis sc ON sc.statut_name = pa.current_status
                -- Employee key (creator of first event)
                LEFT JOIN first_event fe ON fe.tracking = pa.tracking
                LEFT JOIN warehouse.dim_employee emp
                    ON emp.employee_id = fe.whois AND emp.is_current = TRUE
                -- Pricing lookup for PCC
                LEFT JOIN pricing pr ON pr.wilaya_id = pa.dest_wilaya_id
                WHERE dd_c.date_key IS NOT NULL
                  AND sc.statut_key IS NOT NULL
                  AND dc.company_key IS NOT NULL
                  AND ao.agence_key IS NOT NULL

                ON CONFLICT (tracking) DO UPDATE SET
                    date_livraison_key     = EXCLUDED.date_livraison_key,
                    agence_destination_key = EXCLUDED.agence_destination_key,
                    wilaya_destination_key = EXCLUDED.wilaya_destination_key,
                    statut_final_key       = EXCLUDED.statut_final_key,
                    delivery_fee           = EXCLUDED.delivery_fee,
                    zone                   = EXCLUDED.zone,
                    tarif_theorique        = EXCLUDED.tarif_theorique,
                    ecart_tarif_dzd        = EXCLUDED.ecart_tarif_dzd,
                    nbr_evenements         = EXCLUDED.nbr_evenements,
                    duree_livraison_minutes= EXCLUDED.duree_livraison_minutes,
                    updated_at             = NOW()
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} livraisons")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="facts",
    deps=["stg_cashbox_depenses", "dim_agence", "dim_company", "dim_nature_depense", "dim_employee", "dim_date"],
    description="Load stg_cashbox_depenses → fact_depenses",
)
def fact_depenses(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_depenses (
                    date_depense_key, date_creation_key, agence_key, company_key, nature_depense_key,
                    employee_requester_key, employee_validator_key,
                    depense_id, status, mode_paiement, montant, quantite
                )
                SELECT
                    dd.date_key,
                    dd_c.date_key,
                    a.agence_key,
                    dc.company_key,
                    nd.nature_depense_key,
                    emp_req.employee_key,
                    emp_val.employee_key,
                    s.depense_id,
                    s.status,
                    s.mode_paiement,
                    s.montant,
                    s.quantite
                FROM warehouse.stg_cashbox_depenses s
                JOIN warehouse.dim_date dd   ON dd.full_date   = s.date_depense
                JOIN warehouse.dim_date dd_c ON dd_c.full_date = s.created_at_src::DATE
                JOIN warehouse.dim_agence a ON a.agence_id = s.agence_id AND a.is_current = TRUE
                JOIN warehouse.dim_company dc ON dc.company_id = s.entreprise_id
                JOIN warehouse.dim_nature_depense nd
                    ON nd.nature_id = s.nature_id
                    AND (nd.rubrique_id = s.rubrique_id OR (nd.rubrique_id IS NULL AND s.rubrique_id IS NULL))
                LEFT JOIN warehouse.dim_employee emp_req
                    ON emp_req.employee_id = s.requested_by_user_id AND emp_req.is_current = TRUE
                LEFT JOIN warehouse.dim_employee emp_val
                    ON emp_val.employee_id = s.validated_by_user_id AND emp_val.is_current = TRUE
                WHERE dc.company_id != 9

                ON CONFLICT (depense_id) DO UPDATE SET
                    status     = EXCLUDED.status,
                    montant    = EXCLUDED.montant,
                    updated_at = NOW()
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} depenses")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="facts",
    deps=["stg_cashbox_remboursements", "dim_agence", "dim_date"],
    description="Load stg_cashbox_remboursements → fact_remboursements",
)
def fact_remboursements(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_remboursements (
                    date_remboursement_key, agence_key, company_key,
                    employee_validator_key,
                    remboursement_id, colis_tracking, sinistre_type, mode_paiement,
                    declared_value, montant_rembourse,
                    taux_remboursement
                )
                SELECT
                    dd.date_key,
                    a.agence_key,
                    dc.company_key,
                    emp.employee_key,
                    s.remboursement_id,
                    s.colis_tracking,
                    s.sinistre_type,
                    s.mode_paiement,
                    s.declared_value,
                    s.montant_rembourse,
                    CASE WHEN s.declared_value > 0
                        THEN ROUND(s.montant_rembourse / s.declared_value * 100, 2)
                    END
                FROM warehouse.stg_cashbox_remboursements s
                JOIN warehouse.dim_date dd ON dd.full_date = s.date_remboursement
                JOIN warehouse.dim_agence a ON a.agence_id = s.agence_responsable_id AND a.is_current = TRUE
                JOIN warehouse.dim_company dc ON dc.company_key = a.company_key
                LEFT JOIN warehouse.dim_employee emp
                    ON emp.employee_id = s.validated_by_user_id AND emp.is_current = TRUE

                ON CONFLICT (remboursement_id) DO UPDATE SET
                    montant_rembourse  = EXCLUDED.montant_rembourse,
                    taux_remboursement = EXCLUDED.taux_remboursement,
                    updated_at         = NOW()
            """)
            n = cur.rowcount
    context.log.info(f"Inserted {n} remboursements")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="facts",
    deps=["stg_cashbox_paiements_livreurs", "dim_agence", "dim_freelance_driver", "dim_date"],
    description="Load stg_cashbox_paiements_livreurs → fact_paiements_livreurs",
)
def fact_paiements_livreurs(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_paiements_livreurs (
                    date_paiement_key, date_debut_periode_key, date_fin_periode_key,
                    agence_key, driver_key, employee_validator_key,
                    paiement_id, mode_paiement,
                    nbr_colis_livres, nbr_colis_echoues, nbr_jours_travailles, nbr_tournees,
                    tarif_par_colis, tarif_par_colis_echoue,
                    montant_colis_livres, montant_colis_echoues,
                    prime_rendement, deductions, total_brut, total_net
                )
                SELECT
                    dd.date_key,
                    dd_debut.date_key,
                    dd_fin.date_key,
                    a.agence_key,
                    drv.driver_key,
                    emp_val.employee_key,
                    s.paiement_id,
                    s.mode_paiement,
                    s.nbr_colis_livres,
                    s.nbr_colis_echoues,
                    s.nbr_jours_travailles,
                    s.nbr_tournees,
                    s.tarif_par_colis,
                    s.tarif_par_colis_echoue,
                    s.montant_colis_livres,
                    s.montant_colis_echoues,
                    s.prime_rendement,
                    COALESCE(s.deductions, 0),
                    s.total_brut,
                    s.total_net
                FROM warehouse.stg_cashbox_paiements_livreurs s
                JOIN warehouse.dim_date dd       ON dd.full_date       = s.date_paiement
                JOIN warehouse.dim_date dd_debut ON dd_debut.full_date = s.period_from
                JOIN warehouse.dim_date dd_fin   ON dd_fin.full_date   = s.period_to
                JOIN warehouse.dim_agence a ON a.agence_id = s.agence_id AND a.is_current = TRUE
                JOIN warehouse.dim_freelance_driver drv ON drv.livreur_id = s.livreur_id
                LEFT JOIN warehouse.dim_employee emp_val
                    ON emp_val.employee_id = s.validated_by_user_id AND emp_val.is_current = TRUE

                ON CONFLICT (paiement_id) DO UPDATE SET
                    total_net  = EXCLUDED.total_net,
                    updated_at = NOW()
            """)
            n = cur.rowcount
    context.log.info(f"Inserted {n} paiements livreurs")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="facts",
    deps=["stg_paie_bulletins", "dim_employee", "dim_agence", "dim_company", "dim_occupation", "dim_date"],
    description="Load stg_paie_bulletins → fact_bulletins_salaire",
)
def fact_bulletins_salaire(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_bulletins_salaire (
                    date_paiement_key, period_month, period_year,
                    employee_key, agence_key, company_key, occupation_key,
                    bulletin_id, contract_type, regime, mode_paiement,
                    seniority_years, seniority_months,
                    base_salary, anciennete, prime_rendement, prime_panier,
                    prime_transport, heures_sup_amount, heures_sup_hours, autres_primes, total_brut,
                    cotisation_securite_sociale, irg, autres_retenues, total_deductions,
                    cotisation_patronale_cnas, cotisation_retraite, accident_travail,
                    total_charges_patronales, net_a_payer,
                    jours_travailles, jours_absence, jours_conge, jours_maladie,
                    heures_normales, heures_sup
                )
                -- DISTINCT ON prevents CardinalityViolation when dim_occupation has multiple rows
                -- for the same occupation_name (one per company/service). ORDER BY bulletin_id DESC
                -- keeps the latest bulletin when an employee has multiple for the same period.
                SELECT DISTINCT ON (emp.employee_key, s.period_month, s.period_year)
                    dd.date_key,
                    s.period_month, s.period_year,
                    emp.employee_key,
                    a.agence_key,
                    dc.company_key,
                    occ.occupation_key,
                    s.bulletin_id,
                    s.contract_type, s.regime, s.mode_paiement,
                    s.seniority_years, s.seniority_months,
                    s.base_salary, s.anciennete, s.prime_rendement, s.prime_panier,
                    s.prime_transport, s.heures_sup_amount, s.heures_sup_hours, s.autres_primes, s.total_brut,
                    s.cotisation_securite_sociale, s.irg, s.autres_retenues, s.total_deductions,
                    s.cotisation_patronale_cnas, s.cotisation_retraite, s.accident_travail,
                    s.total_charges_patronales, s.net_a_payer,
                    s.jours_travailles, s.jours_absence, s.jours_conge, s.jours_maladie,
                    s.heures_normales, s.heures_sup
                FROM warehouse.stg_paie_bulletins s
                JOIN warehouse.dim_date dd ON dd.full_date = s.payment_date
                JOIN warehouse.dim_employee emp ON emp.employee_id = s.employee_id AND emp.is_current = TRUE
                JOIN warehouse.dim_agence a ON a.agence_id = s.agency_id AND a.is_current = TRUE
                JOIN warehouse.dim_company dc ON dc.company_id = s.company_id
                JOIN warehouse.dim_occupation occ ON occ.occupation_name = s.occupation
                WHERE dc.company_id != 9
                ORDER BY emp.employee_key, s.period_month, s.period_year, s.bulletin_id DESC

                ON CONFLICT (bulletin_id) DO UPDATE SET
                    employee_key             = EXCLUDED.employee_key,
                    agence_key               = EXCLUDED.agence_key,
                    company_key              = EXCLUDED.company_key,
                    occupation_key           = EXCLUDED.occupation_key,
                    net_a_payer              = EXCLUDED.net_a_payer,
                    total_brut               = EXCLUDED.total_brut,
                    total_charges_patronales = EXCLUDED.total_charges_patronales,
                    jours_absence            = EXCLUDED.jours_absence,
                    updated_at               = NOW()
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} bulletins salaire")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="facts",
    deps=[
        "stg_transport_requests",
        "dim_agence", "dim_wilaya", "dim_commune", "dim_employee",
        "dim_vehicle_type", "dim_company", "dim_date",
    ],
    description="Load stg_transport_requests → fact_transport (all 10 cost components)",
)
def fact_transport(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_transport (
                    date_creation_key, date_completion_key,
                    agence_dispatch_key, wilaya_depart_key, wilaya_arrivee_key,
                    commune_depart_key, commune_arrivee_key,
                    driver_employee_key, second_driver_key,
                    vehicle_type_key, company_key,
                    request_id, service_type, sub_service_type, status,
                    client_type, payment_status, merchandise_type,
                    total_weight_kg, total_volume_m3, nbr_pieces,
                    nbr_pieces_lt50kg, nbr_pieces_50_99kg, nbr_pieces_100_199kg, nbr_pieces_gte200kg,
                    declared_value_dzd,
                    nbr_stops_pickup, nbr_stops_delivery, nbr_stops_total,
                    distance_unit_km, distance_real_km, distance_extra_km,
                    total_vehicle_km, total_duration_minutes, total_waiting_time_minutes,
                    night_shift_hours, nbr_floors,
                    cout_base, cout_distance_supp, cout_ramassage, cout_livraison,
                    cout_manutention, cout_emballage, cout_tarif_nuit, cout_prod_frais,
                    cout_assurance, cout_carburant, cout_peage, total_cost,
                    amount_invoiced, amount_paid,
                    departure_delay_minutes, arrival_delay_minutes, client_rating,
                    fragile, hazardous, requires_clark, requires_packaging,
                    is_night_shift, return_trip, on_time
                )
                WITH hub_agences AS (
                    SELECT DISTINCT ON (hub_id) hub_id, agence_key
                    FROM warehouse.dim_agence
                    WHERE is_current = TRUE AND hub_id IS NOT NULL
                    ORDER BY hub_id, agence_key
                )
                SELECT
                    dd_c.date_key,
                    dd_cp.date_key,
                    a.agence_key,
                    wd.wilaya_key, wa.wilaya_key,
                    cd.commune_key, ca.commune_key,
                    drv.employee_key, drv2.employee_key,
                    vt.vehicle_type_key,
                    dc.company_key,
                    s.request_id, s.service_type, s.sub_service_type, s.status,
                    s.client_type, s.payment_status, s.merchandise_type,
                    s.total_weight_kg, s.total_volume_m3, s.nbr_pieces,
                    s.nbr_pieces_lt50kg, s.nbr_pieces_50_99kg, s.nbr_pieces_100_199kg, s.nbr_pieces_gte200kg,
                    s.declared_value_dzd,
                    s.nbr_stops_pickup, s.nbr_stops_delivery, s.nbr_stops_total,
                    s.distance_unit_km, s.distance_real_km, s.distance_extra_km,
                    s.total_vehicle_km, s.total_duration_minutes, s.total_waiting_time_minutes,
                    s.night_shift_hours, s.nbr_floors,
                    s.cout_base, s.cout_distance_supp, s.cout_ramassage, s.cout_livraison,
                    s.cout_manutention, s.cout_emballage, s.cout_tarif_nuit, s.cout_prod_frais,
                    s.cout_assurance, s.cout_carburant, s.cout_peage, s.total_cost,
                    s.amount_invoiced, s.amount_paid,
                    s.departure_delay_minutes, s.arrival_delay_minutes, s.client_rating,
                    s.fragile, s.hazardous, s.requires_clark, s.requires_packaging,
                    s.is_night_shift, s.return_trip, s.on_time
                FROM warehouse.stg_transport_requests s
                JOIN warehouse.dim_date dd_c ON dd_c.full_date = s.created_at_src::DATE
                LEFT JOIN warehouse.dim_date dd_cp ON dd_cp.full_date = s.completed_at::DATE
                LEFT JOIN hub_agences a ON a.hub_id = s.dispatched_from_hub_id
                JOIN warehouse.dim_wilaya wd ON wd.wilaya_id = s.depart_wilaya_id
                JOIN warehouse.dim_wilaya wa ON wa.wilaya_id = s.arrival_wilaya_id
                LEFT JOIN warehouse.dim_commune cd ON cd.commune_id = s.depart_commune_id
                LEFT JOIN warehouse.dim_commune ca ON ca.commune_id = s.arrival_commune_id
                JOIN warehouse.dim_employee drv ON drv.employee_id = s.driver_id AND drv.is_current = TRUE
                LEFT JOIN warehouse.dim_employee drv2 ON drv2.employee_id = s.second_driver_id AND drv2.is_current = TRUE
                JOIN warehouse.dim_vehicle_type vt ON vt.vehicle_type = s.vehicle_type
                LEFT JOIN warehouse.dim_company dc ON dc.company_id = s.client_company_id

                ON CONFLICT (request_id) DO UPDATE SET
                    status                 = EXCLUDED.status,
                    date_completion_key    = EXCLUDED.date_completion_key,
                    amount_paid            = EXCLUDED.amount_paid,
                    payment_status         = EXCLUDED.payment_status,
                    on_time                = EXCLUDED.on_time,
                    client_rating          = EXCLUDED.client_rating,
                    updated_at             = NOW()
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} transport requests")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="facts",
    deps=["stg_cashbox_transferts", "dim_agence", "dim_date"],
    description=(
        "Load stg_cashbox_transferts → fact_transferts_caisse. "
        "Fund transfers are NEVER mixed with expenses — kept in a separate fact table."
    ),
)
def fact_transferts_caisse(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.fact_transferts_caisse (
                    date_transfert_key, agence_source_key, agence_destination_key,
                    employee_validator_key, transfert_id, banque_name, montant
                )
                SELECT
                    dd.date_key,
                    asrc.agence_key,
                    adst.agence_key,
                    emp.employee_key,
                    s.transfert_id,
                    s.banque_name,
                    s.montant
                FROM warehouse.stg_cashbox_transferts s
                JOIN warehouse.dim_date dd ON dd.full_date = s.date_transfert
                JOIN warehouse.dim_agence asrc ON asrc.agence_id = s.agence_source_id AND asrc.is_current = TRUE
                JOIN warehouse.dim_agence adst ON adst.agence_id = s.agence_dest_id AND adst.is_current = TRUE
                LEFT JOIN warehouse.dim_employee emp
                    ON emp.employee_id = s.validated_by_user_id AND emp.is_current = TRUE

                ON CONFLICT (transfert_id) DO UPDATE SET
                    montant    = EXCLUDED.montant,
                    updated_at = NOW()
            """)
            n = cur.rowcount
    context.log.info(f"Inserted {n} transferts caisse")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})
