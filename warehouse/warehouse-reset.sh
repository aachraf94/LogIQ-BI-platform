#!/usr/bin/env bash
# =============================================================================
# warehouse-reset.sh — LOGIQ Warehouse Maintenance Utility
#
# Clears or drops/recreates warehouse tables with interactive scope/action menus.
#
# Usage (run from logiq/ or from warehouse/):
#   bash warehouse/warehouse-reset.sh
#
# Scope options:
#   1) All tables          — staging + dims + facts + agg views
#   2) Staging only        — stg_* tables only
#   3) Dims, Facts & Agg   — dim_* + fact_* + agg views; staging untouched
#
# Action options:
#   1) Clear data only     — TRUNCATE (keeps structure, resets sequences)
#   2) Drop & recreate     — DROP tables then re-run init.sql
# =============================================================================
set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # warehouse/
COMPOSE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"                   # logiq/
CONTAINER="warehouse-db"
DB_USER="logiq_warehouse_user"
DB_NAME="logiq_warehouse"

# ── Colors ────────────────────────────────────────────────────────────────────
R='\033[0;31m'; Y='\033[1;33m'; G='\033[0;32m'; C='\033[0;36m'
B='\033[1m'; N='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo -e "${C}>>>${N} $*"; }
die()  { echo -e "${R}[ERROR]${N} $*" >&2; exit 1; }

run_sql() {
    # Pipe a SQL string into psql inside the warehouse-db container.
    cd "$COMPOSE_DIR"
    docker compose exec -T "$CONTAINER" \
        psql -U "$DB_USER" -d "$DB_NAME" <<< "$1"
}

run_init() {
    # Copy the full warehouse/ directory into the container and run init.sql.
    # The --workdir flag makes \i paths resolve correctly relative to /tmp/warehouse.
    log "Copying warehouse files into container..."
    cd "$COMPOSE_DIR"
    docker compose cp ./warehouse/. "${CONTAINER}:/tmp/warehouse/"
    log "Running init.sql..."
    docker compose exec --workdir /tmp/warehouse "$CONTAINER" \
        psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/warehouse/init.sql
}

# ── Menus ─────────────────────────────────────────────────────────────────────
echo
echo -e "${B}═══════════════════════════════════════════════════════${N}"
echo -e "${B}   LOGIQ Warehouse Reset Utility                       ${N}"
echo -e "${B}═══════════════════════════════════════════════════════${N}"
echo

echo -e "${B}Scope — which tables to target:${N}"
echo "  1) All tables          (staging + dims + facts + agg views)"
echo "  2) Staging only        (stg_* tables)"
echo "  3) Dims, Facts & Agg   (dim_* + fact_* + agg views; staging untouched)"
echo
read -rp "Choice [1-3]: " scope_input

echo
echo -e "${B}Action — what to do:${N}"
echo "  1) Clear data only   (TRUNCATE — keeps table structure, resets sequences)"
echo "  2) Drop & recreate   (DROP tables + re-run init.sql to rebuild schema)"
echo
read -rp "Choice [1-2]: " action_input

# ── Validate ──────────────────────────────────────────────────────────────────
case "$scope_input" in
    1) SCOPE="all"     ; SCOPE_LABEL="All tables (staging + dims + facts + agg)"  ;;
    2) SCOPE="staging" ; SCOPE_LABEL="Staging tables only (stg_*)"                ;;
    3) SCOPE="dfa"     ; SCOPE_LABEL="Dims, Facts & Agg views"                    ;;
    *) die "Invalid scope choice: $scope_input" ;;
esac

case "$action_input" in
    1) ACTION="clear"    ; ACTION_LABEL="Clear data (TRUNCATE)"               ;;
    2) ACTION="recreate" ; ACTION_LABEL="Drop and recreate (DROP + init.sql)" ;;
    *) die "Invalid action choice: $action_input" ;;
esac

# ── Confirm ───────────────────────────────────────────────────────────────────
echo
echo -e "${Y}───────────────────────────────────────────────────────${N}"
echo -e "  ${B}Scope :${N}  $SCOPE_LABEL"
echo -e "  ${B}Action:${N}  $ACTION_LABEL"
if [[ "$ACTION" == "recreate" ]]; then
    echo -e "  ${R}⚠  Table structures will be DROPPED — data is unrecoverable.${N}"
