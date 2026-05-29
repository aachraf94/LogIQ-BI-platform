# LOGIQ Data Warehouse

PostgreSQL 17 analytical database (`logiq_warehouse`). **Snowflake schema** — normalized hierarchies, zero redundancy, navigation via JOINs.

**Schema name:** `warehouse`

---

## Initialize

```bash
psql -U logiq_warehouse_user -p 5433 -d logiq_warehouse -f init.sql
```

Re-run safe: all `CREATE TABLE` use `IF NOT EXISTS`, seed inserts use `ON CONFLICT DO NOTHING`.

---

## Layers

| Layer | Count | Description |
|---|---|---|
| Staging | 18 tables | Raw API data — one table per source endpoint, no transformations |
| Dimensions | 49 tables | Snowflake dims; 2 SCD Type 2, 2 junk dims, 1 calendar spine |
| Facts | 7 tables | One row per business event — see table below |
| Aggregates | 8 views | Materialized views — primary source for dashboard KPIs |

---

## Directory Structure

```
warehouse/
├── init.sql                  ← master init script (run this)
├── staging/                  ← 18 staging tables (one per API endpoint)
├── dimensions/
│   ├── geographic/           ← dim_region, dim_wilaya, dim_commune,
│   │                            dim_agency_type, dim_agence (SCD2), dim_center
│   ├── hr/                   ← dim_company, dim_department, dim_service,
│   │                            dim_occupation, dim_role, dim_employee_status,
│   │                            dim_employee (SCD2), dim_livreur_vehicule_type,
│   │                            dim_livreur_freelance
│   ├── time/                 ← dim_date (2022–2026 calendar spine)
│   ├── parcel/               ← dim_parcels_status, dim_parcel_type,
│   │                            dim_delivery_type, dim_zone,
│   │                            dim_pricing_service_type, dim_pricing, dim_parcel
│   ├── paie/                 ← dim_contract_type, dim_contract_regime,
│   │                            dim_contract, dim_bulletin
│   ├── cashbox/              ← dim_nature_category, dim_nature, dim_rubriques,
│   │                            dim_depense_status, dim_sinistre_type,
│   │                            dim_depense, dim_paiement_livreurs,
│   │                            dim_remboursement, dim_depense_backref_fk
│   └── transport/            ← 20 dims: client, vehicle, cargo (junk),
│                                routing (junk), departure, arrival,
│                                stops, dim_transport (central entity), …
├── facts/                    ← 7 fact tables
└── aggregates/               ← 8 materialized views
```

---

## Fact Tables

| Table | Grain | PK | Key measures |
|---|---|---|---|
| `fact_parcel_revenue` | Per resolved parcel | `parcel_key` | `delivery_fee`, `tarif_theorique`, `ecart_tarif` |
| `fact_parcel_performance` | Per resolved parcel | `parcel_key` | `nbr_evenements`, `duree_totale_minutes`, `nbr_tentatives_livraison` |
| `fact_cost_salaire` | Per payslip | `bulletin_id` | `total_brut`, `total_deductions`, `total_charges_patronales` |
| `fact_charges` | Per cashbox expense | `depense_id` | `montant` (DZD) |
| `fact_transport_cost` | Per transport request | `transport_key` | 10 cost components + `total_cost` |
| `fact_transport_billing` | Per transport request | `transport_key` | `amount_invoiced`, `amount_paid`, `marge_brute_dzd` |
| `fact_transport_performance` | Per transport request | `transport_key` | distances, durations, stops, `on_time`, `client_rating` |

### Financial perimeters

| Perimeter | Revenue | Cost |
|---|---|---|
| Express Service | `fact_parcel_revenue.delivery_fee` | `fact_cost_salaire` + `fact_charges` |
| On-Demand Transport | `fact_transport_billing.amount_invoiced` | `fact_transport_cost.total_cost` |

---

## Dimension Highlights

### SCD Type 2
`dim_agence` and `dim_employee` track historical changes. Always join via `agence_key` / `employee_key` (surrogate), never the business key.

### Junk Dimensions
- `dim_transport_cargo` — cargo boolean flags (fragile, hazardous, requires_clark, requires_packaging) + merchandise_type
- `dim_transport_routing` — routing profile flags (night_shift, return_trip, distance_category, complexity_category)

### Cashbox Circular FK (2-pass ETL)
`dim_depense` ↔ `dim_paiement_livreurs` / `dim_remboursement` is a mutual reference. Handled by:
1. Loading `dim_depense` first with `paiement_livreur_id = NULL` and `remboursement_id = NULL`
2. Loading `dim_paiement_livreurs` and `dim_remboursement` (both reference `dim_depense.depense_id`)
3. `dim_depense_backref_fk.sql` adds the back-ref FK constraints (`DEFERRABLE INITIALLY DEFERRED`)
4. ETL second-pass UPDATE fills the back-ref columns

### Geographic Navigation
When `commune_id` is set → navigate `commune_id → dim_commune → dim_wilaya → dim_region`.  
When `commune_id` is NULL (transport deps) → use `wilaya_id` directly (always populated as fallback).

### Denormalization Exceptions — `dim_employee`

`dim_employee` carries two columns that are technically reachable via JOIN chains but are copied directly for stability:

- **`hire_date_id`** — not sourced from `dim_contract.hire_date_id` because `contract_key` is nullable (employees with no payslips) and changes across SCD2 versions (new contract → new `hire_date_id` in the contract row). The column on `dim_employee` is the employee's fixed original hire date.
- **`company_id`** — not sourced via `dim_agence.company_id` because `agence_key` is nullable (unassigned employees) and `dim_agence` is SCD2: an agency re-assigned to a different company would produce the wrong company via the join chain. The direct column is immune to that drift.

---

## Key Constraints

| Constraint | Where |
|---|---|
| `cout_assurance >= 5000 DZD` | `fact_transport_cost` |
| `company_id = 9` (TEST) excluded | All fact tables — filtered at ETL load |
| All monetary amounts in **DZD** | Throughout |
| `dim_date` spans `2022-01-01 → 2026-12-31` | 1 826 rows |
| One bulletin per employee per month | `UNIQUE (employee_key, period_month, period_year)` on `dim_bulletin` |
| One pricing row per (service × wilaya × date) | `UNIQUE` constraint on `dim_pricing` |

---

## Refresh Aggregates

After every ETL run:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_livraisons_journalieres;
REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_depenses_mensuelles;
REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_cout_total_mensuel;
REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_performance_livraison;
REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_masse_salariale_mensuelle;
REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_transport_mensuel;
REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_demande_transport;
REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse.agg_profitabilite_colis;
```

The Dagster `aggregates_job` runs this automatically after each ETL pipeline.

---

## Full Design Documentation

See [docs/DW Design/dw-dim-fact-redesign-claude.md](../../docs/DW%20Design/dw-dim-fact-redesign-claude.md).
