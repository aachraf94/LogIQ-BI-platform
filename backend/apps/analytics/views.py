"""
Analytics API views — read-only endpoints querying the data warehouse.

All views require JWT authentication. Queries run against the warehouse
PostgreSQL database via the LogiqDBRouter / direct connections['warehouse'].
"""

import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .queries import parcel_delivery as pdq

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