fi
echo -e "${Y}───────────────────────────────────────────────────────${N}"
echo
read -rp "Proceed? [y/N]: " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
echo

# =============================================================================
# SQL: Staging — TRUNCATE
# =============================================================================
SQL_STAGING_TRUNCATE="
SET search_path TO warehouse, public;
BEGIN;
TRUNCATE
    stg_yalidine_parcel_history,
    stg_yalidine_pricing,
    stg_yalidine_centers,
    stg_yalidine_communes,
    stg_yalidine_wilayas,
    stg_hrforce_companies,
    stg_hrforce_agencies,
    stg_hrforce_users,
    stg_hrforce_occupations,
    stg_cashbox_natures,
    stg_cashbox_rubriques,
    stg_cashbox_depenses,
    stg_cashbox_paiements_livreurs,
    stg_cashbox_remboursements,
    stg_cashbox_transferts,
    stg_paie_bulletins,
    stg_transport_requests,
    stg_transport_stops
RESTART IDENTITY CASCADE;
COMMIT;
SELECT 'Staging tables cleared (18 tables).' AS result;
"

# =============================================================================
# SQL: Facts — TRUNCATE
# =============================================================================
SQL_FACTS_TRUNCATE="
SET search_path TO warehouse, public;
BEGIN;
TRUNCATE
    fact_parcel_revenue,
    fact_parcel_performance,
    fact_cost_salaire,
    fact_charges,
    fact_transport_cost,
    fact_transport_billing,
    fact_transport_performance
RESTART IDENTITY CASCADE;
COMMIT;
SELECT 'Fact tables cleared (7 tables).' AS result;
"

# =============================================================================
# SQL: Dims — TRUNCATE (FK-safe order, mirrors clear_data.sql)
# Preserved (seeded by init.sql, not ETL-managed):
#   dim_date, dim_region, dim_delivery_type, dim_parcel_type, dim_zone,
#   dim_distance_category, dim_complexity_category
# =============================================================================
SQL_DIMS_TRUNCATE="
SET search_path TO warehouse, public;
BEGIN;

-- Parcel dimension
TRUNCATE dim_parcel RESTART IDENTITY CASCADE;
-- ETL-managed enum (re-seeded by ETL on next run)
TRUNCATE dim_parcels_status RESTART IDENTITY CASCADE;

-- Transport: stops before dim_transport (stops.transport_key -> dim_transport)
TRUNCATE
    dim_transport_stops,
    dim_transport,
    dim_transport_departure,
    dim_transport_arrival,
    dim_transport_cargo,
    dim_transport_routing,
    dim_transport_vehicle,
    dim_transport_client,
    dim_transport_client_company
RESTART IDENTITY CASCADE;
-- Transport enum dims
TRUNCATE
    dim_transport_vehicle_type,
    dim_transport_service_type,
    dim_transport_sub_service_type,
    dim_transport_status,
    dim_transport_payment_status,
    dim_transport_merchandise_type,
    dim_location_type,
    dim_stop_type,
    dim_client_type
RESTART IDENTITY CASCADE;

-- Salary dims
TRUNCATE dim_bulletin RESTART IDENTITY CASCADE;

-- Cashbox dims: circular FK (dim_depense <-> paiement_livreurs, remboursement)
-- Truncate all three together so PostgreSQL resolves the cycle atomically.
TRUNCATE
    dim_paiement_livreurs,
    dim_remboursement,
    dim_depense
RESTART IDENTITY CASCADE;
-- Cashbox enum dims
TRUNCATE
    dim_sinistre_type,
    dim_depense_status,
    dim_rubriques,
    dim_nature,
    dim_nature_category
RESTART IDENTITY CASCADE;

-- HR / Contract dims
TRUNCATE dim_livreur_freelance RESTART IDENTITY CASCADE;
TRUNCATE dim_employee          RESTART IDENTITY CASCADE;  -- SCD2
TRUNCATE dim_contract          RESTART IDENTITY CASCADE;
-- HR enum dims
TRUNCATE
    dim_role,
    dim_employee_status,
    dim_livreur_vehicule_type,
    dim_contract_type,
    dim_contract_regime
