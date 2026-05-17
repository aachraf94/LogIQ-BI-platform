# LOGIQ Dagster ETL Pipeline

Dagster-based ETL pipeline for the LOGIQ BI platform. Extracts data from 5 internal source systems, transforms it into a constellation-schema warehouse, and refreshes 8 materialized view aggregates.

---

## Directory Structure

```
dagster/
├── .env.example              # Environment variable template
├── requirements.txt          # Python dependencies
└── src/
    ├── definitions.py        # Dagster entry point (Definitions object)
    ├── resources/
    │   ├── __init__.py       # all_resources dict (6 resources with EnvVar bindings)
    │   ├── api_clients.py    # 5 ConfigurableResource API clients (with tenacity retry)
    │   └── database.py       # WarehousePostgresResource (psycopg2, bulk_insert)
    ├── assets/
    │   ├── __init__.py       # all_assets = staging_assets + warehouse_assets (40 total)
    │   ├── staging/          # 18 staging assets — extract from APIs into staging tables
    │   └── warehouse/        # 22 warehouse assets — dim/fact loads + aggregate refreshes
    └── schedules/
        └── __init__.py       # 4 jobs + 2 schedules
```

---

## Quick Start

```powershell
cd logiq\dagster

# 1. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with real API tokens and DB credentials

# 4. Start the Dagster UI
dagster dev -f src/definitions.py
# Open http://localhost:3000
```

> **Prerequisites**: warehouse-db (PostgreSQL on port 5433) must be initialized via `warehouse/init.sql`, and mock-datasources must be running on port 8000.

---

## Environment Variables

All variables are defined in `.env.example`. Copy to `.env` before running.

| Variable | Description |
|---|---|
| `API_BASE_URL` | Base URL for all source APIs (default: `http://localhost:8000`) |
| `YALIDINE_API_ID` | Yalidine API identifier |
| `YALIDINE_API_TOKEN` | Yalidine API bearer token |
| `HRFORCE_API_TOKEN` | HRForce HR system token |
| `CASHBOX_API_TOKEN` | CashBox financial system token |
| `PAIE_API_TOKEN` | Paie (payroll) system token |
| `TRANSPORT_API_TOKEN` | Transport management system token |
| `WAREHOUSE_DB_HOST` | Warehouse PostgreSQL host |
| `WAREHOUSE_DB_PORT` | Warehouse PostgreSQL port (default: `5433`) |
| `WAREHOUSE_DB_NAME` | Warehouse database name |
| `WAREHOUSE_DB_USER` | Warehouse database user |
| `WAREHOUSE_DB_PASSWORD` | Warehouse database password |

---

## Resources

### API Clients (`src/resources/api_clients.py`)

Five `ConfigurableResource` classes, each with **tenacity retry** (exponential backoff, 3 attempts, retries on `ConnectionError` and `Timeout`):

| Resource key | Class | Source system |
|---|---|---|
| `yalidine_api` | `YalidineAPIClient` | Yalidine parcel tracking |
| `hrforce_api` | `HRForceAPIClient` | HRForce HR management |
| `cashbox_api` | `CashBoxAPIClient` | CashBox financial operations |
| `paie_api` | `PaieAPIClient` | Paie payroll system |
| `transport_api` | `TransportAPIClient` | Transport request management |

Notable behaviors:
- Yalidine centers/communes: API returns dicts keyed by ID — iterated via `.values()`
- Yalidine pricing: nested dict flattened per zone; `service_type` injected; `'poids'` key skipped
- HRForce agencies: paginated via `meta.totalPages`
- HRForce users: stops when `len(items) < page_size`
- CashBox: `_paginate()` helper checks `pagination.next_page is None`

### Database (`src/resources/database.py`)

`WarehousePostgresResource` — psycopg2 wrapper with:
- `get_connection()` — context manager; auto-commits on exit, rolls back on exception
- `fetch_all(sql)` / `fetch_one(sql)` — read helpers
- `bulk_insert(conn, sql, records, page_size=1000)` — batched `execute_values` insert

Connection uses `search_path=warehouse,public` so all SQL can omit the `warehouse.` prefix when desired.

---

## Asset Layers

### Layer 1 — Staging (18 assets, group: `staging`)

Extracts from all 5 source APIs into `warehouse.stg_*` tables. All inserts use `ON CONFLICT DO UPDATE` for idempotency.

#### Yalidine (`staging/yalidine.py`)

| Asset | Table | Notes |
|---|---|---|
| `stg_yalidine_wilayas` | `stg_yalidine_wilayas` | 58 Algerian wilayas |
| `stg_yalidine_communes` | `stg_yalidine_communes` | All communes |
| `stg_yalidine_centers` | `stg_yalidine_centers` | Yalidine hub centers |
| `stg_yalidine_pricing` | `stg_yalidine_pricing` | Tariff grid by wilaya/zone |
| `stg_yalidine_parcel_history` | `stg_yalidine_parcel_history` | **Incremental**: loads from `MAX(date_statut::DATE)`, DELETE+reload per day (~27M rows total) |

