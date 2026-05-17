"""
Staging assets — Yalidine Express API (5 endpoints → 5 staging tables).
"""

import uuid
from datetime import date, timedelta

import psycopg2.extras
from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.api_clients import YalidineAPIClient
from ...resources.database import WarehousePostgresResource


@asset(group_name="staging", description="Load /yalidine/wilayas → stg_yalidine_wilayas")
def stg_yalidine_wilayas(
    context: AssetExecutionContext,
    yalidine_api: YalidineAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    wilayas = yalidine_api.get_wilayas()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (int(w["wilaya_id"]), w["wilaya_name"], batch_id)
        for w in wilayas
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_yalidine_wilayas (wilaya_id, wilaya_name, batch_id)
            VALUES %s
            ON CONFLICT (wilaya_id) DO UPDATE SET
                wilaya_name = EXCLUDED.wilaya_name,
                batch_id    = EXCLUDED.batch_id,
                updated_at  = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} wilayas")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(group_name="staging", description="Load /yalidine/communes → stg_yalidine_communes")
def stg_yalidine_communes(
    context: AssetExecutionContext,
    yalidine_api: YalidineAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    communes = yalidine_api.get_communes()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            int(c["id"]) if "id" in c else hash(f"{c['wilaya_id']}-{c['nom']}") % 1_000_000,
            c["nom"],
            int(c["wilaya_id"]),
            c.get("code_postal"),
            int(c.get("has_stop_desk", 0)),
            batch_id,
        )
        for c in communes
        if c.get("wilaya_id") and c.get("nom")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_yalidine_communes
                (commune_id, nom, wilaya_id, code_postal, has_stop_desk, batch_id)
            VALUES %s
            ON CONFLICT (commune_id) DO UPDATE SET
                nom          = EXCLUDED.nom,
                wilaya_id    = EXCLUDED.wilaya_id,
                has_stop_desk= EXCLUDED.has_stop_desk,
                batch_id     = EXCLUDED.batch_id,
                updated_at   = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} communes")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(group_name="staging", description="Load /yalidine/centers → stg_yalidine_centers")
def stg_yalidine_centers(
    context: AssetExecutionContext,
    yalidine_api: YalidineAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    centers = yalidine_api.get_centers()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            int(c["hub_id"]),
            c.get("code", ""),
            c.get("name", ""),
            int(c.get("company_id", 1)),
            int(c.get("show_for_others", 1)),
            c.get("address"),
            c.get("gps"),
            int(c.get("service_stopdesk", 1)),
            int(c.get("service_depot_colis", 1)),
            int(c["wilaya_id"]),
            int(c["commune_id"]),
            c.get("wilaya_name", ""),
            c.get("commune_name", ""),
            c.get("manager"),
            batch_id,
        )
        for c in centers
        if c.get("hub_id") and c.get("wilaya_id")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_yalidine_centers (
                hub_id, code, name, company_id, show_for_others, address, gps,
                service_stopdesk, service_depot_colis,
                wilaya_id, commune_id, wilaya_name, commune_name, manager, batch_id
            ) VALUES %s
            ON CONFLICT (hub_id) DO UPDATE SET
                name              = EXCLUDED.name,
                address           = EXCLUDED.address,
                wilaya_id         = EXCLUDED.wilaya_id,
                commune_id        = EXCLUDED.commune_id,
                batch_id          = EXCLUDED.batch_id,
                updated_at        = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} centers")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(group_name="staging", description="Full reload of /yalidine/pricing → stg_yalidine_pricing")
