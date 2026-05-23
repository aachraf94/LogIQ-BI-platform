"""
Staging assets — Dedicated Transport API (1 endpoint → 2 staging tables).
Requests and stops come from the same endpoint; stops are embedded in each request.
"""

import uuid

from dagster import asset, AssetExecutionContext, MaterializeResult, MetadataValue

from ...resources.api_clients import TransportAPIClient
from ...resources.database import WarehousePostgresResource


@asset(
    group_name="staging",
    description="Load /transport/requests → stg_transport_requests (~13K rows)",
)
def stg_transport_requests(
    context: AssetExecutionContext,
    transport_api: TransportAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    requests_data = transport_api.get_all_requests()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            r["request_id"],
            r.get("created_at"),
            r.get("confirmed_at"),
            r.get("completed_at"),
            r.get("cancelled_at"),
            r.get("cancellation_reason"),
            r.get("status", ""),
            r.get("service_type", ""),
            r.get("sub_service_type"),
            # Client
            int(r["client"].get("client_id", 0)),
            r["client"].get("client_name", ""),
            r["client"].get("client_type", ""),
            r["client"].get("company_id"),
            r["client"].get("company_name"),
            r["client"].get("contact_phone"),
            r["client"].get("contact_email"),
            # Dispatch
            r.get("vehicle_dispatch", {}).get("dispatched_from_hub_id"),
            r.get("vehicle_dispatch", {}).get("dispatched_from_hub_name"),
            int(r.get("vehicle_dispatch", {}).get("dispatched_from_wilaya_id") or 0),
            r.get("vehicle_dispatch", {}).get("vehicle_departure_datetime"),
            r.get("vehicle_dispatch", {}).get("vehicle_return_datetime"),
            r.get("vehicle_dispatch", {}).get("total_vehicle_km"),
            # Departure
            r["departure"].get("location_type", ""),
            r["departure"].get("location_name", ""),
            r["departure"].get("address"),
            int(r["departure"].get("wilaya_id", 0)),
            r["departure"].get("wilaya_name"),
            r["departure"].get("commune_id"),
            r["departure"].get("commune_name"),
            r["departure"].get("gps"),
            r["departure"].get("scheduled_datetime"),
            r["departure"].get("actual_datetime"),
            # Arrival
            r["arrival"].get("location_type", ""),
            r["arrival"].get("location_name", ""),
            r["arrival"].get("address"),
            int(r["arrival"].get("wilaya_id", 0)),
            r["arrival"].get("wilaya_name"),
            r["arrival"].get("commune_id"),
            r["arrival"].get("commune_name"),
            r["arrival"].get("gps"),
            r["arrival"].get("scheduled_datetime"),
            r["arrival"].get("actual_datetime"),
            # Vehicle
            r["vehicle"].get("vehicle_id", ""),
            r["vehicle"].get("vehicle_type", ""),
            r["vehicle"].get("plate", ""),
            r["vehicle"].get("brand"),
            r["vehicle"].get("model"),
            r["vehicle"].get("payload_capacity_kg"),
            r["vehicle"].get("volume_capacity_m3"),
            int(r["vehicle"].get("driver_id", 0)),
            r["vehicle"].get("driver_name", ""),
            r["vehicle"].get("driver_phone"),
            r["vehicle"].get("second_driver_id"),
            r["vehicle"].get("second_driver_name"),
            # Cargo
            r["cargo"].get("merchandise_type"),
            r["cargo"].get("merchandise_description"),
            bool(r["cargo"].get("fragile", False)),
            bool(r["cargo"].get("hazardous", False)),
            r["cargo"].get("total_weight_kg"),
            r["cargo"].get("total_volume_m3"),
            int(r["cargo"].get("nbr_pieces", 0)),
            int(r["cargo"].get("nbr_pieces_lt50kg", 0)),
            int(r["cargo"].get("nbr_pieces_50_99kg", 0)),
            int(r["cargo"].get("nbr_pieces_100_199kg", 0)),
            int(r["cargo"].get("nbr_pieces_gte200kg", 0)),
            bool(r["cargo"].get("requires_clark", False)),
            bool(r["cargo"].get("requires_packaging", False)),
            r["cargo"].get("declared_value_dzd"),
            # Routing
            int(r["routing"].get("nbr_stops_pickup", 0)),
            int(r["routing"].get("nbr_stops_delivery", 0)),
            int(r["routing"].get("nbr_stops_total", 0)),
            r["routing"].get("distance_unit_km"),
            r["routing"].get("distance_real_km"),
            r["routing"].get("distance_extra_km"),
            r["routing"].get("total_duration_minutes"),
            r["routing"].get("total_waiting_time_minutes"),
            bool(r["routing"].get("is_night_shift", False)),
            r["routing"].get("night_shift_hours"),
            int(r["routing"].get("nbr_floors", 0)),
            bool(r["routing"].get("return_trip", False)),
            # Cost breakdown
            r["cost_breakdown"].get("cout_base"),
            r["cost_breakdown"].get("cout_distance_supp", 0),
            r["cost_breakdown"].get("cout_ramassage", 0),
            r["cost_breakdown"].get("cout_livraison", 0),
            r["cost_breakdown"].get("cout_manutention", 0),
            r["cost_breakdown"].get("cout_emballage", 0),
            r["cost_breakdown"].get("cout_tarif_nuit", 0),
            r["cost_breakdown"].get("cout_prod_frais", 0),
            r["cost_breakdown"].get("cout_assurance"),
            r["cost_breakdown"].get("cout_carburant"),
            r["cost_breakdown"].get("cout_peage"),
            r["cost_breakdown"].get("total_cost"),
            # Billing
            r["billing"].get("amount_invoiced"),
            r["billing"].get("amount_paid"),
            r["billing"].get("payment_method"),
            r["billing"].get("payment_status", ""),
            r["billing"].get("invoice_ref"),
            r["billing"].get("invoiced_at"),
            r["billing"].get("paid_at"),
            # Performance
            r.get("performance", {}).get("departure_delay_minutes"),
            r.get("performance", {}).get("arrival_delay_minutes"),
            r.get("performance", {}).get("on_time"),
            r.get("performance", {}).get("client_rating"),
            r.get("performance", {}).get("client_feedback"),
            batch_id,
        )
        for r in requests_data
        if r.get("request_id") and r.get("departure") and r.get("arrival")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_transport_requests (
                request_id, created_at_src, confirmed_at, completed_at,
                cancelled_at, cancellation_reason, status, service_type, sub_service_type,
                client_id, client_name, client_type, client_company_id, client_company_name,
                client_contact_phone, client_contact_email,
                dispatched_from_hub_id, dispatched_from_hub_name, dispatched_from_wilaya_id,
                vehicle_departure_dt, vehicle_return_dt, total_vehicle_km,
                depart_location_type, depart_location_name, depart_address,
                depart_wilaya_id, depart_wilaya_name, depart_commune_id, depart_commune_name,
                depart_gps, depart_scheduled_dt, depart_actual_dt,
                arrival_location_type, arrival_location_name, arrival_address,
                arrival_wilaya_id, arrival_wilaya_name, arrival_commune_id, arrival_commune_name,
                arrival_gps, arrival_scheduled_dt, arrival_actual_dt,
                vehicle_id, vehicle_type, vehicle_plate, vehicle_brand, vehicle_model,
                payload_capacity_kg, volume_capacity_m3,
                driver_id, driver_name, driver_phone,
                second_driver_id, second_driver_name,
                merchandise_type, merchandise_description, fragile, hazardous,
                total_weight_kg, total_volume_m3, nbr_pieces,
                nbr_pieces_lt50kg, nbr_pieces_50_99kg, nbr_pieces_100_199kg, nbr_pieces_gte200kg,
                requires_clark, requires_packaging, declared_value_dzd,
                nbr_stops_pickup, nbr_stops_delivery, nbr_stops_total,
                distance_unit_km, distance_real_km, distance_extra_km,
                total_duration_minutes, total_waiting_time_minutes,
                is_night_shift, night_shift_hours, nbr_floors, return_trip,
                cout_base, cout_distance_supp, cout_ramassage, cout_livraison,
                cout_manutention, cout_emballage, cout_tarif_nuit, cout_prod_frais,
                cout_assurance, cout_carburant, cout_peage, total_cost,
                amount_invoiced, amount_paid, payment_method, payment_status,
                invoice_ref, invoiced_at, paid_at,
                departure_delay_minutes, arrival_delay_minutes, on_time,
                client_rating, client_feedback,
                batch_id
            ) VALUES %s
            ON CONFLICT (request_id) DO UPDATE SET
                status         = EXCLUDED.status,
                completed_at   = EXCLUDED.completed_at,
                amount_paid    = EXCLUDED.amount_paid,
                payment_status = EXCLUDED.payment_status,
                on_time        = EXCLUDED.on_time,
                client_rating  = EXCLUDED.client_rating,
                batch_id       = EXCLUDED.batch_id,
                updated_at     = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} transport requests")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})