#### HRForce (`staging/hrforce.py`)

| Asset | Table | Notes |
|---|---|---|
| `stg_hrforce_companies` | `stg_hrforce_companies` | Company list (id=9 excluded) |
| `stg_hrforce_agencies` | `stg_hrforce_agencies` | All agencies (paginated) |
| `stg_hrforce_occupations` | `stg_hrforce_occupations` | Job titles/services |
| `stg_hrforce_users` | `stg_hrforce_users` | Employees — **password field never extracted** |

#### CashBox (`staging/cashbox.py`)

| Asset | Table | Notes |
|---|---|---|
| `stg_cashbox_natures` | `stg_cashbox_natures` | Expense categories |
| `stg_cashbox_rubriques` | `stg_cashbox_rubriques` | Expense sub-categories (unpacked from natures) |
| `stg_cashbox_depenses` | `stg_cashbox_depenses` | Expense records (paginated) |
| `stg_cashbox_paiements_livreurs` | `stg_cashbox_paiements_livreurs` | Freelance driver payments |
| `stg_cashbox_remboursements` | `stg_cashbox_remboursements` | Reimbursements |
| `stg_cashbox_transferts` | `stg_cashbox_transferts` | Cash box transfers |

#### Paie (`staging/paie.py`)

| Asset | Table | Notes |
|---|---|---|
| `stg_paie_bulletins` | `stg_paie_bulletins` | Payroll bulletins — **CIN/NSS/RIB never extracted** |

#### Transport (`staging/transport.py`)

| Asset | Table | Notes |
|---|---|---|
| `stg_transport_requests` | `stg_transport_requests` | Transport requests (~13K, 90+ fields from nested JSON) |
| `stg_transport_stops` | `stg_transport_stops` | Stops embedded in request responses (unpacked per request) |

---

### Layer 2 — Warehouse Dimensions (7 assets, group: `dimensions`)

All defined in `warehouse/dim_tables.py`. Execution order mirrors foreign key dependencies.

| Asset | SCD | Tracked attributes | Notes |
|---|---|---|---|
| `dim_company` | Upsert | — | Excludes TEST company id=9 |
| `dim_wilaya` | Upsert | — | Adds `region` (Nord/Hauts Plateaux/Sud) from `_WILAYA_REGIONS` dict |
| `dim_commune` | Upsert | — | Joins `dim_wilaya` for `wilaya_key` |
| `dim_occupation` | Upsert | — | DISTINCT on `(name, service_name)` |
| `dim_agence` | **SCD Type 2** | `name`, `type`, `address` | Merges hrforce agencies + yalidine centers via `code_yal = hub_id` |
| `dim_employee` | **SCD Type 2** | `status`, `role`, `is_supervisor`, `agence_key`, `occupation_key` | Excludes company id=9 |
| `dim_freelance_driver` | Upsert | — | FR-XXXXXX IDs, never joined to `dim_employee` |

**SCD Type 2 pattern**: fetch current rows → compare tracked attrs → `UPDATE ... SET is_current=FALSE, valid_to=today-1` for changed rows → INSERT new versions with `valid_from=today`.

---

### Layer 3 — Warehouse Facts (7 assets, group: `facts`)

All defined in `warehouse/fact_tables.py`. All use `ON CONFLICT DO UPDATE`.

| Asset | Grain | Key joins | Notes |
|---|---|---|---|
| `fact_livraisons` | 1 row per parcel (tracking) | dim_statut_colis, dim_agence×2, dim_wilaya, dim_commune, stg_yalidine_pricing | PCC columns: `tarif_theorique`, `ecart_tarif_dzd`; collapses ~27M history events via GROUP BY |
| `fact_depenses` | 1 row per expense | dim_agence, dim_company, stg_cashbox_rubriques | — |
| `fact_remboursements` | 1 row per reimbursement | dim_agence, dim_company | — |
| `fact_paiements_livreurs` | 1 row per driver payment | dim_freelance_driver, dim_agence | — |
| `fact_bulletins_salaire` | 1 row per payroll bulletin | dim_employee, dim_agence, dim_company | — |
| `fact_transport` | 1 row per transport request | dim_agence×2, dim_wilaya×2, dim_employee×2 (driver + second driver) | Profitability: `amount_invoiced - total_cost` |
| `fact_transferts_caisse` | 1 row per cash transfer | dim_agence×2 | — |