def stg_yalidine_pricing(
    context: AssetExecutionContext,
    yalidine_api: YalidineAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    rows = yalidine_api.get_pricing()
    batch_id = uuid.uuid4().hex[:8]
    today = date.today()

    records = [
        (idx + 1, r["service_type"], int(r["wilaya_id"]), r["tarif"], r["tarif_stopdesk"], today, True, batch_id)
        for idx, r in enumerate(rows)
    ]

    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE warehouse.stg_yalidine_pricing RESTART IDENTITY")
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_yalidine_pricing
                (source_id, service_type, wilaya_id, tarif, tarif_stopdesk, valid_from, is_active, batch_id)
            VALUES %s
        """, records)

    context.log.info(f"Loaded {len(records)} pricing rows")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(
    group_name="staging",
    description=(
        "Incremental load of /yalidine/histories → stg_yalidine_parcel_history. "
        "Resumes from max(date_statut) already in staging. "
        "~27M rows total; loads day by day to manage memory."
    ),
)
def stg_yalidine_parcel_history(
    context: AssetExecutionContext,
    yalidine_api: YalidineAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    # Determine start date (resume from last loaded day)
    row = warehouse_db.fetch_one(
        "SELECT MAX(date_statut::DATE) FROM warehouse.stg_yalidine_parcel_history"
    )
    max_date = row[0] if row and row[0] else None
    start_date = max_date if max_date else date(2023, 1, 1)
    end_date = date.today()

    if start_date > end_date:
        context.log.info("Staging parcel_history is already up to date.")
        return MaterializeResult(metadata={"row_count": MetadataValue.int(0)})

    total_loaded = 0
    current = start_date

    while current <= end_date:
        day_str = current.isoformat()
        context.log.info(f"Loading parcel history for {day_str}")

        # Delete existing records for this day to allow safe re-run
        with warehouse_db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM warehouse.stg_yalidine_parcel_history "
                    "WHERE date_statut::DATE = %s",
                    (current,),
                )

        # Paginate through all events for this day
        page = 1
        day_count = 0
        while True:
            resp = yalidine_api.get_histories_page(day_str, day_str, page=page, limit=1000)
            results = resp.get("results", [])
            if not results:
                break

            records = [_history_to_row(r) for r in results if r.get("tracking")]

            if records:
                with warehouse_db.get_connection() as conn:
                    warehouse_db.bulk_insert(conn, """
                        INSERT INTO warehouse.stg_yalidine_parcel_history (
                            source_id, date_statut, tracking, statut, current_status,
                            hub_id, hub_name, seller_id, seller_company_id, seller_company_name,
                            store_name, depart_wilaya_id, whois, whois_company_id,
                            forced, forced_by, firstname, familyname,
                            destination_commune_id, destination_wilaya_id, destination_hub_id,
                            delivery_type, zone, delivery_fee, parcel_type
                        ) VALUES %s
                    """, records)
                day_count += len(records)

            pagination = resp.get("pagination", {})
            if pagination.get("next_page") is None:
                break
            page += 1

        total_loaded += day_count
        context.log.info(f"  {day_str}: {day_count} events")
        current += timedelta(days=1)

    context.log.info(f"Total parcel history events loaded: {total_loaded}")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(total_loaded)})


def _history_to_row(r: dict) -> tuple:
    """Map one API history event dict to the stg_yalidine_parcel_history insert tuple."""
    return (
        r.get("id"),
        r.get("dateStatut"),                     # "YYYY-MM-DD HH:MM:SS" format
        r.get("tracking"),
        r.get("statut"),
        r.get("current_status"),
        r.get("hub_id"),
        r.get("hub_name"),
        r.get("seller_id"),
        r.get("seller_company_id"),
        r.get("seller_company_name"),
        r.get("store_name"),
        r.get("depart_wilaya_id"),
        r.get("whois"),
        r.get("whois_company_id"),
        bool(r.get("forced", False)),
        r.get("forcedBy"),
        r.get("firstname"),
        r.get("familyname"),
        r.get("destination_commune_id"),
        r.get("destination_wilaya_id"),
        r.get("destination_hub_id"),
        r.get("delivery_type"),
        r.get("zone"),
        r.get("delivery_fee"),
        r.get("parcel_type"),
    )
