"""
Analytics API views — read-only endpoints querying the data warehouse.

All views require JWT authentication. Queries run against the warehouse
PostgreSQL database via the LogiqDBRouter / direct connections['warehouse'].
"""

import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .queries import overview as ovq
from .queries import parcel_delivery as pdq
from .queries import transport as tq

logger = logging.getLogger(__name__)


# ─── Parcel Delivery analytics (date-range based) ────────────────────────────
#
# All views accept:
#   start_date (required) — YYYY-MM-DD
#   end_date   (required) — YYYY-MM-DD
#   delivery_type (optional) — 'HD' | 'SD'
#
# Endpoints are mounted at /api/analytics/parcel-delivery/...


def _pd_filters(request):
    return (
        request.query_params.get("start_date"),
        request.query_params.get("end_date"),
        request.query_params.get("delivery_type"),
    )


class ParcelDeliveryOpsKpisView(APIView):
    """
    GET /api/analytics/parcel-delivery/ops-kpis/

    Params: start_date, end_date, delivery_type
    Returns: volume KPIs (nbr_colis, livres, retours, echecs, en_transit,
             avg_duree_h) + period-over-period % deltas.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_ops_kpis(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryOpsTrendView(APIView):
    """
    GET /api/analytics/parcel-delivery/ops-trend/

    Params: start_date, end_date, delivery_type
    Returns: daily series [{date, nbr_livres, nbr_retours, nbr_echecs, nbr_en_transit}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_ops_trend(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryStatusBreakdownView(APIView):
    """
    GET /api/analytics/parcel-delivery/status-breakdown/

    Params: start_date, end_date, delivery_type
    Returns: [{status_name, nbr_colis}] ordered by volume desc.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_status_breakdown(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryRegionFlowView(APIView):
    """
    GET /api/analytics/parcel-delivery/region-flow/

    Params: start_date, end_date, delivery_type
    Returns: [{origin, destination, nbr_colis}] — wilaya-level flow matrix (≤200 rows).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_region_flow(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryZoneBreakdownView(APIView):
    """
    GET /api/analytics/parcel-delivery/zone-breakdown/

    Params: start_date, end_date, delivery_type
    Returns: [{zone_num, fee_range, nbr_colis, nbr_livres, taux_livraison_pct}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_zone_breakdown(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryCostKpisView(APIView):
    """
    GET /api/analytics/parcel-delivery/cost-kpis/

    Params: start_date, end_date, delivery_type
    Returns: revenue/cost/margin KPIs with period-over-period % deltas.
    Revenue from date_terminal_id; costs from expense/payroll dates.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_cost_kpis(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryRevenueCostTrendView(APIView):
    """
    GET /api/analytics/parcel-delivery/revenue-cost-trend/

    Params: start_date, end_date, delivery_type
    Returns: monthly [{period, total_fees, cout_total, marge_brute}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_revenue_cost_trend(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryCostByNatureView(APIView):
    """
    GET /api/analytics/parcel-delivery/cost-by-nature/

    Params: start_date, end_date
    Returns: [{nature_name, total_dzd}] ordered by amount desc.
    Source: fact_charges (validated) grouped by dim_nature.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, _ = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_cost_by_nature(start, end))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryRegionProfitView(APIView):
    """
    GET /api/analytics/parcel-delivery/region-profit/

    Params: start_date, end_date, delivery_type
    Returns: [{origin, destination, nbr_colis, total_fees, cout_total, marge_brute, marge_pct}].
    Costs allocated proportionally to each flow's revenue share.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_region_profit(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryZoneProfitView(APIView):
    """
    GET /api/analytics/parcel-delivery/zone-profit/

    Params: start_date, end_date, delivery_type
    Returns: [{zone_num, fee_range, nbr_colis, total_fees, cout_total, marge_brute, marge_pct}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_zone_profit(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryPerfKpisView(APIView):
    """
    GET /api/analytics/parcel-delivery/perf-kpis/

    Params: start_date, end_date, delivery_type
    Returns: taux_livraison_pct, avg_tentatives, taux_premier_essai_pct,
             avg_duree_livraison_h, nbr_sinistres + pop_* deltas.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_perf_kpis(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryPerfTrendView(APIView):
    """
    GET /api/analytics/parcel-delivery/perf-trend/

    Params: start_date, end_date, delivery_type
    Returns: monthly [{period, taux_livraison_pct, avg_duree_livraison_h}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_perf_trend(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryDurationDistributionView(APIView):
    """
    GET /api/analytics/parcel-delivery/duration-distribution/

    Params: start_date, end_date, delivery_type
    Returns: [{bucket, bucket_order, nbr_colis}] — 6-bucket histogram (delivered parcels).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_duration_distribution(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryCenterExpeditionRankingView(APIView):
    """
    GET /api/analytics/parcel-delivery/center-expedition-ranking/

    Params: start_date, end_date, delivery_type, limit (default 8)
    Returns: [{center_code, center_name, nbr_colis}] top N departure centers.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_center_expedition_ranking(
                start, end, dt,
                limit=request.query_params.get("limit", 8),
            ))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelDeliveryClaimsTypesView(APIView):
    """
    GET /api/analytics/parcel-delivery/claims-types/

    Params: start_date, end_date, delivery_type
    Returns: [{sinistre_type, nbr_sinistres}] for the pie chart.
    Source: dim_remboursement → dim_parcel (via colis_tracking) → dim_sinistre_type.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, dt = _pd_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(pdq.get_claims_types(start, end, dt))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


# ─── On-Demand Transport analytics ───────────────────────────────────────────
#
# All views accept:
#   start_date   (required) — YYYY-MM-DD
#   end_date     (required) — YYYY-MM-DD
#   service_type (optional) — 'course_dediee' | 'courrier' | 'manutention'
#
# Endpoints are mounted at /api/analytics/transport-analytics/...


def _ta_filters(request):
    return (
        request.query_params.get("start_date"),
        request.query_params.get("end_date"),
        request.query_params.get("service_type"),
    )


class TransportOpsKpisView(APIView):
    """
    GET /api/analytics/transport-analytics/ops-kpis/

    Returns: nbr_requests, completion_rate_pct, cancellation_rate_pct,
             avg_distance_km, avg_stops + pop_* period-over-period deltas.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_ops_kpis(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportMonthlyTrendView(APIView):
    """
    GET /api/analytics/transport-analytics/monthly-trend/

    Returns: [{period, nbr_requests, nbr_terminees, nbr_en_cours, nbr_annulees}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_monthly_trend(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportServiceBreakdownView(APIView):
    """
    GET /api/analytics/transport-analytics/service-breakdown/

    Returns: [{service_type, nbr_requests, completion_rate_pct}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_service_breakdown(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportODMatrixView(APIView):
    """
    GET /api/analytics/transport-analytics/od-matrix/

    Returns: [{origin, destination, nbr_requests}] — wilaya-level flow (≤500 pairs).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_od_matrix(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportDistanceCategoryView(APIView):
    """
    GET /api/analytics/transport-analytics/distance-category/

    Returns: [{distance_category, km_range, nbr_requests}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_distance_category(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportCostKpisView(APIView):
    """
    GET /api/analytics/transport-analytics/cost-kpis/

    Returns: total_revenue, total_cost, marge_brute_dzd, marge_brute_pct,
             cout_par_km + pop_* deltas.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_cost_kpis(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportRevCostTrendView(APIView):
    """
    GET /api/analytics/transport-analytics/rev-cost-trend/

    Returns: [{period, total_revenue, total_cost, marge_brute_dzd, marge_brute_pct}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_rev_cost_trend(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportCostCategoriesView(APIView):
    """
    GET /api/analytics/transport-analytics/cost-categories/

    Returns: [{category, label, total_dzd}] — 8 cost components.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_cost_categories(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportCostPerKmView(APIView):
    """
    GET /api/analytics/transport-analytics/cost-per-km/

    Returns: [{vehicle_type, total_cost, total_km, cout_par_km, nbr_requests}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_cost_per_km(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportTopCorridorsView(APIView):
    """
    GET /api/analytics/transport-analytics/top-corridors/

    Params: + limit (default 8)
    Returns: [{corridor, nbr_requests, total_revenue, taux_marge_pct}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_top_corridors(
                start, end, st,
                limit=request.query_params.get("limit", 8),
            ))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportPerfKpisView(APIView):
    """
    GET /api/analytics/transport-analytics/perf-kpis/

    Returns: on_time_rate_pct, avg_duration_h, avg_client_rating,
             avg_arrival_delay_min, night_shift_rate_pct + pop_* deltas.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_perf_kpis(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportOnTimeTrendView(APIView):
    """
    GET /api/analytics/transport-analytics/on-time-trend/

    Returns: [{period, on_time_rate_pct, avg_duration_h}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_on_time_trend(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportDelayBucketsView(APIView):
    """
    GET /api/analytics/transport-analytics/delay-buckets/

    Returns: [{bucket, bucket_order, nbr_requests}] — 5-bucket histogram.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_delay_buckets(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportRatingBucketsView(APIView):
    """
    GET /api/analytics/transport-analytics/rating-buckets/

    Returns: [{rating, nbr_requests}] — ratings 1–5.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_rating_buckets(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class TransportVehiclePerfView(APIView):
    """
    GET /api/analytics/transport-analytics/vehicle-perf/

    Returns: [{vehicle_type, nbr_requests, on_time_rate_pct, avg_duration_h}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end, st = _ta_filters(request)
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=400)
        try:
            return Response(tq.get_vehicle_perf(start, end, st))
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


# ─── Overview analytics ───────────────────────────────────────────────────────
#
# No filter parameters — always current calendar month vs previous month.
# Endpoints are mounted at /api/analytics/overview/...


class OverviewKpisView(APIView):
    """
    GET /api/analytics/overview/kpis/

    Returns 5 KPIs covering both On-demand Transport and Parcel Delivery,
    with period-over-period % deltas (current calendar month vs previous).
    Also returns transport_revenue and parcel_revenue for the revenue-split donut.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            return Response(ovq.get_kpis())
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class OverviewActivityTrendView(APIView):
    """
    GET /api/analytics/overview/activity-trend/

    Returns [{period, transport_requests, parcel_handled}] for the last 6 months.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            return Response(ovq.get_activity_trend())
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)