RESTART IDENTITY CASCADE;

-- Geographic dims
TRUNCATE dim_pricing             RESTART IDENTITY CASCADE;
TRUNCATE dim_center              RESTART IDENTITY CASCADE;
TRUNCATE dim_agence              RESTART IDENTITY CASCADE;  -- SCD2
TRUNCATE dim_commune             RESTART IDENTITY CASCADE;
TRUNCATE dim_wilaya              RESTART IDENTITY CASCADE;
TRUNCATE dim_agency_type         RESTART IDENTITY CASCADE;
TRUNCATE dim_pricing_service_type RESTART IDENTITY CASCADE;
-- Org hierarchy
TRUNCATE dim_occupation          RESTART IDENTITY CASCADE;
TRUNCATE dim_service             RESTART IDENTITY CASCADE;
TRUNCATE dim_department          RESTART IDENTITY CASCADE;
TRUNCATE dim_company             RESTART IDENTITY CASCADE;

COMMIT;
SELECT 'Dim tables cleared.' AS result;
"

# =============================================================================
# SQL: Agg materialized views — REFRESH after fact truncation
# Handles the case where agg views already exist; no-op if none exist yet.
# =============================================================================
SQL_AGG_REFRESH="
SET search_path TO warehouse, public;
DO \$\$
DECLARE v text;
BEGIN
    FOR v IN
        SELECT matviewname
        FROM   pg_matviews
        WHERE  schemaname = 'warehouse'
        AND    matviewname LIKE 'agg_%'
    LOOP
        EXECUTE 'REFRESH MATERIALIZED VIEW warehouse.' || v;
        RAISE NOTICE 'Refreshed: %', v;
    END LOOP;
END \$\$;
SELECT COALESCE(
    (SELECT 'Refreshed ' || count(*)::text || ' agg view(s).'
     FROM pg_matviews WHERE schemaname = 'warehouse' AND matviewname LIKE 'agg_%'),
    'No agg views found.'
) AS result;
"

# =============================================================================
# SQL: Staging — DROP
# =============================================================================
SQL_STAGING_DROP="
SET search_path TO warehouse, public;
DROP TABLE IF EXISTS
    stg_yalidine_parcel_history,
    stg_yalidine_pricing,
    stg_yalidine_centers,
    stg_yalidine_communes,
    stg_yalidine_wilayas,
    stg_hrforce_companies,
    stg_hrforce_agencies,
    stg_hrforce_users,
    stg_hrforce_occupations,
    stg_cashbox_natures,
    stg_cashbox_rubriques,
    stg_cashbox_depenses,
    stg_cashbox_paiements_livreurs,
    stg_cashbox_remboursements,
    stg_cashbox_transferts,
    stg_paie_bulletins,
    stg_transport_requests,
    stg_transport_stops
CASCADE;
SELECT 'Staging tables dropped.' AS result;
"

# =============================================================================
# SQL: Dims + Facts + Agg — DROP
# Facts dropped first to remove FK references into dims, then all dims.
# CASCADE on each DROP TABLE handles any remaining inter-table FK chains.
# =============================================================================
SQL_DFA_DROP="
SET search_path TO warehouse, public;

-- Agg materialized views (may not exist yet — IF EXISTS is safe)
DROP MATERIALIZED VIEW IF EXISTS
    agg_livraisons_journalieres,
    agg_depenses_mensuelles,
    agg_cout_total_mensuel,
    agg_performance_livraison,
    agg_masse_salariale_mensuelle,
    agg_transport_mensuel,
    agg_demande_transport,
    agg_profitabilite_colis
CASCADE;

-- Facts first — removes FK references that point into dims
DROP TABLE IF EXISTS
    fact_parcel_revenue,
    fact_parcel_performance,
    fact_cost_salaire,
    fact_charges,
    fact_transport_cost,
    fact_transport_billing,
    fact_transport_performance
CASCADE;

