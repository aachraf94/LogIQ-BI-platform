"""
Dimension table loader assets.
Execution order mirrors init.sql dependency chain:
  company → wilaya → commune → occupation → agence (SCD2) → employee (SCD2) → freelance_driver
Seeded dimensions (dim_date, dim_statut_colis, dim_nature_depense, dim_vehicle_type)
are populated by init.sql and do not need ETL assets.
"""

from datetime import date

import psycopg2.extras
from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.database import WarehousePostgresResource

# Wilaya → administrative region mapping (58 Algerian wilayas)
_WILAYA_REGIONS: dict = {
    **{w: "Nord" for w in [
        2, 4, 5, 6, 8, 9, 11, 12, 13, 14, 15, 17, 18,
        21, 22, 23, 24, 25, 26, 27, 29, 31, 34, 35, 36,
        38, 40, 41, 42, 43, 44, 46, 48,
    ]},
    **{w: "Hauts Plateaux" for w in [3, 16, 19, 28, 32, 33, 39, 45, 47]},
    **{w: "Sud" for w in [1, 7, 10, 20, 30, 37, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58]},
}


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
                INSERT INTO warehouse.dim_company (company_id, license_name, company_name)
                SELECT company_id, license_number, company_name
                FROM warehouse.stg_hrforce_companies
                WHERE company_id != 9
                ON CONFLICT (company_id) DO UPDATE SET
                    license_name = EXCLUDED.license_name,
                    company_name = EXCLUDED.company_name,
                    updated_at   = NOW()
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} companies")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_yalidine_wilayas"],
    description="Load stg_yalidine_wilayas → dim_wilaya (adds region classification)",
)
def dim_wilaya(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    rows = warehouse_db.fetch_all(
        "SELECT wilaya_id, wilaya_name FROM warehouse.stg_yalidine_wilayas"
    )
    records = [
        (int(r[0]), r[1], _WILAYA_REGIONS.get(int(r[0]), "Sud"))
        for r in rows
    ]
    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.dim_wilaya (wilaya_id, wilaya_name, region)
            VALUES %s
            ON CONFLICT (wilaya_id) DO UPDATE SET
                wilaya_name = EXCLUDED.wilaya_name,
                region      = EXCLUDED.region,
                updated_at  = NOW()
        """, records)
    context.log.info(f"Upserted {len(records)} wilayas")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(
    group_name="dimensions",
    deps=["stg_yalidine_communes", "dim_wilaya"],
    description="Load stg_yalidine_communes → dim_commune",
)
def dim_commune(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_commune (commune_id, nom, wilaya_key)
                SELECT s.commune_id, s.nom, d.wilaya_key
                FROM warehouse.stg_yalidine_communes s
                JOIN warehouse.dim_wilaya d ON s.wilaya_id = d.wilaya_id
                ON CONFLICT (commune_id) DO UPDATE SET
                    nom        = EXCLUDED.nom,
                    wilaya_key = EXCLUDED.wilaya_key,
                    updated_at = NOW()
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} communes")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_hrforce_occupations"],
    description="Load stg_hrforce_occupations → dim_occupation",
)
def dim_occupation(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_occupation (occupation_name, service_name)
                SELECT DISTINCT name, service_name
                FROM warehouse.stg_hrforce_occupations
                ON CONFLICT (occupation_name) DO UPDATE SET
                    service_name = EXCLUDED.service_name,
                    updated_at   = NOW()
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} occupations")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})


@asset(
    group_name="dimensions",
    deps=["stg_hrforce_agencies", "stg_yalidine_centers", "dim_company", "dim_wilaya"],
    description=(
        "SCD Type 2: merge stg_hrforce_agencies + stg_yalidine_centers → dim_agence. "
        "Tracked attributes: name, type, address."
    ),
)
def dim_agence(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    source_rows = warehouse_db.fetch_all("""
        SELECT
            a.agency_id,
            CASE WHEN NULLIF(a.code_yal, '') IS NOT NULL THEN c.hub_id END AS hub_id,
            a.name, a.type, a.code,
            NULLIF(a.code_yal, '')     AS code_yal,
            NULLIF(a.code_yal_two, '') AS code_yal_two,
            COALESCE(c.address, a.address) AS address,
            a.company_id,
            COALESCE(c.wilaya_id, NULLIF(a.state_code, '')::INTEGER) AS wilaya_id
        FROM warehouse.stg_hrforce_agencies a
        LEFT JOIN warehouse.stg_yalidine_centers c
            ON NULLIF(a.code_yal, '') IS NOT NULL
            AND c.hub_id = NULLIF(a.code_yal, '')::INTEGER
        WHERE a.company_id != 9
    """)

    current_rows = warehouse_db.fetch_all(
        "SELECT agence_key, agency_id, name, type, address FROM warehouse.dim_agence WHERE is_current = TRUE"
    )
    current = {
        int(r[1]): {"agence_key": r[0], "name": r[2], "type": r[3], "address": r[4]}
        for r in current_rows
    }

    company_map = dict(warehouse_db.fetch_all(
        "SELECT company_id, company_key FROM warehouse.dim_company"
    ))
    wilaya_map = dict(warehouse_db.fetch_all(
        "SELECT wilaya_id, wilaya_key FROM warehouse.dim_wilaya"
    ))

    to_close, to_insert = [], []
    today = date.today()

    for row in source_rows:
        agence_id, hub_id, name, type_, code, code_yal, code_yal_two, address, company_id, wilaya_id = row
        agence_id = int(agence_id)
        company_key = company_map.get(int(company_id)) if company_id else None
        wilaya_key = wilaya_map.get(int(wilaya_id)) if wilaya_id else None
        if not company_key or not wilaya_key:
            continue

        ins = (agence_id, hub_id, name, type_, code, code_yal, code_yal_two,
               address, company_key, wilaya_key, today, None, True)

        if agence_id not in current:
            to_insert.append(ins)
        else:
            old = current[agence_id]
            if name != old["name"] or type_ != old["type"] or (address or "") != (old["address"] or ""):
                to_close.append(old["agence_key"])
                to_insert.append(ins)

    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            if to_close:
                cur.execute("""
                    UPDATE warehouse.dim_agence
                    SET valid_to = %s - INTERVAL '1 day', is_current = FALSE, updated_at = NOW()
                    WHERE agence_key = ANY(%s)
                """, (today, to_close))
            if to_insert:
                psycopg2.extras.execute_values(cur, """
                    INSERT INTO warehouse.dim_agence (
                        agence_id, hub_id, name, type, code, code_yal, code_yal_two,
                        address, company_key, wilaya_key, valid_from, valid_to, is_current
                    ) VALUES %s
                """, to_insert)

    context.log.info(f"dim_agence: {len(to_close)} closed, {len(to_insert)} inserted")
    return MaterializeResult(metadata={
        "closed": MetadataValue.int(len(to_close)),
        "inserted": MetadataValue.int(len(to_insert)),
    })


@asset(
    group_name="dimensions",
    deps=["stg_hrforce_users", "dim_agence", "dim_occupation", "dim_company"],
    description=(
        "SCD Type 2: stg_hrforce_users → dim_employee. "
        "Tracked: status, role, is_supervisor, agence_key, occupation_key."
    ),
)
def dim_employee(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    source_rows = warehouse_db.fetch_all("""
        SELECT u.user_id, u.family_name, u.first_name,
               u.family_name || ' ' || u.first_name AS full_name,
               u.email, u.status, u.role, u.is_supervisor,
               u.company_id, u.agency_id, u.occupation_name
        FROM warehouse.stg_hrforce_users u
        WHERE u.company_id != 9
    """)

    current_rows = warehouse_db.fetch_all("""
        SELECT employee_key, employee_id, status, role, is_supervisor, agence_key, occupation_key
        FROM warehouse.dim_employee WHERE is_current = TRUE
    """)
    current = {
        int(r[1]): {"employee_key": r[0], "status": r[2], "role": r[3],
                    "is_supervisor": r[4], "agence_key": r[5], "occupation_key": r[6]}
        for r in current_rows
    }

    agence_map = dict(warehouse_db.fetch_all(
        "SELECT agency_id, agence_key FROM warehouse.dim_agence WHERE is_current = TRUE"
    ))
    occ_map = dict(warehouse_db.fetch_all(
        "SELECT occupation_name, occupation_key FROM warehouse.dim_occupation"
    ))
    company_map = dict(warehouse_db.fetch_all(
        "SELECT company_id, company_key FROM warehouse.dim_company"
    ))

    to_close, to_insert = [], []
    today = date.today()

    for row in source_rows:
        uid, family, first, full, email, status, role, is_sup, company_id, agency_id, occ_name = row
        uid = int(uid)
        company_key = company_map.get(int(company_id)) if company_id else None
        agence_key = agence_map.get(int(agency_id)) if agency_id else None
        occ_key = occ_map.get(occ_name) if occ_name else None
        if not company_key:
            continue

        ins = (uid, family, first, full, email, status, role, bool(is_sup),
               agence_key, occ_key, company_key, today, None, True)

        if uid not in current:
            to_insert.append(ins)
        else:
            old = current[uid]
            if (status != old["status"] or role != old["role"]
                    or bool(is_sup) != bool(old["is_supervisor"])
                    or agence_key != old["agence_key"]
                    or occ_key != old["occupation_key"]):
                to_close.append(old["employee_key"])
                to_insert.append(ins)

    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            if to_close:
                cur.execute("""
                    UPDATE warehouse.dim_employee
                    SET valid_to = %s - INTERVAL '1 day', is_current = FALSE, updated_at = NOW()
                    WHERE employee_key = ANY(%s)
                """, (today, to_close))
            if to_insert:
                psycopg2.extras.execute_values(cur, """
                    INSERT INTO warehouse.dim_employee (
                        employee_id, family_name, first_name, full_name, email,
                        status, role, is_supervisor,
                        agence_key, occupation_key, company_key,
                        valid_from, valid_to, is_current
                    ) VALUES %s
                """, to_insert)

    context.log.info(f"dim_employee: {len(to_close)} closed, {len(to_insert)} inserted")
    return MaterializeResult(metadata={
        "closed": MetadataValue.int(len(to_close)),
        "inserted": MetadataValue.int(len(to_insert)),
    })


@asset(
    group_name="dimensions",
    deps=["stg_cashbox_paiements_livreurs", "dim_agence"],
    description=(
        "Load unique freelance drivers → dim_freelance_driver. "
        "NEVER joined to dim_employee — FR-XXXXXX IDs vs integer HRFORCE IDs."
    ),
)
def dim_freelance_driver(
    context: AssetExecutionContext,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    with warehouse_db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse.dim_freelance_driver (livreur_id, vehicule_type, agence_key)
                SELECT DISTINCT ON (p.livreur_id)
                    p.livreur_id,
                    p.livreur_vehicule_type,
                    a.agence_key
                FROM warehouse.stg_cashbox_paiements_livreurs p
                LEFT JOIN warehouse.dim_agence a
                    ON a.agency_id = p.agence_id AND a.is_current = TRUE
                ORDER BY p.livreur_id, p.date_paiement DESC
                ON CONFLICT (livreur_id) DO UPDATE SET
                    vehicule_type = EXCLUDED.vehicule_type,
                    agence_key    = EXCLUDED.agence_key,
                    updated_at    = NOW()
            """)
            n = cur.rowcount
    context.log.info(f"Upserted {n} freelance drivers")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(n)})