@asset(
    group_name="staging",
    deps=["stg_transport_requests"],
    description="Load /transport/stops → stg_transport_stops (dedicated endpoint, no redundant requests fetch)",
)
def stg_transport_stops(
    context: AssetExecutionContext,
    transport_api: TransportAPIClient,
    warehouse_db: WarehousePostgresResource,
) -> MaterializeResult:
    stops_data = transport_api.get_all_stops()
    batch_id = uuid.uuid4().hex[:8]

    records = [
        (
            s["stop_id"],
            s["request_id"],
            int(s.get("stop_order") or 0),
            s.get("stop_type", ""),
            s.get("location_type", ""),
            s.get("location_name", ""),
            s.get("address"),
            int(s.get("wilaya_id") or 0),
            s.get("commune_id"),
            s.get("gps"),
            s.get("scheduled_datetime"),
            s.get("actual_datetime"),
            s.get("waiting_time_minutes"),
            s.get("distance_from_previous_km"),
            batch_id,
        )
        for s in stops_data
        if s.get("stop_id") and s.get("request_id")
    ]

    with warehouse_db.get_connection() as conn:
        warehouse_db.bulk_insert(conn, """
            INSERT INTO warehouse.stg_transport_stops (
                stop_id, request_id, stop_order, stop_type, location_type,
                location_name, address, wilaya_id, commune_id, gps,
                scheduled_datetime, actual_datetime,
                waiting_time_minutes, distance_from_prev_km,
                batch_id
            ) VALUES %s
            ON CONFLICT (stop_id) DO UPDATE SET
                actual_datetime      = EXCLUDED.actual_datetime,
                waiting_time_minutes = EXCLUDED.waiting_time_minutes,
                batch_id             = EXCLUDED.batch_id,
                updated_at           = NOW()
        """, records)

    context.log.info(f"Loaded {len(records)} transport stops")
    return MaterializeResult(metadata={"row_count": MetadataValue.int(len(records))})
