"""
Analytics API views — read-only endpoints querying the data warehouse.

All views require JWT authentication. Queries run against the warehouse
PostgreSQL database via the LogiqDBRouter / direct connections['warehouse'].
"""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .queries import transport as tq


# ─── Transport ────────────────────────────────────────────────────────────────

class TransportSummaryView(APIView):
    """
    GET /api/analytics/transport/summary/

    Params: year, month, service_type, company_id
    Returns: KPI cards for the selected period with MoM deltas.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = tq.get_summary(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                service_type=request.query_params.get("service_type"),
                company_id=request.query_params.get("company_id"),
            )
            return Response(data)
        except Exception as exc:
            return Response({"error": str(exc)}, status=503)


class TransportTrendsView(APIView):
    """
    GET /api/analytics/transport/trends/

    Params: service_type, company_id, from_year_month (YYYY-MM), to_year_month
    Returns: Monthly time-series for volume, revenue, cost, margin, on-time rate.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = tq.get_trends(
                service_type=request.query_params.get("service_type"),
                company_id=request.query_params.get("company_id"),
                from_year_month=request.query_params.get("from_year_month"),
                to_year_month=request.query_params.get("to_year_month"),
            )
            return Response(data)
        except Exception as exc:
            return Response({"error": str(exc)}, status=503)


class TransportCostBreakdownView(APIView):
    """
    GET /api/analytics/transport/cost-breakdown/

    Params: year, month, service_type
    Returns: DZD amounts for each cost component (base, distance, insurance,
             fuel, handling, autres) for the selected period.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = tq.get_cost_breakdown(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                service_type=request.query_params.get("service_type"),
            )
            return Response(data)
        except Exception as exc:
            return Response({"error": str(exc)}, status=503)


class TransportByServiceView(APIView):
    """
    GET /api/analytics/transport/by-service/

    Params: year, month
    Returns: Volume, revenue, margin, and performance per service type
             (course_dediee, courrier, manutention) and sub-type.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = tq.get_by_service(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
            )
            return Response(data)
        except Exception as exc:
            return Response({"error": str(exc)}, status=503)


class TransportByVehicleView(APIView):
    """
    GET /api/analytics/transport/by-vehicle/

    Params: year, month
    Returns: Cost efficiency (DZD/km) and performance per vehicle type.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = tq.get_by_vehicle(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
            )
            return Response(data)
        except Exception as exc:
            return Response({"error": str(exc)}, status=503)


class TransportCorridorsView(APIView):
    """
    GET /api/analytics/transport/corridors/

    Params: year, month, service_type, client_type,
            limit (default 15), sort_by (nbr_requests|total_revenue|taux_marge_pct|avg_distance_km)
    Returns: Top OD corridors with cost, margin, and distance KPIs.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = tq.get_corridors(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                service_type=request.query_params.get("service_type"),
                client_type=request.query_params.get("client_type"),
                limit=request.query_params.get("limit", 15),
                sort_by=request.query_params.get("sort_by", "nbr_requests"),
            )
            return Response(data)
        except Exception as exc:
            return Response({"error": str(exc)}, status=503)


class TransportODMatrixView(APIView):
    """
    GET /api/analytics/transport/od-matrix/

    Params: year, month
    Returns: Region-level origin × destination matrix (Nord / Hauts Plateaux / Sud).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = tq.get_od_matrix(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
            )
            return Response(data)
        except Exception as exc:
            return Response({"error": str(exc)}, status=503)


class TransportByAgencyView(APIView):
    """
    GET /api/analytics/transport/by-agency/

    Params: year, month, region, service_type
    Returns: Agency performance ranking (completion rate, on-time, margin, cost/km).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = tq.get_by_agency(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                region=request.query_params.get("region"),
                service_type=request.query_params.get("service_type"),
            )
            return Response(data)
        except Exception as exc:
            return Response({"error": str(exc)}, status=503)


class TransportDelayDistributionView(APIView):
    """
    GET /api/analytics/transport/delay-distribution/

    Params: year, month, service_type
    Returns: Arrival-delay histogram in 5 bands (À l'heure, 1-15, 16-30, 31-60, >60 min).
    Source: warehouse.fact_transport (raw fact table — not pre-aggregated).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = tq.get_delay_distribution(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                service_type=request.query_params.get("service_type"),
            )
            return Response(data)
        except Exception as exc:
            return Response({"error": str(exc)}, status=503)
