"""
Staging asset — PC Paie payroll API (1 endpoint → stg_paie_bulletins).
Sensitive fields (CIN, NSS, RIB) are present in the API response but intentionally excluded.
"""

import uuid

from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.api_clients import PaieAPIClient
from ...resources.database import WarehousePostgresResource


@asset(
    group_name="staging",
    description=(
        "Load /paie/bulletins → stg_paie_bulletins. "
        "CIN, NSS, and RIB fields are in the API response but NOT loaded — privacy constraint."
    ),
)
def stg_paie_bulletins(
    context: AssetExecutionContext,
    paie_api: PaieAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    bulletins = paie_api.get_all_bulletins()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            b.get("bulletin_id", ""),
            int(b.get("period_month", 0)),
            int(b.get("period_year", 0)),
            b.get("period_label", ""),
            b.get("payment_date"),
            b.get("processed_at"),
            # Employee — CIN, NSS excluded here intentionally
            int(b["employee"]["employee_id"]),
            b["employee"].get("employee_code", ""),
            b["employee"].get("full_name", ""),
            # Organization
            int(b["organization"]["company_id"]),
            b["organization"].get("company_name", ""),
            int(b["organization"]["agency_id"]),
            b["organization"].get("agency_name", ""),
            b["organization"].get("agency_hrforce_code", ""),
            b["organization"].get("cost_center"),
            b["organization"].get("occupation", ""),
            b["organization"].get("service"),
            b["organization"].get("department"),
            # Contract
            b["contract"].get("contract_type", ""),
            b["contract"].get("hire_date"),
            int(b["contract"].get("seniority_years", 0)),
            int(b["contract"].get("seniority_months", 0)),
            float(b["contract"].get("work_hours_per_week", 40)),
            b["contract"].get("regime", ""),
            # Gross salary
            b["gross_salary"].get("base_salary"),
            b["gross_salary"].get("anciennete", 0),
            b["gross_salary"].get("prime_rendement"),
            b["gross_salary"].get("prime_panier"),
            b["gross_salary"].get("prime_transport"),
            b["gross_salary"].get("heures_sup_amount"),
            b["gross_salary"].get("heures_sup_hours"),
            b["gross_salary"].get("autres_primes"),
            b["gross_salary"].get("total_brut"),
            # Deductions
            b["deductions"].get("cotisation_securite_sociale"),
            b["deductions"].get("irg"),
            b["deductions"].get("autres_retenues"),
            b["deductions"].get("total_deductions"),
            # Employer charges
            b["employer_charges"].get("cotisation_patronale_cnas"),
            b["employer_charges"].get("cotisation_retraite"),
            b["employer_charges"].get("accident_travail"),
            b["employer_charges"].get("total_charges_patronales"),
            # Net — RIB excluded here intentionally
            b["net_salary"].get("net_a_payer"),
            b["net_salary"].get("mode_paiement", ""),
            # Time
            int(b["time_worked"].get("jours_travailles", 0)),
            int(b["time_worked"].get("jours_absence", 0)),
            int(b["time_worked"].get("jours_conge", 0)),
            int(b["time_worked"].get("jours_maladie", 0)),
            float(b["time_worked"].get("heures_normales", 0)),
            b["time_worked"].get("heures_sup"),
            batch_id,
        )
        for b in bulletins
        if b.get("bulletin_id") and b.get("employee") and b.get("organization")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_paie_bulletins (
                bulletin_id, period_month, period_year, period_label,
                payment_date, processed_at,
                employee_id, employee_code, employee_full_name,
                company_id, company_name,
                agency_id, agency_name, agency_hrforce_code, cost_center,
                occupation, service, department,
                contract_type, hire_date, seniority_years, seniority_months,
                work_hours_per_week, regime,
                base_salary, anciennete, prime_rendement, prime_panier,
                prime_transport, heures_sup_amount, heures_sup_hours, autres_primes,
                total_brut,
                cotisation_securite_sociale, irg, autres_retenues, total_deductions,
                cotisation_patronale_cnas, cotisation_retraite, accident_travail,
                total_charges_patronales,
                net_a_payer, mode_paiement,
                jours_travailles, jours_absence, jours_conge, jours_maladie,
                heures_normales, heures_sup,
                batch_id
            ) VALUES %s
            ON CONFLICT (bulletin_id) DO UPDATE SET
                net_a_payer = EXCLUDED.net_a_payer,
                batch_id    = EXCLUDED.batch_id,
                updated_at  = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} bulletins (CIN/NSS/RIB excluded)")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})
