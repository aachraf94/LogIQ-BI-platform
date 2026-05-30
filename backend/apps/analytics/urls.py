from django.urls import path

from . import views

urlpatterns = [
    # Overview (no filter — current month vs previous month)
    path("overview/kpis/",           views.OverviewKpisView.as_view(),          name="overview-kpis"),
    path("overview/activity-trend/", views.OverviewActivityTrendView.as_view(), name="overview-activity-trend"),

    # On-Demand Transport analytics (date-range based — Operations / Cost & Profitability / Performance)
    path("transport-analytics/ops-kpis/",          views.TransportOpsKpisView.as_view(),          name="transport-ops-kpis"),
    path("transport-analytics/monthly-trend/",     views.TransportMonthlyTrendView.as_view(),     name="transport-monthly-trend"),
    path("transport-analytics/service-breakdown/", views.TransportServiceBreakdownView.as_view(), name="transport-service-breakdown"),
    path("transport-analytics/od-matrix/",         views.TransportODMatrixView.as_view(),         name="transport-od-matrix"),
    path("transport-analytics/distance-category/", views.TransportDistanceCategoryView.as_view(), name="transport-distance-category"),
    path("transport-analytics/cost-kpis/",         views.TransportCostKpisView.as_view(),         name="transport-cost-kpis"),
    path("transport-analytics/rev-cost-trend/",    views.TransportRevCostTrendView.as_view(),     name="transport-rev-cost-trend"),
    path("transport-analytics/cost-categories/",   views.TransportCostCategoriesView.as_view(),   name="transport-cost-categories"),
    path("transport-analytics/cost-per-km/",       views.TransportCostPerKmView.as_view(),        name="transport-cost-per-km"),
    path("transport-analytics/top-corridors/",     views.TransportTopCorridorsView.as_view(),     name="transport-top-corridors"),
    path("transport-analytics/perf-kpis/",         views.TransportPerfKpisView.as_view(),         name="transport-perf-kpis"),
    path("transport-analytics/on-time-trend/",     views.TransportOnTimeTrendView.as_view(),      name="transport-on-time-trend"),
    path("transport-analytics/delay-buckets/",     views.TransportDelayBucketsView.as_view(),     name="transport-delay-buckets"),
    path("transport-analytics/rating-buckets/",    views.TransportRatingBucketsView.as_view(),    name="transport-rating-buckets"),
    path("transport-analytics/vehicle-perf/",      views.TransportVehiclePerfView.as_view(),      name="transport-vehicle-perf"),

    # Parcel Delivery analytics (date-range based — Operations / Cost & Profitability / Performance)
    path("parcel-delivery/ops-kpis/",                  views.ParcelDeliveryOpsKpisView.as_view(),                  name="parcel-delivery-ops-kpis"),
    path("parcel-delivery/ops-trend/",                 views.ParcelDeliveryOpsTrendView.as_view(),                 name="parcel-delivery-ops-trend"),
    path("parcel-delivery/status-breakdown/",          views.ParcelDeliveryStatusBreakdownView.as_view(),          name="parcel-delivery-status-breakdown"),
    path("parcel-delivery/region-flow/",               views.ParcelDeliveryRegionFlowView.as_view(),               name="parcel-delivery-region-flow"),
    path("parcel-delivery/zone-breakdown/",            views.ParcelDeliveryZoneBreakdownView.as_view(),            name="parcel-delivery-zone-breakdown"),
    path("parcel-delivery/cost-kpis/",                 views.ParcelDeliveryCostKpisView.as_view(),                 name="parcel-delivery-cost-kpis"),
    path("parcel-delivery/revenue-cost-trend/",        views.ParcelDeliveryRevenueCostTrendView.as_view(),         name="parcel-delivery-revenue-cost-trend"),
    path("parcel-delivery/cost-by-nature/",            views.ParcelDeliveryCostByNatureView.as_view(),             name="parcel-delivery-cost-by-nature"),
    path("parcel-delivery/region-profit/",             views.ParcelDeliveryRegionProfitView.as_view(),             name="parcel-delivery-region-profit"),
    path("parcel-delivery/zone-profit/",               views.ParcelDeliveryZoneProfitView.as_view(),               name="parcel-delivery-zone-profit"),
    path("parcel-delivery/perf-kpis/",                 views.ParcelDeliveryPerfKpisView.as_view(),                 name="parcel-delivery-perf-kpis"),
    path("parcel-delivery/perf-trend/",                views.ParcelDeliveryPerfTrendView.as_view(),                name="parcel-delivery-perf-trend"),
    path("parcel-delivery/duration-distribution/",     views.ParcelDeliveryDurationDistributionView.as_view(),     name="parcel-delivery-duration-distribution"),
    path("parcel-delivery/center-expedition-ranking/", views.ParcelDeliveryCenterExpeditionRankingView.as_view(),  name="parcel-delivery-center-expedition-ranking"),
    path("parcel-delivery/claims-types/",              views.ParcelDeliveryClaimsTypesView.as_view(),              name="parcel-delivery-claims-types"),
]
