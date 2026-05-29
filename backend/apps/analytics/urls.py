from django.urls import path

from . import views

urlpatterns = [
    # On-Demand Transport analytics
    


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