**PCC tariff lookup** in `fact_livraisons`:
```sql
CASE pa.delivery_type
    WHEN 'HD' THEN pr.tarif_hd
    WHEN 'SD' THEN pr.tarif_sd
END AS tarif_theorique
```
Where `pr` joins `stg_yalidine_pricing WHERE service_type = 'livraison'` by `wilaya_id`.

---

### Layer 4 — Aggregates (8 assets, group: `aggregates`)

All defined in `warehouse/aggregates.py` via factory function. Each asset calls `REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.<view_name>`.

| Asset | View | Fact deps | Business axis |
|---|---|---|---|
| `refresh_agg_livraisons_journalieres` | `agg_livraisons_journalieres` | `fact_livraisons` | Daily parcel volume & status KPIs |
| `refresh_agg_depenses_mensuelles` | `agg_depenses_mensuelles` | `fact_depenses` | Monthly expense breakdown |
| `refresh_agg_cout_total_mensuel` | `agg_cout_total_mensuel` | `fact_depenses`, `fact_bulletins_salaire`, `fact_paiements_livreurs` | Total cost consolidation |
| `refresh_agg_performance_livraison` | `agg_performance_livraison` | `fact_livraisons` | Delivery SLA & success rates |
| `refresh_agg_masse_salariale_mensuelle` | `agg_masse_salariale_mensuelle` | `fact_bulletins_salaire` | Payroll mass by agence/company |
| `refresh_agg_transport_mensuel` | `agg_transport_mensuel` | `fact_transport` | **Axis 1**: Transport costs, margin, KPIs per agence/service/vehicle |
| `refresh_agg_demande_transport` | `agg_demande_transport` | `fact_transport` | **Axis 1**: Demand matrix by wilaya corridor, client type, service type |
| `refresh_agg_profitabilite_colis` | `agg_profitabilite_colis` | `fact_livraisons` | **Axis 2** (PCC): Tariff deviation tracking by agence/zone/delivery type |

---

## Jobs & Schedules

### Jobs

| Job | Asset selection | Use case |
|---|---|---|
| `staging_job` | `group:staging` | Reload all staging tables |
| `dimensions_job` | `group:dimensions` | Refresh dimensions only |
| `facts_job` | `group:facts` | Reload facts only |
| `aggregates_job` | `group:aggregates` | Refresh all materialized views |
| `full_etl_job` | All groups | Full nightly pipeline |

### Schedules

| Schedule | Cron (UTC) | Algeria time | Job |
|---|---|---|---|
| `daily_etl_schedule` | `0 1 * * *` | 02:00 AM daily | `full_etl_job` |
| `weekly_dim_refresh_schedule` | `0 0 * * 0` | 01:00 AM Sunday | `dimensions_job` |

---

## Business Axes (MoSCoW)

### Must Have — Axis 1: Transport Request Analysis
Implemented via `fact_transport`, `agg_transport_mensuel`, `agg_demande_transport`.
- Cost evaluation per km / per kg / per piece
- Service type profitability (marge brute, taux_marge_pct)
- Demand corridor matrix (wilaya_depart × wilaya_arrivee) with `meme_region` flag

### Should Have — Axis 2: Parcel Cost Control (PCC)
Implemented via PCC columns on `fact_livraisons` + `agg_profitabilite_colis`.
- `tarif_theorique`: HD or SD tariff from pricing grid by destination wilaya
- `ecart_tarif_dzd = delivery_fee - tarif_theorique`
- Aggregate: `taux_ecart_pct`, `nbr_sous_tarif`, `nbr_sur_tarif`, `avg_ecart_absolu_dzd`

### Could Have — Axis 3: Route Analysis
**Not implemented.** See `warehouse/init.sql` placeholder block and `warehouse/README.md` for the planned schema: `fact_routes_optimisees`, `dim_route`, `dim_optimization_run`, `agg_optimisation_routes` (requires OR-Tools ETL asset).

---

## Design Decisions

- **Direct API extraction in staging assets**: Each staging asset calls its API client directly — no intermediate extraction layer. Removes indirection with no benefit at this pipeline size.
- **SQL-side transforms**: Business transforms (tariff lookup, SCD2 logic, parcel collapse) run as SQL inside the warehouse assets, co-located with the table they populate.
- **Incremental parcel history**: `stg_yalidine_parcel_history` uses `MAX(date_statut::DATE)` as a low-watermark. Each run deletes and reloads the latest day to handle late-arriving events. Full reload from 2023-01-01 on first run.
- **Company id=9 exclusion**: Applied at three levels — API (already filtered by mock-datasources), staging Python code (guard check), and warehouse schema (CHECK constraint on fact tables).
- **Sensitive field exclusion**: `password` (HRForce users), `CIN`/`NSS`/`RIB` (payroll bulletins) are never extracted — not present in any staging table.
