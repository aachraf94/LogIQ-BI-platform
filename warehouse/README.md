# LOGIQ Data Warehouse

PostgreSQL 17 analytical database (`logiq_warehouse`). Constellation schema (multiple fact tables sharing conformed dimensions).

**Schema name:** `warehouse`

## Initialize

```bash
psql -U logiq_warehouse_user -p 5433 -d logiq_warehouse -f init.sql
```

Re-run safe: all `CREATE` statements use `IF NOT EXISTS`, seed inserts use `ON CONFLICT DO NOTHING`.

## Layers

| Layer | Tables | Description |
|---|---|---|
| Staging | 18 | Raw API data; one table per source endpoint |
| Dimensions | 11 | Conformed dims; `dim_agence` + `dim_employee` = SCD Type 2 |
| Facts | 7 | One row per business event (parcel, expense, salary, transport, etc.) |
| Aggregates | 8 | Materialized views — primary source for dashboard KPIs |

## Fact Tables

| Table | Grain | Key measures |
|---|---|---|
| `fact_livraisons` | Per parcel (tracking) | `delivery_fee`, `tarif_theorique` (PCC), `ecart_tarif_dzd` |
| `fact_depenses` | Per expense | `montant` (DZD) |
| `fact_remboursements` | Per reimbursement | `declared_value`, `montant_rembourse` |
| `fact_paiements_livreurs` | Per driver payment | `nbr_colis_livres`, `total_net` |
| `fact_bulletins_salaire` | Per employee per month | `total_brut`, `net_a_payer`, 15 salary components |
| `fact_transport` | Per transport request | 10 cost components, `total_cost`, `distance_real_km` |
| `fact_transferts_caisse` | Per fund transfer | `montant` — excluded from cost aggregates |

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

The Dagster `aggregates_job` does this automatically.

## Key Constraints

- `cout_assurance >= 5000` — CHECK on `fact_transport`
- Company id=9 (TEST) excluded via CHECK on all fact tables
- All monetary amounts in DZD
- `dim_date` spans 2022-01-01 → 2026-12-31

## Full documentation

See [docs/dw-doc.md](../../docs/dw-doc.md).