-- All dim tables — CASCADE resolves inter-dim FK order automatically
DROP TABLE IF EXISTS
    dim_parcel,
    dim_parcels_status,
    dim_parcel_type,
    dim_delivery_type,
    dim_zone,
    dim_pricing,
    dim_pricing_service_type,
    dim_transport_stops,
    dim_transport,
    dim_transport_departure,
    dim_transport_arrival,
    dim_transport_cargo,
    dim_transport_routing,
    dim_transport_vehicle,
    dim_transport_vehicle_type,
    dim_transport_client,
    dim_transport_client_company,
    dim_transport_service_type,
    dim_transport_sub_service_type,
    dim_transport_status,
    dim_transport_payment_status,
    dim_transport_merchandise_type,
    dim_location_type,
    dim_stop_type,
    dim_client_type,
    dim_bulletin,
    dim_paiement_livreurs,
    dim_remboursement,
    dim_depense,
    dim_sinistre_type,
    dim_depense_status,
    dim_rubriques,
    dim_nature,
    dim_nature_category,
    dim_livreur_freelance,
    dim_employee,
    dim_contract,
    dim_role,
    dim_employee_status,
    dim_livreur_vehicule_type,
    dim_contract_type,
    dim_contract_regime,
    dim_center,
    dim_agence,
    dim_commune,
    dim_wilaya,
    dim_agency_type,
    dim_occupation,
    dim_service,
    dim_department,
    dim_company,
    dim_region,
    dim_date
CASCADE;

SELECT 'Dims, facts, and agg views dropped.' AS result;
"

# =============================================================================
# Execute
# =============================================================================
case "$SCOPE:$ACTION" in

  # ── All: TRUNCATE ───────────────────────────────────────────────────────────
  "all:clear")
    log "Truncating fact tables..."
    run_sql "$SQL_FACTS_TRUNCATE"

    log "Truncating dim tables..."
    run_sql "$SQL_DIMS_TRUNCATE"

    log "Refreshing agg materialized views..."
    run_sql "$SQL_AGG_REFRESH"

    log "Truncating staging tables..."
    run_sql "$SQL_STAGING_TRUNCATE"

    echo -e "\n${G}Done.${N} All warehouse data cleared. Re-run the ETL pipeline to repopulate."
    ;;

  # ── Staging: TRUNCATE ───────────────────────────────────────────────────────
  "staging:clear")
    log "Truncating staging tables..."
    run_sql "$SQL_STAGING_TRUNCATE"

    echo -e "\n${G}Done.${N} Staging tables cleared. Dims and facts untouched."
    ;;

  # ── Dims + Facts + Agg: TRUNCATE ────────────────────────────────────────────
  "dfa:clear")
    log "Truncating fact tables..."
    run_sql "$SQL_FACTS_TRUNCATE"

    log "Truncating dim tables..."
    run_sql "$SQL_DIMS_TRUNCATE"

    log "Refreshing agg materialized views..."
    run_sql "$SQL_AGG_REFRESH"

    echo -e "\n${G}Done.${N} Dims, facts, and agg views cleared. Staging tables untouched."
    ;;

  # ── All: DROP + recreate ────────────────────────────────────────────────────
  "all:recreate")
    log "Dropping schema warehouse CASCADE..."
    run_sql "DROP SCHEMA IF EXISTS warehouse CASCADE; CREATE SCHEMA warehouse;"

    run_init
    echo -e "\n${G}Done.${N} Full warehouse schema dropped and recreated from init.sql."
    ;;

  # ── Staging: DROP + recreate ────────────────────────────────────────────────
  "staging:recreate")
    log "Dropping staging tables..."
    run_sql "$SQL_STAGING_DROP"

    # init.sql uses IF NOT EXISTS — dims/facts already exist so they are skipped;
    # only the dropped staging tables are recreated.
    run_init
    echo -e "\n${G}Done.${N} Staging tables dropped and recreated. Dims and facts preserved."
    ;;

  # ── Dims + Facts + Agg: DROP + recreate ─────────────────────────────────────
  "dfa:recreate")
    log "Dropping dims, facts, and agg views..."
    run_sql "$SQL_DFA_DROP"

    # init.sql uses IF NOT EXISTS — staging tables already exist so they are skipped;
    # all dropped dims and facts are recreated and re-seeded.
    run_init
    echo -e "\n${G}Done.${N} Dims, facts, and agg views dropped and recreated. Staging preserved."
    ;;

esac
