"""
Staging assets — Yalidine Express API (5 endpoints → 5 staging tables).
"""

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta

import psycopg2.extras
from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.api_clients import YalidineAPIClient
from ...resources.database import WarehousePostgresResource

_HISTORY_WORKERS = 8  # parallel day-loaders for stg_yalidine_parcel_history


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
            int(c["id"]),
            c["nom"],
            int(c["wilaya_id"]),
            c.get("code_postal"),
            int(c.get("has_stop_desk", 0)),
            batch_id,
        )
        for c in communes
        if c.get("id") and c.get("wilaya_id") and c.get("nom")
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
        "~220M rows total; loads day by day to manage memory."
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

    days = []
    current = start_date
    while current <= end_date:
        days.append(current)
        current += timedelta(days=1)

    context.log.info(
        f"Loading {len(days)} day(s) of parcel history "
        f"({days[0]} → {days[-1]}) with {_HISTORY_WORKERS} workers"
    )

    total_loaded = 0
    with ThreadPoolExecutor(max_workers=_HISTORY_WORKERS) as pool:
        futures = {
            pool.submit(_load_history_day, day, yalidine_api, warehouse_db): day
            for day in days
        }
        for future in as_completed(futures):
            day_str, count = future.result()   # re-raises any exception from the thread
            context.log.info(f"  {day_str}: {count} events")
            total_loaded += count

    context.log.info(f"Total parcel history events loaded: {total_loaded}")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(total_loaded)})


def _load_history_day(
    day: date,
    yalidine_api: YalidineAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> tuple[str, int]:
    """Load one day of parcel history (DELETE + paginate API + INSERT). Thread-safe.

    Collects all pages first, then commits DELETE + INSERT atomically in one connection.
    """
    day_str = day.isoformat()

    records = []
    page = 1
    while True:
        resp = yalidine_api.get_histories_page(day_str, day_str, page=page, limit=1000)
        results = resp.get("results", [])
        if not results:
            break
        records.extend(_history_to_row(r) for r in results if r.get("tracking"))
        if resp.get("pagination", {}).get("next_page") is None:
            break
        page += 1

    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM warehouse.stg_yalidine_parcel_history WHERE date_statut::DATE = %s",
                (day,),
            )
        if records:
            warehouse_db.bulk_insert(conn, """
                INSERT INTO warehouse.stg_yalidine_parcel_history (
                    source_id, date_statut, tracking, statut, current_status,
                    hub_id, hub_name, seller_id, seller_company_id, seller_company_name,
                    store_name, depart_wilaya_id, whois, whois_company_id, whois_company_name,
                    forced, forced_by, firstname, familyname,
                    destination_commune_id, destination_wilaya_id, destination_hub_id,
                    delivery_type, zone, delivery_fee, parcel_type,
                    parcel_sub_type, reason, note
                ) VALUES %s
            """, records)

    return day_str, len(records)


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
        r.get("whois_company_name"),
        r.get("forced"),                         # SMALLINT: 0, 1, or null
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
        r.get("parcel_sub_type"),
        r.get("reason"),
        r.get("note"),
    )
