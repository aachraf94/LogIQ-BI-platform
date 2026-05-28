"""
Dimension table ETL assets — snowflake schema.

Static seed dimensions are populated by init.sql and have NO ETL assets here:
  dim_region, dim_date, dim_role, dim_employee_status, dim_livreur_vehicule_type,
  dim_delivery_type, dim_parcel_type, dim_zone, dim_client_type, dim_stop_type,
  dim_pricing_service_type, dim_distance_category, dim_complexity_category,
  dim_contract_type, dim_contract_regime, dim_nature_category, dim_parcels_status,
  dim_depense_status, dim_sinistre_type, dim_transport_status,
  dim_transport_service_type, dim_transport_sub_service_type,
  dim_transport_payment_status, dim_location_type, dim_transport_vehicle_type.

Loading order follows §9 of dw-dim-fact-redesign-claude.md.
"""

from datetime import date, timedelta

import psycopg2.extras
from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.database import WarehousePostgresResource

# ── Static lookup maps (avoid repeated DB round-trips for seeded dims) ────────

_WILAYA_REGION: dict[int, int] = {
    **{w: 1 for w in [
        2, 6, 9, 10, 13, 15, 16, 18, 21, 22, 23, 24, 25, 26,
        27, 29, 31, 35, 36, 41, 42, 43, 44, 46, 48,
    ]},
    **{w: 2 for w in [3, 4, 5, 12, 14, 17, 19, 20, 28, 32, 34, 38, 40, 45]},
    **{w: 3 for w in [
        1, 7, 8, 11, 30, 33, 37, 39, 47, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58,
    ]},
}

_ROLE_MAP = {"Employé": 1, "Manager": 2, "Admin": 3}
_STATUS_MAP = {"Actif": 1, "Inactif": 2}
_CONTRACT_TYPE_MAP = {"CDI": 1, "CDD": 2, "Intérimaire": 3}
_REGIME_MAP = {"Temps plein": 1, "Temps partiel": 2}
_LIVREUR_VEHICULE_MAP = {"moto": 1, "voiture": 2, "camionnette": 3}
_DELIVERY_TYPE_MAP = {"HD": 1, "SD": 2}
_PARCEL_TYPE_MAP = {"ecommerce": 1, "internal": 2}
_STOP_TYPE_MAP = {"pickup": 1, "delivery": 2}
_LOCATION_TYPE_MAP = {
    "client_depot": 1, "client_magasin": 2, "yalidine_center": 3, "autre": 4,
}
_PRICING_SERVICE_TYPE_MAP = {
    "livraison": 1, "pickup": 2, "echange": 3, "recouvrement": 4, "retours": 5,
}
_TRANSPORT_STATUS_MAP = {
    "en_attente": 1, "confirmée": 2, "en_cours": 3, "terminée": 4, "annulée": 5,
}
_TRANSPORT_SERVICE_MAP = {"course_dediee": 1, "courrier": 2, "manutention": 3}
_TRANSPORT_SUB_MAP = {"livraison": 1, "pickup": 2, "echange": 3}
_TRANSPORT_PAYMENT_MAP = {"en_attente": 1, "payé": 2, "annulé": 3}
_VEHICLE_TYPE_MAP = {
    "moto": 1, "citadine": 2, "break": 3, "camionnette": 4, "camion": 5,
}
_DEPENSE_STATUS_MAP = {"en_attente": 1, "validée": 2, "rejetée": 3}
_SINISTRE_TYPE_MAP = {"perdu": 1, "endommagé": 2, "vol": 3}

_OPERATIONAL_TYPES = frozenset(["Hub", "Agence", "Centre de tri", "Corner"])


def _distance_category_id(km: float) -> int:
    if km < 50:
        return 1   # local
    if km <= 200:
        return 2   # regional
    return 3       # national


