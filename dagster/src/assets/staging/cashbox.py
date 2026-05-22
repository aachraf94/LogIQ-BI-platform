"""
Staging assets — CashBox expense management API (5 endpoints → 6 staging tables).
natures and rubriques come from the same API endpoint but load into separate tables.
"""

import json
import uuid
from datetime import timedelta

from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.api_clients import CashBoxAPIClient
from ...resources.database import WarehousePostgresResource


@asset(group_name="staging", description="Load /cashbox/natures → stg_cashbox_natures")
def stg_cashbox_natures(
    context: AssetExecutionContext,
    cashbox_api: CashBoxAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    natures = cashbox_api.get_natures()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            int(n["nature_id"]),
            n.get("name", ""),
            n.get("arabic_name"),
            n.get("category_group", ""),
            batch_id,
        )
        for n in natures
        if n.get("nature_id")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_cashbox_natures
                (nature_id, name, arabic_name, category_group, batch_id)
            VALUES %s
            ON CONFLICT (nature_id) DO UPDATE SET
                name           = EXCLUDED.name,
                category_group = EXCLUDED.category_group,
                batch_id       = EXCLUDED.batch_id,
                updated_at     = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} natures")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(
    group_name="staging",
    deps=["stg_cashbox_natures"],
    description="Unpack rubriques from /cashbox/natures response → stg_cashbox_rubriques",
)
def stg_cashbox_rubriques(
    context: AssetExecutionContext,
    cashbox_api: CashBoxAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    natures = cashbox_api.get_natures()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            int(r["rubrique_id"]),
            r.get("name", ""),
            int(n["nature_id"]),
            batch_id,
        )
        for n in natures
        for r in n.get("rubriques", [])
        if r.get("rubrique_id")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_cashbox_rubriques
                (rubrique_id, name, nature_id, batch_id)
            VALUES %s
            ON CONFLICT (rubrique_id) DO UPDATE SET
                name       = EXCLUDED.name,
                nature_id  = EXCLUDED.nature_id,
                batch_id   = EXCLUDED.batch_id,
                updated_at = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} rubriques")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(
    group_name="staging",
    description=(
        "Incremental load of /cashbox/depenses → stg_cashbox_depenses. "
        "Resumes from MAX(date_depense) - 30 days to capture late status changes."
    ),
)
def stg_cashbox_depenses(
    context: AssetExecutionContext,
    cashbox_api: CashBoxAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    row = warehouse_db.fetch_one(
        "SELECT MAX(date_depense) FROM warehouse.stg_cashbox_depenses"
    )
    max_date = row[0] if row and row[0] else None

    if max_date:
        # 30-day lookback: expenses can be validated weeks after creation
        date_from = (max_date - timedelta(days=30)).isoformat()
        context.log.info(f"Incremental load from {date_from} (max date_depense={max_date})")
    else:
        date_from = None
        context.log.info("Full load — no existing data in staging")

    depenses = cashbox_api.get_all_depenses(date_from=date_from)
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            d["depense_id"],
            d.get("created_at"),
            d.get("date_depense"),
            d.get("status", ""),
            d.get("validated_at"),
            int(d["entreprise"]["id"]),
            d["entreprise"].get("name", ""),
            int(d["agence"]["id"]),
            d["agence"].get("name", ""),
            d["agence"].get("code", ""),
            int(d["caisse"]["id"]),
            d["caisse"].get("name", ""),
            d["caisse"].get("type", ""),
            int(d["caisse"].get("wilaya_id", 0)),
            d["caisse"].get("commune_id"),
            int(d["nature"]["id"]),
            d["nature"].get("name", ""),
            d["nature"].get("category_group", ""),
            int(d["rubrique"]["id"]) if d.get("rubrique") else None,
            d["rubrique"].get("name") if d.get("rubrique") else None,
            d.get("brq", {}).get("brq_id"),
            d.get("brq", {}).get("requested_by_user_id"),
            d.get("brq", {}).get("requested_by_name"),
            d.get("brq", {}).get("validated_by_user_id"),
            d.get("brq", {}).get("validated_by_name"),
            d.get("montant"),
            d.get("quantite"),
            d.get("unite"),
            d.get("description"),
            d.get("justificatif"),
            d.get("mode_paiement", ""),
            batch_id,
        )
        for d in depenses
        if d.get("depense_id") and d.get("entreprise") and d.get("agence")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_cashbox_depenses (
                depense_id, created_at_src, date_depense, status, validated_at,
                entreprise_id, entreprise_name,
                agence_id, agence_name, agence_code,
                caisse_id, caisse_name, caisse_type, caisse_wilaya_id, caisse_commune_id,
                nature_id, nature_name, category_group,
                rubrique_id, rubrique_name,
                brq_id, requested_by_user_id, requested_by_name,
                validated_by_user_id, validated_by_name,
                montant, quantite, unite, description, justificatif, mode_paiement,
                batch_id
            ) VALUES %s
            ON CONFLICT (depense_id) DO UPDATE SET
                status     = EXCLUDED.status,
                validated_at = EXCLUDED.validated_at,
                montant    = EXCLUDED.montant,
                batch_id   = EXCLUDED.batch_id,
                updated_at = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} depenses")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(
    group_name="staging",
    description="Load /cashbox/paiements-livreurs → stg_cashbox_paiements_livreurs",
)
def stg_cashbox_paiements_livreurs(
    context: AssetExecutionContext,
    cashbox_api: CashBoxAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    paiements = cashbox_api.get_all_paiements_livreurs()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            p["paiement_id"],
            p.get("date_paiement"),
            p.get("period_from"),
            p.get("period_to"),
            p.get("created_at"),
            int(p["agence"]["id"]),
            p["agence"].get("name", ""),
            int(p["agence"].get("wilaya_id", 0)),
            int(p["caisse"]["id"]),
            p["caisse"].get("name", ""),
            p["livreur"]["livreur_id"],
            p["livreur"].get("nom", ""),
            p["livreur"].get("prenom", ""),
            p["livreur"].get("phone"),
            p["livreur"].get("vehicule_type", ""),
            int(p["activite"].get("nbr_colis_livres", 0)),
            int(p["activite"].get("nbr_colis_echoues", 0)),
            int(p["activite"].get("nbr_jours_travailles", 0)),
            int(p["activite"].get("nbr_tournees", 0)),
            json.dumps(p["activite"].get("zones_couvertes") or []),
            p["remuneration"].get("tarif_par_colis"),
            p["remuneration"].get("tarif_par_colis_echoue"),
            p["remuneration"].get("montant_colis_livres"),
            p["remuneration"].get("montant_colis_echoues"),
            p["remuneration"].get("prime_rendement"),
            p["remuneration"].get("deductions", 0),
            p["remuneration"].get("total_brut"),
            p["remuneration"].get("total_net"),
            p.get("brq", {}).get("brq_id"),
            p.get("brq", {}).get("validated_by_user_id"),
            p.get("brq", {}).get("validated_by_name"),
            p.get("mode_paiement", ""),
            batch_id,
        )
        for p in paiements
        if p.get("paiement_id") and p.get("livreur") and p.get("agence")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_cashbox_paiements_livreurs (
                paiement_id, date_paiement, period_from, period_to, created_at_src,
                agence_id, agence_name, agence_wilaya_id,
                caisse_id, caisse_name,
                livreur_id, livreur_nom, livreur_prenom, livreur_phone, livreur_vehicule_type,
                nbr_colis_livres, nbr_colis_echoues, nbr_jours_travailles, nbr_tournees,
                zones_couvertes,
                tarif_par_colis, tarif_par_colis_echoue,
                montant_colis_livres, montant_colis_echoues,
                prime_rendement, deductions, total_brut, total_net,
                brq_id, validated_by_user_id, validated_by_name,
                mode_paiement, batch_id
            ) VALUES %s
            ON CONFLICT (paiement_id) DO UPDATE SET
                total_net  = EXCLUDED.total_net,
                batch_id   = EXCLUDED.batch_id,
                updated_at = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} paiements livreurs")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(
    group_name="staging",
    description="Load /cashbox/remboursements → stg_cashbox_remboursements",
)
def stg_cashbox_remboursements(
    context: AssetExecutionContext,
    cashbox_api: CashBoxAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    remboursements = cashbox_api.get_all_remboursements()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            r["remboursement_id"],
            r.get("date_remboursement"),
            r.get("created_at"),
            int(r["agence_responsable"]["id"]),
            r["agence_responsable"].get("name", ""),
            int(r["agence_responsable"].get("wilaya_id", 0)),
            r["colis"]["tracking"],
            r["colis"].get("current_status", ""),
            r["colis"].get("sinistre_type", ""),
            r["colis"].get("declared_value"),
            r["colis"].get("parcel_type"),
            r.get("client", {}).get("seller_id"),
            r.get("client", {}).get("store_name"),
            r.get("client", {}).get("delivery_type"),
            r.get("montant_rembourse"),
            r.get("motif"),
            r.get("justificatif"),
            r.get("brq", {}).get("brq_id"),
            r.get("brq", {}).get("validated_by_user_id"),
            r.get("brq", {}).get("validated_by_name"),
            int(r["caisse"]["id"]),
            r["caisse"].get("name", ""),
            r.get("mode_paiement", ""),
            batch_id,
        )
        for r in remboursements
        if r.get("remboursement_id") and r.get("colis") and r.get("agence_responsable")
    ]

    # Deduplicate within batch — API sometimes returns the same remboursement_id twice
    seen: dict = {}
    for rec in records:
        seen[rec[0]] = rec
    records = list(seen.values())

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_cashbox_remboursements (
                remboursement_id, date_remboursement, created_at_src,
                agence_responsable_id, agence_responsable_name, agence_wilaya_id,
                colis_tracking, colis_current_status, sinistre_type,
                declared_value, parcel_type,
                seller_id, store_name, delivery_type,
                montant_rembourse, motif, justificatif,
                brq_id, validated_by_user_id, validated_by_name,
                caisse_id, caisse_name, mode_paiement,
                batch_id
            ) VALUES %s
            ON CONFLICT (remboursement_id) DO UPDATE SET
                montant_rembourse = EXCLUDED.montant_rembourse,
                batch_id          = EXCLUDED.batch_id,
                updated_at        = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} remboursements")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(
    group_name="staging",
    description="Load /cashbox/transferts → stg_cashbox_transferts (fund transfers, NOT expenses)",
)
def stg_cashbox_transferts(
    context: AssetExecutionContext,
    cashbox_api: CashBoxAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    transferts = cashbox_api.get_all_transferts()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            t["transfert_id"],
            t.get("date_transfert"),
            t.get("montant"),
            t.get("motif"),
            int(t["caisse_source"]["id"]),
            t["caisse_source"].get("name", ""),
            int(t["caisse_source"].get("agence_id", 0)),
            t["caisse_source"].get("agence_name", ""),
            int(t["caisse_destination"]["id"]),
            t["caisse_destination"].get("name", ""),
            int(t["caisse_destination"].get("agence_id", 0)),
            t["caisse_destination"].get("agence_name", ""),
            int(t["banque"]["id"]) if t.get("banque") else None,
            t["banque"].get("name") if t.get("banque") else None,
            t["banque"].get("reference_virement") if t.get("banque") else None,
            t.get("brq", {}).get("brq_id"),
            t.get("brq", {}).get("validated_by_user_id"),
            batch_id,
        )
        for t in transferts
        if t.get("transfert_id") and t.get("caisse_source") and t.get("caisse_destination")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_cashbox_transferts (
                transfert_id, date_transfert, montant, motif,
                caisse_source_id, caisse_source_name, agence_source_id, agence_source_name,
                caisse_dest_id, caisse_dest_name, agence_dest_id, agence_dest_name,
                banque_id, banque_name, reference_virement,
                brq_id, validated_by_user_id,
                batch_id
            ) VALUES %s
            ON CONFLICT (transfert_id) DO UPDATE SET
                montant    = EXCLUDED.montant,
                batch_id   = EXCLUDED.batch_id,
                updated_at = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} transferts")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})
