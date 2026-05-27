"""
Staging assets — HRFORCE HR platform API (4 endpoints → 4 staging tables).
Password is extracted from the API response but intentionally NOT loaded to staging.
"""

import json
import uuid

from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.api_clients import HRForceAPIClient
from ...resources.database import WarehousePostgresResource


@asset(group_name="staging", description="Load /hrforce/companies → stg_hrforce_companies")
def stg_hrforce_companies(
    context: AssetExecutionContext,
    hrforce_api: HRForceAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    companies = hrforce_api.get_companies()
    batch_id = uuid.uuid4().hex[:8]

    # API already filters out company id=9 (TEST), but guard anyway
    records = [
        (
            int(c["id"]),
            c.get("licenseNumber", ""),
            c.get("companyName", ""),
            c.get("tradeName"),
            c.get("legalType"),
            c.get("registerNumber"),
            c.get("NIF"),
            c.get("NIS"),
            c.get("AI"),
            c.get("manager"),
            c.get("email"),
            c.get("contactNumber"),
            c.get("adress"),          # note: field is misspelled in source
            batch_id,
        )
        for c in companies
        if int(c.get("id", 0)) != 9      # exclude TEST company at ETL level too
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_hrforce_companies (
                company_id, license_number, company_name,
                trade_name, legal_type, register_number,
                nif, nis, ai,
                manager, email, contact_number, adress,
                batch_id
            ) VALUES %s
            ON CONFLICT (company_id) DO UPDATE SET
                company_name = EXCLUDED.company_name,
                manager      = EXCLUDED.manager,
                batch_id     = EXCLUDED.batch_id,
                updated_at   = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} companies")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(group_name="staging", description="Load /hrforce/agencies → stg_hrforce_agencies")
def stg_hrforce_agencies(
    context: AssetExecutionContext,
    hrforce_api: HRForceAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    agencies = hrforce_api.get_all_agencies()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            int(a["id"]),
            a.get("name", ""),
            a.get("type", ""),
            a.get("code", ""),
            a.get("codeYal", ""),
            a.get("codeYalTwo", ""),
            a.get("address"),
            a.get("createdAt"),
            a.get("updateAt"),
            int(a["company"]["id"]),
            a["company"].get("companyName", ""),
            int(a["city"]["id"]),
            int(a["city"].get("zipCode", 0)),
            a["city"].get("latinName", ""),
            a["city"].get("arabicName"),
            a["city"].get("codeYal"),
            int(a["city"]["state"]["id"]),
            a["city"]["state"].get("stateCode", ""),
            a["city"]["state"].get("latinName", ""),
            a["city"]["state"].get("arabicName"),
            batch_id,
        )
        for a in agencies
        if a.get("id") and a.get("company") and a.get("city") and a["city"].get("state")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_hrforce_agencies (
                agency_id, name, type, code, code_yal, code_yal_two, address,
                created_at_src, updated_at_src,
                company_id, company_name,
                city_id, city_zip, city_latin, city_arabic, city_code_yal,
                state_id, state_code, state_latin, state_arabic,
                batch_id
            ) VALUES %s
            ON CONFLICT (agency_id) DO UPDATE SET
                name       = EXCLUDED.name,
                type       = EXCLUDED.type,
                address    = EXCLUDED.address,
                code_yal   = EXCLUDED.code_yal,
                batch_id   = EXCLUDED.batch_id,
                updated_at = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} agencies")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(group_name="staging", description="Load /hrforce/occupations → stg_hrforce_occupations")
def stg_hrforce_occupations(
    context: AssetExecutionContext,
    hrforce_api: HRForceAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    occupations = hrforce_api.get_occupations()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            int(o["id"]),
            o.get("name", ""),
            o.get("arabicName"),
            o.get("trialPeriod"),
            int(o["service"]["id"]),
            o["service"].get("name", ""),
            int(o["service"]["department"]["id"]),
            o["service"]["department"].get("name", ""),
            int(o["service"]["department"]["company"]["id"]),
            batch_id,
        )
        for o in occupations
        if o.get("id") and o.get("service") and o["service"].get("department")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_hrforce_occupations (
                occupation_id, name, arabic_name, trial_period,
                service_id, service_name,
                department_id, department_name,
                company_id, batch_id
            ) VALUES %s
            ON CONFLICT (occupation_id) DO UPDATE SET
                name         = EXCLUDED.name,
                service_name = EXCLUDED.service_name,
                batch_id     = EXCLUDED.batch_id,
                updated_at   = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} occupations")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(
    group_name="staging",
    description=(
        "Load /hrforce/users → stg_hrforce_users. "
        "password field is present in API response but intentionally excluded from staging."
    ),
)
def stg_hrforce_users(
    context: AssetExecutionContext,
    hrforce_api: HRForceAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    users = hrforce_api.get_all_users()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            int(u["id"]),
            u.get("email", ""),
            u.get("code", ""),
            u.get("role", ""),
            u.get("status", ""),
            u.get("familyName", ""),
            u.get("firstName", ""),
            int(u["company"]["id"]) if u.get("company") else None,
            u["company"].get("companyName") if u.get("company") else None,
            u.get("occupation", {}).get("name") if u.get("occupation") else None,
            int(u["agency"]["id"]) if u.get("agency") else None,
            u["agency"].get("name") if u.get("agency") else None,
            u["agency"].get("code") if u.get("agency") else None,
            # is_supervisor = True when supervision.agencies is non-empty
            bool(u.get("supervision", {}).get("agencies")),
            json.dumps(u.get("supervision", {}).get("agencies", [])),
            batch_id,
        )
        for u in users
        if u.get("id")
        # password is deliberately NOT extracted — never load to DW
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_hrforce_users (
                user_id, email, code, role, status,
                family_name, first_name,
                company_id, company_name,
                occupation_name,
                agency_id, agency_name, agency_code,
                is_supervisor, supervision_agencies,
                batch_id
            ) VALUES %s
            ON CONFLICT (user_id) DO UPDATE SET
                status              = EXCLUDED.status,
                role                = EXCLUDED.role,
                agency_id           = EXCLUDED.agency_id,
                agency_name         = EXCLUDED.agency_name,
                occupation_name     = EXCLUDED.occupation_name,
                is_supervisor       = EXCLUDED.is_supervisor,
                supervision_agencies= EXCLUDED.supervision_agencies,
                batch_id            = EXCLUDED.batch_id,
                updated_at          = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} users (password excluded)")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})