def _parse_gps(gps_str) -> tuple:
    if not gps_str:
        return None, None
    try:
        parts = str(gps_str).split(",")
        if len(parts) != 2:
            return None, None
        return float(parts[0].strip()), float(parts[1].strip())
    except (ValueError, AttributeError):
        return None, None


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1 — Agency type (only non-seeded enum dim)
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="dimensions",
    deps=["stg_hrforce_agencies"],
    description="Load DISTINCT type from stg_hrforce_agencies → dim_agency_type with is_operational flag",
)
def dim_agency_type(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_agency_type (agency_type, is_operational)
                SELECT DISTINCT type, type = ANY(%s)
                FROM warehouse.stg_hrforce_agencies
                ON CONFLICT (agency_type) DO UPDATE SET
                    is_operational = EXCLUDED.is_operational
            """, (list(_OPERATIONAL_TYPES),))
            n = cur.rowcount
    context.log.info(f"Upserted {n} agency types")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2 — Cashbox reference dims
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="dimensions",
    deps=["stg_cashbox_natures"],
    description="Load stg_cashbox_natures → dim_nature (13 expense nature rows)",
)
def dim_nature(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_nature (nature_id, nature_name, category_id)
                SELECT n.nature_id, n.name,
                       nc.category_id
                FROM warehouse.stg_cashbox_natures n
                JOIN warehouse.dim_nature_category nc ON nc.category = n.category_group
                ON CONFLICT (nature_id) DO UPDATE SET
                    nature_name = EXCLUDED.nature_name,
                    category_id = EXCLUDED.category_id
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} natures")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_cashbox_rubriques", "dim_nature"],
    description="Load stg_cashbox_rubriques → dim_rubriques (~35 expense sub-category rows)",
)
def dim_rubriques(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_rubriques (rubrique_id, rubrique_name, nature_id)
                SELECT rubrique_id, name, nature_id
                FROM warehouse.stg_cashbox_rubriques
                ON CONFLICT (rubrique_id) DO UPDATE SET
                    rubrique_name = EXCLUDED.rubrique_name,
                    nature_id     = EXCLUDED.nature_id
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} rubriques")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3 — Organizational dims
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="dimensions",
    deps=["stg_hrforce_companies"],
    description="Load stg_hrforce_companies → dim_company (exclude TEST company id=9)",
)
def dim_company(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_company (company_id, company_name)
                SELECT company_id, company_name
                FROM warehouse.stg_hrforce_companies
                WHERE company_id != 9
                ON CONFLICT (company_id) DO UPDATE SET
                    company_name = EXCLUDED.company_name
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} companies")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_hrforce_occupations", "dim_company"],
    description="Load DISTINCT departments from stg_hrforce_occupations → dim_department",
)
def dim_department(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_department (department_id, department_name, company_id)
                SELECT DISTINCT ON (department_id)
                    department_id, department_name, company_id
                FROM warehouse.stg_hrforce_occupations
                WHERE company_id != 9
                ORDER BY department_id
                ON CONFLICT (department_id) DO UPDATE SET
                    department_name = EXCLUDED.department_name,
                    company_id      = EXCLUDED.company_id
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} departments")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_hrforce_occupations", "dim_department"],
    description="Load DISTINCT services from stg_hrforce_occupations → dim_service",
)
def dim_service(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_service (service_id, service_name, department_id)
                SELECT DISTINCT ON (service_id)
                    service_id, service_name, department_id
                FROM warehouse.stg_hrforce_occupations
                WHERE company_id != 9
                ORDER BY service_id
                ON CONFLICT (service_id) DO UPDATE SET
                    service_name  = EXCLUDED.service_name,
                    department_id = EXCLUDED.department_id
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} services")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_hrforce_occupations", "dim_service"],
    description="Load stg_hrforce_occupations → dim_occupation",
)
def dim_occupation(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_occupation (occupation_id, occupation_name, service_id)
                SELECT DISTINCT ON (occupation_id)
                    occupation_id, name, service_id
                FROM warehouse.stg_hrforce_occupations
                WHERE company_id != 9
                ORDER BY occupation_id
                ON CONFLICT (occupation_id) DO UPDATE SET
                    occupation_name = EXCLUDED.occupation_name,
                    service_id      = EXCLUDED.service_id
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} occupations")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4 — Geographic dims
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="dimensions",
    deps=["stg_yalidine_wilayas"],
    description="Load stg_yalidine_wilayas → dim_wilaya (58 rows, adds region_id)",
)
def dim_wilaya(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    rows = warehouse_db.fetch_all(
        "SELECT wilaya_id, wilaya_name FROM warehouse.stg_yalidine_wilayas"
    )
    records = [
        (int(r[0]), r[1], _WILAYA_REGION.get(int(r[0]), 3))
        for r in rows
    ]
    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.dim_wilaya (wilaya_id, wilaya_name, region_id)
            VALUES %s
            ON CONFLICT (wilaya_id) DO UPDATE SET
                wilaya_name = EXCLUDED.wilaya_name,
                region_id   = EXCLUDED.region_id
        """, records)
    context.log.info(f"Upserted {len(records)} wilayas")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(
    group_name="dimensions",
    deps=["stg_yalidine_communes", "dim_wilaya"],
    description="Load stg_yalidine_communes → dim_commune (~1 500 rows)",
)
def dim_commune(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_commune (commune_id, nom, code_postal, has_stop_desk, wilaya_id)
                SELECT
                    s.commune_id,
                    s.nom,
                    s.code_postal,
                    (s.has_stop_desk != 0),
                    s.wilaya_id
                FROM warehouse.stg_yalidine_communes s
                WHERE s.wilaya_id IN (SELECT wilaya_id FROM warehouse.dim_wilaya)
                ON CONFLICT (commune_id) DO UPDATE SET
                    nom           = EXCLUDED.nom,
                    code_postal   = EXCLUDED.code_postal,
                    has_stop_desk = EXCLUDED.has_stop_desk,
                    wilaya_id     = EXCLUDED.wilaya_id
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} communes")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_hrforce_agencies", "stg_yalidine_centers", "dim_company", "dim_commune", "dim_agency_type"],
    description=(
        "SCD Type 2: stg_hrforce_agencies → dim_agence. "
        "Tracked: name, agency_type_id, address, commune_id."
    ),
)
def dim_agence(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    # Source: join agencies with their matching Yalidine center (for commune_id)
    source_rows = warehouse_db.fetch_all("""
        SELECT
            a.agency_id,
            a.name,
            at.agency_type_id,
            a.code,
            a.address,
            a.company_id,
            CASE WHEN NULLIF(a.code_yal, '') IS NOT NULL THEN c.commune_id ELSE NULL END AS commune_id
        FROM warehouse.stg_hrforce_agencies a
        LEFT JOIN warehouse.dim_agency_type at ON at.agency_type = a.type
        LEFT JOIN warehouse.stg_yalidine_centers c
            ON NULLIF(a.code_yal, '') IS NOT NULL
            AND c.hub_id = NULLIF(a.code_yal, '')::INTEGER
        WHERE a.company_id != 9
    """)

    current_rows = warehouse_db.fetch_all("""
        SELECT agence_key, agency_id, name, agency_type_id, address, commune_id
        FROM warehouse.dim_agence
        WHERE is_current = TRUE
    """)
    current = {
        int(r[1]): {
            "agence_key": r[0], "name": r[2],
            "agency_type_id": r[3], "address": r[4], "commune_id": r[5],
        }
        for r in current_rows
    }

    to_close, to_insert = [], []
    today = date.today()

    for row in source_rows:
        agency_id, name, agency_type_id, code, address, company_id, commune_id = row
        agency_id = int(agency_id)
        if not agency_type_id:
            context.log.warning(f"Skipping agency {agency_id}: unknown type")
            continue
        if company_id not in {r[0] for r in warehouse_db.fetch_all(
            "SELECT company_id FROM warehouse.dim_company"
        )}:
            continue

        ins = (agency_id, name, int(agency_type_id), code, address,
               int(company_id), commune_id, today, None, True)

        if agency_id not in current:
            to_insert.append(ins)
        else:
            old = current[agency_id]
            changed = (
                name != old["name"]
                or int(agency_type_id) != old["agency_type_id"]
                or (address or "") != (old["address"] or "")
                or commune_id != old["commune_id"]
            )
            if changed:
                to_close.append(old["agence_key"])
                to_insert.append(ins)

    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            if to_close:
                cur.execute("""
                    UPDATE warehouse.dim_agence
                    SET valid_to = %s - INTERVAL '1 day', is_current = FALSE
                    WHERE agence_key = ANY(%s)
                """, (today, to_close))
            if to_insert:
                psycopg2.extras.execute_values(cur, """
                    INSERT INTO warehouse.dim_agence (
                        agency_id, name, agency_type_id, code, address,
                        company_id, commune_id, valid_from, valid_to, is_current
                    ) VALUES %s
                """, to_insert)

    context.log.info(f"dim_agence: {len(to_close)} closed, {len(to_insert)} inserted")
    return MaterializeResult(metadata={
        "closed": MetadataValue.int(len(to_close)),
        "inserted": MetadataValue.int(len(to_insert)),
    })


@asset(
    group_name="dimensions",
    deps=["stg_yalidine_centers", "dim_agence"],
    description=(
        "Load stg_yalidine_centers → dim_center (253 rows). "
        "agence_key resolved via code_yal → agency → current SCD2 version."
    ),
)
def dim_center(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    # Build map: hub_id → agence_key (via the HRFORCE agency that links to this center)
    hub_to_agence_key = dict(warehouse_db.fetch_all("""
        SELECT c.hub_id, a.agence_key
        FROM warehouse.stg_yalidine_centers c
        JOIN warehouse.stg_hrforce_agencies ha
            ON NULLIF(ha.code_yal, '') IS NOT NULL
            AND ha.code_yal::INTEGER = c.hub_id
            AND ha.company_id != 9
        JOIN warehouse.dim_agence a
            ON a.agency_id = ha.agency_id AND a.is_current = TRUE
    """))

    source_rows = warehouse_db.fetch_all("""
        SELECT hub_id, code, name, service_stopdesk, service_depot_colis, address, gps
        FROM warehouse.stg_yalidine_centers
    """)

    records = []
    for row in source_rows:
        hub_id, code, name, service_stopdesk, service_depot_colis, address, gps = row
        lat, lng = _parse_gps(gps)
        agence_key = hub_to_agence_key.get(int(hub_id))
        records.append((
            int(hub_id), code, name,
            bool(service_stopdesk), bool(service_depot_colis),
            lat, lng, address, agence_key,
        ))

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.dim_center
            (center_id, code, name, service_stopdesk, service_depot_colis,
             gps_lat, gps_lng, address, agence_key)
            VALUES %s
            ON CONFLICT (center_id) DO UPDATE SET
                code               = EXCLUDED.code,
                name               = EXCLUDED.name,
                service_stopdesk   = EXCLUDED.service_stopdesk,
                service_depot_colis= EXCLUDED.service_depot_colis,
                gps_lat            = EXCLUDED.gps_lat,
                gps_lng            = EXCLUDED.gps_lng,
                address            = EXCLUDED.address,
                agence_key         = EXCLUDED.agence_key
        """, records)

    context.log.info(f"Upserted {len(records)} centers")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5 — HR dims (contract, employee, freelance driver)
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="dimensions",
    deps=["stg_paie_bulletins"],
    description=(
        "Load DISTINCT contract configs from stg_paie_bulletins → dim_contract. "
        "Must be loaded before dim_employee."
    ),
)
def dim_contract(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    rows = warehouse_db.fetch_all("""
        SELECT DISTINCT contract_type, regime, hire_date, work_hours_per_week
        FROM warehouse.stg_paie_bulletins
        WHERE company_id != 9
    """)

    records = []
    for row in rows:
        contract_type, regime, hire_date, work_hours = row
        ct_id = _CONTRACT_TYPE_MAP.get(contract_type)
        regime_id = _REGIME_MAP.get(regime)
        if not ct_id or not regime_id or not hire_date:
            continue
        records.append((ct_id, regime_id, hire_date, float(work_hours)))

    inserted = 0
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            for rec in records:
                cur.execute("""
                    INSERT INTO warehouse.dim_contract
                    (contract_type_id, regime_id, hire_date_id, work_hours_per_week)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, rec)
                inserted += cur.rowcount

    context.log.info(f"Inserted {inserted} contracts ({len(records)} distinct configs)")
    return MaterializeResult(metadata={"inserted": MetadataValue.int(inserted)})


@asset(
    group_name="dimensions",
    deps=["stg_hrforce_users", "stg_paie_bulletins", "dim_agence", "dim_occupation", "dim_company", "dim_contract"],
    description=(
        "SCD Type 2: stg_hrforce_users → dim_employee. "
        "Tracked: employee_status_id, role_id, agence_key, occupation_id, contract_key."
    ),
)
def dim_employee(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    # Lookup maps
    agence_map = dict(warehouse_db.fetch_all(
        "SELECT agency_id, agence_key FROM warehouse.dim_agence WHERE is_current = TRUE"
    ))
    occ_map = dict(warehouse_db.fetch_all(
        "SELECT occupation_name, occupation_id FROM warehouse.dim_occupation"
    ))
    valid_companies = {
        r[0] for r in warehouse_db.fetch_all("SELECT company_id FROM warehouse.dim_company")
    }

    # hire_date per employee (min hire_date from bulletins)
    hire_dates = dict(warehouse_db.fetch_all("""
        SELECT employee_id, MIN(hire_date)
        FROM warehouse.stg_paie_bulletins
        WHERE company_id != 9
        GROUP BY employee_id
    """))

    # Latest contract config per employee → contract_key
    latest_bulletins = warehouse_db.fetch_all("""
        SELECT DISTINCT ON (employee_id)
            employee_id, contract_type, regime, hire_date, work_hours_per_week
        FROM warehouse.stg_paie_bulletins
        WHERE company_id != 9
        ORDER BY employee_id, period_year DESC, period_month DESC
    """)
    contract_lookup = {}
    for emp_id, ct, regime, hd, wh in latest_bulletins:
        contract_lookup[int(emp_id)] = (ct, regime, hd, float(wh))

    contract_rows = warehouse_db.fetch_all("""
        SELECT contract_key, contract_type_id, regime_id, hire_date_id, work_hours_per_week
        FROM warehouse.dim_contract
    """)
    contract_key_map = {
        (_CONTRACT_TYPE_MAP.get(ct_id, ct_id), r_id, hd, float(wh)): ck
        for ck, ct_id, r_id, hd, wh in contract_rows
    }
    # Re-key by (contract_type_id, regime_id, hire_date, work_hours)
    contract_key_map2 = {
        (ct_id, r_id, hd, float(wh)): ck
        for ck, ct_id, r_id, hd, wh in contract_rows
    }

    # Current SCD2 state
    current_rows = warehouse_db.fetch_all("""
        SELECT employee_key, employee_id, employee_status_id, role_id,
               agence_key, occupation_id, contract_key
        FROM warehouse.dim_employee WHERE is_current = TRUE
    """)
    current = {
        int(r[1]): {
            "employee_key": r[0], "status_id": r[2], "role_id": r[3],
            "agence_key": r[4], "occupation_id": r[5], "contract_key": r[6],
        }
        for r in current_rows
    }

    source_rows = warehouse_db.fetch_all("""
        SELECT user_id, family_name || ' ' || first_name AS full_name,
               email, role, status, company_id, agency_id, occupation_name
        FROM warehouse.stg_hrforce_users
        WHERE company_id != 9
    """)

    to_close, to_insert = [], []
    today = date.today()
    skipped = 0

    for row in source_rows:
        uid, full_name, email, role, status, company_id, agency_id, occ_name = row
        uid = int(uid)

        if int(company_id) not in valid_companies:
            skipped += 1
            continue

        hire_date = hire_dates.get(uid)
        if not hire_date:
            skipped += 1
            continue  # no payslip data — cannot populate hire_date_id (NOT NULL)

        role_id = _ROLE_MAP.get(role)
        status_id = _STATUS_MAP.get(status)
        if not role_id or not status_id:
            skipped += 1
            continue

        agence_key = agence_map.get(int(agency_id)) if agency_id else None
        occupation_id = occ_map.get(occ_name) if occ_name else None

        # contract_key: match latest bulletin's contract config
        contract_key = None
        if uid in contract_lookup:
            ct, regime, hd, wh = contract_lookup[uid]
            ct_id = _CONTRACT_TYPE_MAP.get(ct)
            r_id = _REGIME_MAP.get(regime)
            if ct_id and r_id:
                contract_key = contract_key_map2.get((ct_id, r_id, hd, wh))

        ins = (uid, full_name, email, role_id, status_id, agence_key,
               int(company_id), occupation_id, contract_key, hire_date,
               today, None, True)

        if uid not in current:
            to_insert.append(ins)
        else:
            old = current[uid]
            changed = (
                status_id != old["status_id"]
                or role_id != old["role_id"]
                or agence_key != old["agence_key"]
                or occupation_id != old["occupation_id"]
                or contract_key != old["contract_key"]
            )
            if changed:
                to_close.append(old["employee_key"])
                to_insert.append(ins)

    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            if to_close:
                cur.execute("""
                    UPDATE warehouse.dim_employee
                    SET valid_to = %s - INTERVAL '1 day', is_current = FALSE
                    WHERE employee_key = ANY(%s)
                """, (today, to_close))
            if to_insert:
                psycopg2.extras.execute_values(cur, """
                    INSERT INTO warehouse.dim_employee (
                        employee_id, full_name, email,
                        role_id, employee_status_id, agence_key,
                        company_id, occupation_id, contract_key, hire_date_id,
                        valid_from, valid_to, is_current
                    ) VALUES %s
                """, to_insert)

    context.log.info(
        f"dim_employee: {len(to_close)} closed, {len(to_insert)} inserted, {skipped} skipped"
    )
    return MaterializeResult(metadata={
        "closed": MetadataValue.int(len(to_close)),
        "inserted": MetadataValue.int(len(to_insert)),
        "skipped": MetadataValue.int(skipped),
    })


@asset(
    group_name="dimensions",
    deps=["stg_cashbox_paiements_livreurs", "dim_agence"],
    description="Load unique freelance drivers → dim_livreur_freelance. FR-XXXXXX IDs only.",
)
def dim_livreur_freelance(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_livreur_freelance
                (livreur_id, nom, prenom, vehicule_type_id, agence_key)
                SELECT DISTINCT ON (p.livreur_id)
                    p.livreur_id,
                    p.livreur_nom,
                    p.livreur_prenom,
                    CASE p.livreur_vehicule_type
                        WHEN 'moto'        THEN 1
                        WHEN 'voiture'     THEN 2
                        WHEN 'camionnette' THEN 3
                        ELSE NULL
                    END,
                    a.agence_key
                FROM warehouse.stg_cashbox_paiements_livreurs p
                LEFT JOIN warehouse.dim_agence a
                    ON a.agency_id = p.agence_id AND a.is_current = TRUE
                ORDER BY p.livreur_id, p.date_paiement DESC
                ON CONFLICT (livreur_id) DO UPDATE SET
                    vehicule_type_id = EXCLUDED.vehicule_type_id,
                    agence_key       = EXCLUDED.agence_key
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} freelance drivers")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6 — Parcel reference dims
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="dimensions",
    deps=["stg_yalidine_pricing"],
    description="Reload stg_yalidine_pricing → dim_pricing each ETL run (truncate + reload).",
)
def dim_pricing(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE warehouse.dim_pricing RESTART IDENTITY")
            cur.execute("""
                INSERT INTO warehouse.dim_pricing
                (service_type_id, wilaya_id, tarif_hd, tarif_sd, valid_from_id, is_active)
                SELECT
                    pst.pricing_service_type_id,
                    p.wilaya_id,
                    p.tarif::DECIMAL(10,2),
                    p.tarif_stopdesk::DECIMAL(10,2),
                    p.valid_from,
                    p.is_active
                FROM warehouse.stg_yalidine_pricing p
                JOIN warehouse.dim_pricing_service_type pst
                    ON pst.service_type = p.service_type
                WHERE p.wilaya_id IN (SELECT wilaya_id FROM warehouse.dim_wilaya)
            """)
            n = cur.rowcount
    context.log.info(f"Loaded {n} pricing rows")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 7 — Cashbox dims (2-pass for circular FK)
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="dimensions",
    deps=[
        "stg_cashbox_depenses",
        "dim_depense_status",   # seeded — declared as dep for ordering
        "dim_nature",
        "dim_rubriques",
        "dim_agence",
    ],
    description=(
        "Load stg_cashbox_depenses → dim_depense (step 41/43). "
        "paiement_livreur_id and remboursement_id set NULL — filled by dim_depense_backref_update."
    ),
)
def dim_depense(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_depense
                (depense_id, date_depense_id, depense_status_id, rubrique_id, nature_id, agence_key,
                 paiement_livreur_id, remboursement_id)
                SELECT
                    d.depense_id,
                    d.date_depense,
                    ds.depense_status_id,
                    CASE WHEN d.rubrique_id IS NOT NULL THEN d.rubrique_id ELSE NULL END,
                    CASE WHEN d.rubrique_id IS NULL THEN d.nature_id ELSE NULL END,
                    a.agence_key,
                    NULL,
                    NULL
                FROM warehouse.stg_cashbox_depenses d
                LEFT JOIN warehouse.dim_depense_status ds ON ds.status = d.status
                LEFT JOIN warehouse.dim_agence a
                    ON a.agency_id = d.agence_id AND a.is_current = TRUE
                ON CONFLICT (depense_id) DO UPDATE SET
                    depense_status_id = EXCLUDED.depense_status_id,
                    rubrique_id       = EXCLUDED.rubrique_id,
                    nature_id         = EXCLUDED.nature_id,
                    agence_key        = EXCLUDED.agence_key
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} depenses")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_cashbox_paiements_livreurs", "dim_livreur_freelance", "dim_depense"],
    description="Load stg_cashbox_paiements_livreurs → dim_paiement_livreurs (~34K rows).",
)
def dim_paiement_livreurs(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_paiement_livreurs
                (paiement_id, livreur_id, depense_id, period_from_id, period_to_id,
                 date_paiement_id, nbr_colis_livres, nbr_colis_echoues)
                SELECT
                    p.paiement_id,
                    p.livreur_id,
                    -- resolve matching depense via nature_id=5 on same agence/date
                    d.depense_id,
                    p.period_from,
                    p.period_to,
                    p.date_paiement,
                    p.nbr_colis_livres,
                    p.nbr_colis_echoues
                FROM warehouse.stg_cashbox_paiements_livreurs p
                LEFT JOIN warehouse.stg_cashbox_depenses sd
                    ON sd.agence_id = p.agence_id
                    AND sd.nature_id = 5
                    AND DATE(sd.date_depense) = p.date_paiement
                LEFT JOIN warehouse.dim_depense d ON d.depense_id = sd.depense_id
                WHERE p.livreur_id IN (SELECT livreur_id FROM warehouse.dim_livreur_freelance)
                ON CONFLICT (paiement_id) DO UPDATE SET
                    livreur_id       = EXCLUDED.livreur_id,
                    depense_id       = EXCLUDED.depense_id,
                    nbr_colis_livres = EXCLUDED.nbr_colis_livres,
                    nbr_colis_echoues= EXCLUDED.nbr_colis_echoues
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} paiements livreurs")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_cashbox_remboursements", "dim_depense"],
    description="Load stg_cashbox_remboursements → dim_remboursement (~10K rows).",
)
def dim_remboursement(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_remboursement
                (remboursement_id, colis_tracking, depense_id, parcel_declared_value,
                 montant_rembourse, sinistre_type_id, date_remboursement_id)
                SELECT
                    r.remboursement_id,
                    r.colis_tracking,
                    d.depense_id,
                    r.declared_value,
                    r.montant_rembourse,
                    CASE r.sinistre_type
                        WHEN 'perdu'      THEN 1
                        WHEN 'endommagé'  THEN 2
                        WHEN 'vol'        THEN 3
                        ELSE NULL
                    END,
                    r.date_remboursement
                FROM warehouse.stg_cashbox_remboursements r
                -- dual-tracked: find matching depense with nature_id 3 or 4
                LEFT JOIN warehouse.stg_cashbox_depenses sd
                    ON sd.agence_id = r.agence_responsable_id
                    AND sd.nature_id IN (3, 4)
                    AND DATE(sd.date_depense) = r.date_remboursement
                LEFT JOIN warehouse.dim_depense d ON d.depense_id = sd.depense_id
                ON CONFLICT (remboursement_id) DO UPDATE SET
                    depense_id            = EXCLUDED.depense_id,
                    parcel_declared_value = EXCLUDED.parcel_declared_value,
                    montant_rembourse     = EXCLUDED.montant_rembourse,
                    sinistre_type_id      = EXCLUDED.sinistre_type_id
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} remboursements")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["dim_paiement_livreurs", "dim_remboursement"],
    description=(
        "Second-pass UPDATE: fill dim_depense.paiement_livreur_id and remboursement_id "
        "back-references after dim_paiement_livreurs and dim_remboursement are loaded."
    ),
)
def dim_depense_backref_update(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE warehouse.dim_depense d
                SET paiement_livreur_id = pl.paiement_id
                FROM warehouse.dim_paiement_livreurs pl
                WHERE pl.depense_id = d.depense_id
                  AND d.paiement_livreur_id IS DISTINCT FROM pl.paiement_id
            """)
            n_paiement = cur.rowcount

            cur.execute("""
                UPDATE warehouse.dim_depense d
                SET remboursement_id = r.remboursement_id
                FROM warehouse.dim_remboursement r
                WHERE r.depense_id = d.depense_id
                  AND d.remboursement_id IS DISTINCT FROM r.remboursement_id
            """)
            n_remboursement = cur.rowcount

    context.log.info(
        f"dim_depense backref: {n_paiement} paiement_livreur_id, {n_remboursement} remboursement_id updated"
    )
    return MaterializeResult(metadata={
        "paiement_refs_set": MetadataValue.int(n_paiement),
        "remboursement_refs_set": MetadataValue.int(n_remboursement),
    })


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 8 — Salary dim
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="dimensions",
    deps=["stg_paie_bulletins", "dim_employee", "dim_contract"],
    description="Load stg_paie_bulletins → dim_bulletin (~108K rows).",
)
def dim_bulletin(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    # employee_id → employee_key (current SCD2 version)
    emp_key_map = dict(warehouse_db.fetch_all(
        "SELECT employee_id, employee_key FROM warehouse.dim_employee WHERE is_current = TRUE"
    ))

    # Build contract_key lookup: (contract_type_id, regime_id, hire_date, work_hours) → contract_key
    contract_rows = warehouse_db.fetch_all("""
        SELECT contract_key, contract_type_id, regime_id, hire_date_id, work_hours_per_week
        FROM warehouse.dim_contract
    """)
    contract_key_map = {
        (ct_id, r_id, hd, float(wh)): ck
        for ck, ct_id, r_id, hd, wh in contract_rows
    }

    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT bulletin_id, period_month, period_year, payment_date,
                       seniority_months, employee_id,
                       contract_type, regime, hire_date, work_hours_per_week,
                       company_id
                FROM warehouse.stg_paie_bulletins
                WHERE company_id != 9
            """)
            rows = cur.fetchall()

    records, skipped = [], 0
    for row in rows:
        (bulletin_id, period_month, period_year, payment_date, seniority_months,
         employee_id, contract_type, regime, hire_date, work_hours, company_id) = row

        emp_key = emp_key_map.get(int(employee_id))
        if not emp_key:
            skipped += 1
            continue

        ct_id = _CONTRACT_TYPE_MAP.get(contract_type)
        r_id = _REGIME_MAP.get(regime)
        if not ct_id or not r_id:
            skipped += 1
            continue

        contract_key = contract_key_map.get((ct_id, r_id, hire_date, float(work_hours)))
        if not contract_key:
            skipped += 1
            continue

        records.append((
            bulletin_id, int(period_month), int(period_year), payment_date,
            int(seniority_months), emp_key, contract_key,
        ))

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.dim_bulletin
            (bulletin_id, period_month, period_year, payment_date_id,
             seniority_months, employee_key, contract_key)
            VALUES %s
            ON CONFLICT (bulletin_id) DO UPDATE SET
                employee_key     = EXCLUDED.employee_key,
                seniority_months = EXCLUDED.seniority_months,
                contract_key     = EXCLUDED.contract_key
        """, records)

    context.log.info(f"Upserted {len(records)} bulletins, {skipped} skipped")
    return MaterializeResult(metadata={
        "row_count": MetadataValue.int(len(records)),
        "skipped": MetadataValue.int(skipped),
    })


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 9 — Transport dims
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="dimensions",
    deps=["stg_transport_requests"],
    description="Load DISTINCT client companies from stg_transport_requests → dim_transport_client_company",
)
def dim_transport_client_company(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_transport_client_company
                (client_company_id, client_company_name)
                SELECT DISTINCT client_company_id, client_company_name
                FROM warehouse.stg_transport_requests
                WHERE client_company_id IS NOT NULL
                ON CONFLICT (client_company_id) DO UPDATE SET
                    client_company_name = EXCLUDED.client_company_name
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} client companies")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_transport_requests", "dim_transport_client_company"],
    description="Load DISTINCT clients from stg_transport_requests → dim_transport_client",
)
def dim_transport_client(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_transport_client
                (client_id, client_name, client_type_id, contact_phone,
                 contact_email, client_company_id)
                SELECT DISTINCT ON (client_id)
                    client_id,
                    client_name,
                    CASE client_type
                        WHEN 'conventionné' THEN 1
                        WHEN 'divers'       THEN 2
                        ELSE 2
                    END,
                    client_contact_phone,
                    client_contact_email,
                    client_company_id
                FROM warehouse.stg_transport_requests
                ORDER BY client_id
                ON CONFLICT (client_id) DO UPDATE SET
                    client_name       = EXCLUDED.client_name,
                    client_type_id    = EXCLUDED.client_type_id,
                    contact_phone     = EXCLUDED.contact_phone,
                    contact_email     = EXCLUDED.contact_email,
                    client_company_id = EXCLUDED.client_company_id
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} clients")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_transport_requests"],
    description="Load DISTINCT vehicles from stg_transport_requests → dim_transport_vehicle",
)
def dim_transport_vehicle(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_transport_vehicle
                (vehicle_id, vehicle_type_id, vehicle_plate, vehicle_brand,
                 vehicle_model, payload_capacity_kg, volume_capacity_m3)
                SELECT DISTINCT ON (vehicle_id)
                    vehicle_id,
                    CASE vehicle_type
                        WHEN 'moto'        THEN 1
                        WHEN 'citadine'    THEN 2
                        WHEN 'break'       THEN 3
                        WHEN 'camionnette' THEN 4
                        WHEN 'camion'      THEN 5
                        ELSE NULL
                    END,
                    vehicle_plate,
                    vehicle_brand,
                    vehicle_model,
                    payload_capacity_kg,
                    volume_capacity_m3
                FROM warehouse.stg_transport_requests
                ORDER BY vehicle_id
                ON CONFLICT (vehicle_id) DO UPDATE SET
                    vehicle_type_id     = EXCLUDED.vehicle_type_id,
                    vehicle_plate       = EXCLUDED.vehicle_plate,
                    payload_capacity_kg = EXCLUDED.payload_capacity_kg,
                    volume_capacity_m3  = EXCLUDED.volume_capacity_m3
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} vehicles")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_transport_requests"],
    description="Load DISTINCT merchandise types → dim_transport_merchandise_type",
)
def dim_transport_merchandise_type(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_transport_merchandise_type (merchandise_type)
                SELECT DISTINCT merchandise_type
                FROM warehouse.stg_transport_requests
                WHERE merchandise_type IS NOT NULL
                ON CONFLICT (merchandise_type) DO NOTHING
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} merchandise types")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_transport_requests", "dim_transport_merchandise_type"],
    description="Load cargo flag combos from stg_transport_requests → dim_transport_cargo (junk dim)",
)
def dim_transport_cargo(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_transport_cargo
                (merchandise_type_id, fragile, hazardous, requires_clark, requires_packaging)
                SELECT DISTINCT
                    mt.merchandise_type_id,
                    r.fragile,
                    r.hazardous,
                    r.requires_clark,
                    r.requires_packaging
                FROM warehouse.stg_transport_requests r
                LEFT JOIN warehouse.dim_transport_merchandise_type mt
                    ON mt.merchandise_type = r.merchandise_type
                ON CONFLICT (merchandise_type_id, fragile, hazardous, requires_clark, requires_packaging)
                DO NOTHING
            """)
            n = cur.rowcount
    context.log.info(f"Inserted {n} cargo profiles")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_transport_requests"],
    description=(
        "Load routing profile combos from stg_transport_requests → dim_transport_routing (junk dim). "
        "distance_category_id computed from distance_real_km; "
        "complexity_category_id = multi-stop when nbr_stops_total > 1."
    ),
)
def dim_transport_routing(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    rows = warehouse_db.fetch_all("""
        SELECT DISTINCT
            is_night_shift, return_trip,
            distance_real_km, nbr_stops_total
        FROM warehouse.stg_transport_requests
    """)

    seen = set()
    records = []
    for row in rows:
        is_night_shift, return_trip, dist_km, nbr_stops = row
        dist_cat = _distance_category_id(float(dist_km or 0))
        complex_cat = 2 if (nbr_stops or 1) > 1 else 1
        key = (bool(is_night_shift), bool(return_trip), dist_cat, complex_cat)
        if key not in seen:
            seen.add(key)
            records.append(key)

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.dim_transport_routing
            (is_night_shift, return_trip, distance_category_id, complexity_category_id)
            VALUES %s
            ON CONFLICT (is_night_shift, return_trip, distance_category_id, complexity_category_id)
            DO NOTHING
        """, records)

    context.log.info(f"Inserted {len(records)} routing profiles")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(
    group_name="dimensions",
    deps=[
        "stg_transport_requests",
        "stg_transport_stops",
        "dim_transport_client",
        "dim_transport_vehicle",
        "dim_transport_cargo",
        "dim_transport_routing",
        "dim_employee",
        "dim_center",
        "dim_wilaya",
    ],
    description=(
        "Load stg_transport_requests → dim_transport_departure, dim_transport_arrival, "
        "dim_transport (central entity), then stg_transport_stops → dim_transport_stops. "
        "All in one asset — departure/arrival keys resolved via RETURNING."
    ),
)
def dim_transport(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    # ── Build lookup maps ────────────────────────────────────────────────────

    # Existing transport request_ids (to skip re-insertion)
    existing_requests = {
        r[0] for r in warehouse_db.fetch_all(
            "SELECT request_id FROM warehouse.dim_transport"
        )
    }

    employee_key_map = dict(warehouse_db.fetch_all(
        "SELECT employee_id, employee_key FROM warehouse.dim_employee WHERE is_current = TRUE"
    ))

    cargo_key_map = {
        (r[0], bool(r[1]), bool(r[2]), bool(r[3]), bool(r[4])): r[5]
        for r in warehouse_db.fetch_all("""
            SELECT merchandise_type_id, fragile, hazardous, requires_clark, requires_packaging, cargo_key
            FROM warehouse.dim_transport_cargo
        """)
    }

    routing_key_map = {
        (bool(r[0]), bool(r[1]), int(r[2]), int(r[3])): r[4]
        for r in warehouse_db.fetch_all("""
            SELECT is_night_shift, return_trip, distance_category_id, complexity_category_id,
                   routing_profile_key
            FROM warehouse.dim_transport_routing
        """)
    }

    merchandise_type_map = dict(warehouse_db.fetch_all(
        "SELECT merchandise_type, merchandise_type_id FROM warehouse.dim_transport_merchandise_type"
    ))

    valid_centers = {
        r[0] for r in warehouse_db.fetch_all("SELECT center_id FROM warehouse.dim_center")
    }
    valid_wilayas = {
        r[0] for r in warehouse_db.fetch_all("SELECT wilaya_id FROM warehouse.dim_wilaya")
    }

    # Fetch all transport requests
    transport_rows = warehouse_db.fetch_all("""
        SELECT
            request_id,
            DATE(created_at_src) AS created_date,
            client_id,
            dispatched_from_hub_id,
            dispatched_from_wilaya_id,
            service_type,
            sub_service_type,
            status,
            payment_status,
            vehicle_id,
            driver_id,
            second_driver_id,
            depart_location_type, depart_location_name, depart_address,
            depart_wilaya_id, depart_commune_id, depart_gps,
            arrival_location_type, arrival_location_name, arrival_address,
            arrival_wilaya_id, arrival_commune_id, arrival_gps,
            merchandise_type, fragile, hazardous, requires_clark, requires_packaging,
            is_night_shift, return_trip, distance_real_km, nbr_stops_total
        FROM warehouse.stg_transport_requests
    """)

    new_rows = [r for r in transport_rows if r[0] not in existing_requests]
    context.log.info(f"{len(new_rows)} new transport requests to load")

    if not new_rows:
        return MaterializeResult(metadata={
            "transport_inserted": MetadataValue.int(0),
            "stops_inserted": MetadataValue.int(0),
        })

    # ── Insert departures → capture departure_key per request ───────────────

    dep_request_ids = []
    dep_records = []
    for row in new_rows:
        (request_id, created_date, client_id,
         disp_hub, disp_wilaya,
         service_type, sub_service, status, payment_status,
         vehicle_id, driver_id, second_driver_id,
         dep_loc_type, dep_loc_name, dep_addr, dep_wilaya, dep_commune, dep_gps,
         arr_loc_type, arr_loc_name, arr_addr, arr_wilaya, arr_commune, arr_gps,
         merchandise_type, fragile, hazardous, requires_clark, requires_packaging,
         is_night_shift, return_trip, dist_km, nbr_stops) = row

        loc_type_id = _LOCATION_TYPE_MAP.get(dep_loc_type, 4)
        lat, lng = _parse_gps(dep_gps)
        dep_request_ids.append(request_id)
        dep_records.append((
            loc_type_id, dep_loc_name or "", dep_addr,
            int(dep_wilaya) if dep_wilaya else None,
            int(dep_commune) if dep_commune else None,
            lat, lng,
        ))

    arr_request_ids = []
    arr_records = []
    for row in new_rows:
        (request_id, *_, arr_loc_type, arr_loc_name, arr_addr,
         arr_wilaya, arr_commune, arr_gps, *rest) = (
            row[0], *row[1:18], *row[18:25], *row[25:]
        )
        loc_type_id = _LOCATION_TYPE_MAP.get(arr_loc_type, 4)
        lat, lng = _parse_gps(arr_gps)
        arr_request_ids.append(request_id)
        arr_records.append((
            loc_type_id, arr_loc_name or "", arr_addr,
            int(arr_wilaya) if arr_wilaya else None,
            int(arr_commune) if arr_commune else None,
            lat, lng,
        ))

    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            # Insert departures
            psycopg2.extras.execute_values(cur, """
                INSERT INTO warehouse.dim_transport_departure
                (location_type_id, location_name, address, wilaya_id, commune_id, gps_lat, gps_lng)
                VALUES %s
                RETURNING departure_key
            """, dep_records)
            dep_keys = [r[0] for r in cur.fetchall()]
            request_to_dep = dict(zip(dep_request_ids, dep_keys))

            # Insert arrivals
            psycopg2.extras.execute_values(cur, """
                INSERT INTO warehouse.dim_transport_arrival
                (location_type_id, location_name, address, wilaya_id, commune_id, gps_lat, gps_lng)
                VALUES %s
                RETURNING arrival_key
            """, arr_records)
            arr_keys = [r[0] for r in cur.fetchall()]
            request_to_arr = dict(zip(arr_request_ids, arr_keys))

            # Insert dim_transport
            transport_records = []
            for row in new_rows:
                (request_id, created_date, client_id,
                 disp_hub, disp_wilaya,
                 service_type, sub_service, status, payment_status,
                 vehicle_id, driver_id, second_driver_id,
                 dep_loc_type, dep_loc_name, dep_addr, dep_wilaya, dep_commune, dep_gps,
                 arr_loc_type, arr_loc_name, arr_addr, arr_wilaya, arr_commune, arr_gps,
                 merchandise_type, fragile, hazardous, requires_clark, requires_packaging,
                 is_night_shift, return_trip, dist_km, nbr_stops) = row

                dep_key = request_to_dep.get(request_id)
                arr_key = request_to_arr.get(request_id)
                if not dep_key or not arr_key:
                    continue

                driver_key = employee_key_map.get(int(driver_id)) if driver_id else None
                second_driver_key = (
                    employee_key_map.get(int(second_driver_id)) if second_driver_id else None
                )
                service_id = _TRANSPORT_SERVICE_MAP.get(service_type)
                sub_id = _TRANSPORT_SUB_MAP.get(sub_service) if sub_service else None
                status_id = _TRANSPORT_STATUS_MAP.get(status)
                payment_id = _TRANSPORT_PAYMENT_MAP.get(payment_status)

                if not service_id or not status_id or not payment_id or not driver_key:
                    continue
                if not vehicle_id:
                    continue

                mt_id = merchandise_type_map.get(merchandise_type) if merchandise_type else None
                cargo_key = cargo_key_map.get(
                    (mt_id, bool(fragile), bool(hazardous), bool(requires_clark), bool(requires_packaging))
                )
                dist_cat = _distance_category_id(float(dist_km or 0))
                complex_cat = 2 if (nbr_stops or 1) > 1 else 1
                routing_key = routing_key_map.get(
                    (bool(is_night_shift), bool(return_trip), dist_cat, complex_cat)
                )

                hub_id = int(disp_hub) if disp_hub and int(disp_hub) in valid_centers else None
                wilaya_id = int(disp_wilaya) if disp_wilaya and int(disp_wilaya) in valid_wilayas else None

                if not wilaya_id or not cargo_key or not routing_key:
                    continue

                transport_records.append((
                    request_id, created_date, client_id,
                    hub_id, wilaya_id, service_id, sub_id, status_id, payment_id,
                    vehicle_id, driver_key, second_driver_key,
                    dep_key, arr_key, cargo_key, routing_key,
                ))

            if transport_records:
                psycopg2.extras.execute_values(cur, """
                    INSERT INTO warehouse.dim_transport (
                        request_id, created_date_id, client_id,
                        dispatched_from_hub_id, dispatched_from_wilaya_id,
                        service_type_id, sub_service_id, status_id, payment_status_id,
                        vehicle_id, driver_key, second_driver_key,
                        departure_key, arrival_key, cargo_key, routing_profile_key
                    ) VALUES %s
                    ON CONFLICT (request_id) DO UPDATE SET
                        status_id         = EXCLUDED.status_id,
                        payment_status_id = EXCLUDED.payment_status_id
                """, transport_records)
            n_transport = len(transport_records)

        # ── Insert stops ─────────────────────────────────────────────────────

        with conn.cursor() as cur:
            cur.execute("""
                SELECT request_id, transport_key FROM warehouse.dim_transport
                WHERE request_id = ANY(%s)
            """, ([r[0] for r in transport_records],))
            transport_key_map = dict(cur.fetchall())

    # Load stops separately (they reference dim_transport)
    stop_rows = warehouse_db.fetch_all("""
        SELECT stop_id, request_id, stop_order, stop_type, location_type,
               location_name, address, wilaya_id, commune_id, gps
        FROM warehouse.stg_transport_stops
        WHERE request_id = ANY(%s)
    """, ([r[0] for r in transport_records],))

    stop_records = []
    for row in stop_rows:
        stop_id, req_id, stop_order, stop_type, loc_type, loc_name, addr, wilaya_id, commune_id, gps = row
        transport_key = transport_key_map.get(req_id)
        if not transport_key:
            continue
        stop_type_id = _STOP_TYPE_MAP.get(stop_type)
        loc_type_id = _LOCATION_TYPE_MAP.get(loc_type, 4)
        if not stop_type_id:
            continue
        lat, lng = _parse_gps(gps)
        w_id = int(wilaya_id) if wilaya_id and int(wilaya_id) in valid_wilayas else None
        stop_records.append((
            stop_id, transport_key, req_id, int(stop_order),
            stop_type_id, loc_type_id, loc_name or "", addr,
            w_id, int(commune_id) if commune_id else None, lat, lng,
        ))

    if stop_records:
        with warehouse_db.get_connection() as conn:
            warehouse_db.bulk_insert(conn, """
                INSERT INTO warehouse.dim_transport_stops (
                    stop_id, transport_key, request_id, stop_order,
                    stop_type_id, location_type_id, location_name, address,
                    wilaya_id, commune_id, gps_lat, gps_lng
                ) VALUES %s
                ON CONFLICT (stop_id) DO NOTHING
            """, stop_records)

    context.log.info(
        f"dim_transport: {n_transport} inserted, {len(stop_records)} stops inserted"
    )
    return MaterializeResult(metadata={
        "transport_inserted": MetadataValue.int(n_transport),
        "stops_inserted": MetadataValue.int(len(stop_records)),
    })


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 10 — Parcel dim (large: ~27M rows)
# ─────────────────────────────────────────────────────────────────────────────

@asset(
    group_name="dimensions",
    deps=[
        "stg_yalidine_parcel_history",
        "dim_parcels_status",  # seeded — declared for ordering
        "dim_center",
        "dim_zone",            # seeded
        "dim_delivery_type",   # seeded
        "dim_parcel_type",     # seeded
    ],
    description=(
        "Collapse stg_yalidine_parcel_history by tracking → dim_parcel (~27M rows). "
        "current_status_id from latest event; date_creation_id from first; "
        "date_terminal_id when is_terminal status reached."
    ),
)
def dim_parcel(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_parcel (
                    tracking,
                    current_status_id,
                    delivery_type_id,
                    zone_id,
                    parcel_type_id,
                    date_creation_id,
                    date_terminal_id,
                    center_depart_key,
                    center_destination_key
                )
                WITH latest AS (
                    SELECT DISTINCT ON (tracking)
                        tracking, statut, delivery_type, zone, parcel_type,
                        destination_hub_id
                    FROM warehouse.stg_yalidine_parcel_history
                    ORDER BY tracking, date_statut DESC
                ),
                first AS (
                    SELECT DISTINCT ON (tracking)
                        tracking, hub_id, DATE(date_statut) AS date_creation
                    FROM warehouse.stg_yalidine_parcel_history
                    ORDER BY tracking, date_statut ASC
                ),
                terminal AS (
                    SELECT tracking, DATE(MAX(date_statut)) AS date_terminal
                    FROM warehouse.stg_yalidine_parcel_history
                    WHERE statut IN ('Livré', 'Retourné au vendeur')
                    GROUP BY tracking
                )
                SELECT
                    l.tracking,
                    ps.status_id,
                    CASE l.delivery_type WHEN 'HD' THEN 1 WHEN 'SD' THEN 2 ELSE NULL END,
                    CASE
                        WHEN l.zone IS NOT NULL AND l.zone BETWEEN 0 AND 4
                        THEN (l.zone + 1)::SMALLINT
                        ELSE NULL
                    END,
                    CASE l.parcel_type WHEN 'ecommerce' THEN 1 WHEN 'internal' THEN 2 ELSE NULL END,
                    f.date_creation,
                    t.date_terminal,
                    CASE WHEN dc_dep.center_id IS NOT NULL THEN f.hub_id ELSE NULL END,
                    CASE WHEN dc_dst.center_id IS NOT NULL THEN l.destination_hub_id ELSE NULL END
                FROM latest l
                JOIN warehouse.dim_parcels_status ps ON ps.status_name = l.statut
                JOIN first f ON f.tracking = l.tracking
                LEFT JOIN terminal t ON t.tracking = l.tracking
                LEFT JOIN warehouse.dim_center dc_dep ON dc_dep.center_id = f.hub_id
                LEFT JOIN warehouse.dim_center dc_dst ON dc_dst.center_id = l.destination_hub_id
                ON CONFLICT (tracking) DO UPDATE SET
                    current_status_id      = EXCLUDED.current_status_id,
                    date_terminal_id       = EXCLUDED.date_terminal_id,
                    zone_id                = EXCLUDED.zone_id,
                    center_destination_key = EXCLUDED.center_destination_key
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} parcels")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})
