"""
Analytics API views — read-only endpoints querying the data warehouse.

All views require JWT authentication. Queries run against the warehouse
PostgreSQL database via the LogiqDBRouter / direct connections['warehouse'].
"""

import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .queries import transport as tq
from .queries import parcel_costs as pq

logger = logging.getLogger(__name__)


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
            logger.exception("Analytics query failed: %s", exc)
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
            logger.exception("Analytics query failed: %s", exc)
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
            logger.exception("Analytics query failed: %s", exc)
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
            logger.exception("Analytics query failed: %s", exc)
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
                service_type=request.query_params.get("service_type"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
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
            logger.exception("Analytics query failed: %s", exc)
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
            logger.exception("Analytics query failed: %s", exc)
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
            logger.exception("Analytics query failed: %s", exc)
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
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


# ─── Parcel costs ─────────────────────────────────────────────────────────────

class ParcelCostsSummaryView(APIView):
    """
    GET /api/analytics/parcel-costs/summary/

    Params: year, month, company_id, agence_id, delivery_type
    Returns: KPI cards (volume, delivery rate, revenue, PCC compliance, cost per parcel)
             with MoM deltas.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = pq.get_summary(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                company_id=request.query_params.get("company_id"),
                agence_id=request.query_params.get("agence_id"),
                delivery_type=request.query_params.get("delivery_type"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsTrendsView(APIView):
    """
    GET /api/analytics/parcel-costs/trends/

    Params: from_year_month (YYYY-MM), to_year_month, company_id, agence_id,
            delivery_type
    Returns: Monthly time-series combining delivery performance, PCC compliance,
             and total operational cost per parcel.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = pq.get_trends(
                from_year_month=request.query_params.get("from_year_month"),
                to_year_month=request.query_params.get("to_year_month"),
                company_id=request.query_params.get("company_id"),
                agence_id=request.query_params.get("agence_id"),
                delivery_type=request.query_params.get("delivery_type"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsPCCSummaryView(APIView):
    """
    GET /api/analytics/parcel-costs/pcc-summary/

    Params: year, month, company_id, agence_id, delivery_type
    Returns: Detailed PCC metrics — nbr_sous_tarif, total_ecart_dzd, avg_ecart_dzd,
             taux_sous_tarif_pct, taux_ecart_global_pct.
    Source: warehouse.agg_profitabilite_colis
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = pq.get_pcc_summary(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                company_id=request.query_params.get("company_id"),
                agence_id=request.query_params.get("agence_id"),
                delivery_type=request.query_params.get("delivery_type"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsPCCByAgencyView(APIView):
    """
    GET /api/analytics/parcel-costs/pcc-by-agency/

    Params: year, month, region, delivery_type,
            sort_by (nbr_sous_tarif|taux_sous_tarif_pct|total_ecart_dzd|nbr_colis_total),
            limit (default 20)
    Returns: Agency PCC compliance ranking.
    Source: warehouse.agg_profitabilite_colis
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = pq.get_pcc_by_agency(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                region=request.query_params.get("region"),
                delivery_type=request.query_params.get("delivery_type"),
                sort_by=request.query_params.get("sort_by", "nbr_sous_tarif"),
                limit=request.query_params.get("limit", 20),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsEcartDistributionView(APIView):
    """
    GET /api/analytics/parcel-costs/ecart-distribution/

    Params: year (required), month (required), agence_id (optional)
    Returns: Ecart tarif histogram in 6 bands (< -500 DZD → > +100 DZD).
    Source: warehouse.fact_livraisons — year and month are mandatory.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year  = request.query_params.get("year")
        month = request.query_params.get("month")
        if not year or not month:
            return Response(
                {"error": "year and month are required for this endpoint"},
                status=400,
            )
        try:
            data = pq.get_ecart_distribution(
                year=year,
                month=month,
                agence_id=request.query_params.get("agence_id"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsPCCByWilayaView(APIView):
    """
    GET /api/analytics/parcel-costs/pcc-by-wilaya/

    Params: year (required), month (required), agence_id (optional)
    Returns: Under-pricing rate and ecart by destination wilaya (max 58 wilayas).
    Source: warehouse.fact_livraisons — year and month are mandatory.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year  = request.query_params.get("year")
        month = request.query_params.get("month")
        if not year or not month:
            return Response(
                {"error": "year and month are required for this endpoint"},
                status=400,
            )
        try:
            data = pq.get_pcc_by_wilaya(
                year=year,
                month=month,
                agence_id=request.query_params.get("agence_id"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsCostStructureView(APIView):
    """
    GET /api/analytics/parcel-costs/cost-structure/

    Params: year, month, company_id, agence_id
    Returns: Cost breakdown — depenses, salaires, freelance, sinistres, cout_total.
    Sources: warehouse.agg_cout_total_mensuel + warehouse.fact_remboursements
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = pq.get_cost_structure(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                company_id=request.query_params.get("company_id"),
                agence_id=request.query_params.get("agence_id"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsCostByNatureView(APIView):
    """
    GET /api/analytics/parcel-costs/cost-by-nature/

    Params: year, month, agence_id
    Returns: Operational expense breakdown by category and nature, sorted by DZD.
    Source: warehouse.agg_depenses_mensuelles
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = pq.get_cost_by_nature(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                agence_id=request.query_params.get("agence_id"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsByAgencyView(APIView):
    """
    GET /api/analytics/parcel-costs/by-agency/

    Params: year, month, region, delivery_type
    Returns: Agency scorecard joining performance + PCC + cost aggregates.
             Powers the quadrant scatter (taux_livraison vs taux_sous_tarif)
             and the sortable agency table.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = pq.get_by_agency(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                region=request.query_params.get("region"),
                delivery_type=request.query_params.get("delivery_type"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsByDeliveryTypeView(APIView):
    """
    GET /api/analytics/parcel-costs/by-delivery-type/

    Params: year, month, agence_id
    Returns: HD vs SD comparison — volume, delivery rate, avg fee, avg duration.
    Source: warehouse.agg_performance_livraison grouped by delivery_type.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = pq.get_by_delivery_type(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                agence_id=request.query_params.get("agence_id"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsDailyVolumeView(APIView):
    """
    GET /api/analytics/parcel-costs/daily-volume/

    Params: year, month, agence_id
    Returns: Daily delivery series for calendar heatmap
             (nbr_colis, nbr_livres, taux_livraison_pct, day_of_week flags).
    Source: warehouse.agg_livraisons_journalieres
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = pq.get_daily_volume(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                agence_id=request.query_params.get("agence_id"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsDurationDistributionView(APIView):
    """
    GET /api/analytics/parcel-costs/duration-distribution/

    Params: year (required), month (required), agence_id (optional),
            delivery_type (HD|SD)
    Returns: Delivery duration histogram for successfully delivered parcels
             in 6 bands (< 1h → > 5 jours).
    Source: warehouse.fact_livraisons — year and month are mandatory.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year  = request.query_params.get("year")
        month = request.query_params.get("month")
        if not year or not month:
            return Response(
                {"error": "year and month are required for this endpoint"},
                status=400,
            )
        try:
            data = pq.get_duration_distribution(
                year=year,
                month=month,
                agence_id=request.query_params.get("agence_id"),
                delivery_type=request.query_params.get("delivery_type"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsSinistresView(APIView):
    """
    GET /api/analytics/parcel-costs/sinistres/

    Params: year, month, agence_id
    Returns: { summary, by_type, by_agency } — reimbursement claims analysis.
    Source: warehouse.fact_remboursements (small table, direct query).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = pq.get_sinistres(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                agence_id=request.query_params.get("agence_id"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsFreelanceEfficiencyView(APIView):
    """
    GET /api/analytics/parcel-costs/freelance-efficiency/

    Params: year, month, agence_id
    Returns: Per-agency freelance driver cost efficiency
             (total_paiements, nbr_colis_livres, cout_par_colis, taux_succes).
    Source: warehouse.fact_paiements_livreurs (small table, direct query).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = pq.get_freelance_efficiency(
                year=request.query_params.get("year"),
                month=request.query_params.get("month"),
                agence_id=request.query_params.get("agence_id"),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)


class ParcelCostsParcelsView(APIView):
    """
    GET /api/analytics/parcel-costs/parcels/

    Params: year (required), month (required), agence_id, delivery_type (HD|SD),
            ecart_direction (sous-tarif|sur-tarif|au-tarif|all),
            sort_by (ecart_tarif_dzd|delivery_fee|duree_livraison_minutes|
                     nbr_evenements|date_creation),
            page (default 1), page_size (default 25, max 100)
    Returns: { results, count, page, pages } — paginated parcel drill-down table.
    Source: warehouse.fact_livraisons — year and month are mandatory.
    Default sort: ecart_tarif_dzd ASC NULLS LAST (worst under-billing first).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year  = request.query_params.get("year")
        month = request.query_params.get("month")
        if not year or not month:
            return Response(
                {"error": "year and month are required for this endpoint"},
                status=400,
            )
        try:
            data = pq.get_parcels(
                year=year,
                month=month,
                agence_id=request.query_params.get("agence_id"),
                delivery_type=request.query_params.get("delivery_type"),
                ecart_direction=request.query_params.get("ecart_direction"),
                sort_by=request.query_params.get("sort_by", "ecart_tarif_dzd"),
                page=request.query_params.get("page", 1),
                page_size=request.query_params.get("page_size", 25),
            )
            return Response(data)
        except Exception as exc:
            logger.exception("Analytics query failed: %s", exc)
            return Response({"error": str(exc)}, status=503)
