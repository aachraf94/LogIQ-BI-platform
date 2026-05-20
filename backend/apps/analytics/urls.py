from django.urls import path

from . import views

urlpatterns = [
    # Transport analytics
    path("transport/summary/",          views.TransportSummaryView.as_view(),          name="transport-summary"),
    path("transport/trends/",           views.TransportTrendsView.as_view(),           name="transport-trends"),
    path("transport/cost-breakdown/",   views.TransportCostBreakdownView.as_view(),    name="transport-cost-breakdown"),
    path("transport/by-service/",       views.TransportByServiceView.as_view(),        name="transport-by-service"),
    path("transport/by-vehicle/",       views.TransportByVehicleView.as_view(),        name="transport-by-vehicle"),
    path("transport/corridors/",        views.TransportCorridorsView.as_view(),        name="transport-corridors"),
    path("transport/od-matrix/",        views.TransportODMatrixView.as_view(),         name="transport-od-matrix"),
    path("transport/by-agency/",        views.TransportByAgencyView.as_view(),         name="transport-by-agency"),
    path("transport/delay-distribution/", views.TransportDelayDistributionView.as_view(), name="transport-delay-distribution"),

    # Parcel costs analytics
    path("parcel-costs/summary/",              views.ParcelCostsSummaryView.as_view(),             name="parcel-costs-summary"),
    path("parcel-costs/trends/",               views.ParcelCostsTrendsView.as_view(),              name="parcel-costs-trends"),
    path("parcel-costs/pcc-summary/",          views.ParcelCostsPCCSummaryView.as_view(),          name="parcel-costs-pcc-summary"),
    path("parcel-costs/pcc-by-agency/",        views.ParcelCostsPCCByAgencyView.as_view(),         name="parcel-costs-pcc-by-agency"),
    path("parcel-costs/ecart-distribution/",   views.ParcelCostsEcartDistributionView.as_view(),   name="parcel-costs-ecart-distribution"),
    path("parcel-costs/pcc-by-wilaya/",        views.ParcelCostsPCCByWilayaView.as_view(),         name="parcel-costs-pcc-by-wilaya"),
    path("parcel-costs/cost-structure/",       views.ParcelCostsCostStructureView.as_view(),       name="parcel-costs-cost-structure"),
    path("parcel-costs/cost-by-nature/",       views.ParcelCostsCostByNatureView.as_view(),        name="parcel-costs-cost-by-nature"),
    path("parcel-costs/by-agency/",            views.ParcelCostsByAgencyView.as_view(),            name="parcel-costs-by-agency"),
    path("parcel-costs/by-delivery-type/",     views.ParcelCostsByDeliveryTypeView.as_view(),      name="parcel-costs-by-delivery-type"),
    path("parcel-costs/daily-volume/",         views.ParcelCostsDailyVolumeView.as_view(),         name="parcel-costs-daily-volume"),
    path("parcel-costs/duration-distribution/", views.ParcelCostsDurationDistributionView.as_view(), name="parcel-costs-duration-distribution"),
    path("parcel-costs/sinistres/",            views.ParcelCostsSinistresView.as_view(),           name="parcel-costs-sinistres"),
    path("parcel-costs/freelance-efficiency/", views.ParcelCostsFreelanceEfficiencyView.as_view(), name="parcel-costs-freelance-efficiency"),
    path("parcel-costs/parcels/",              views.ParcelCostsParcelsView.as_view(),             name="parcel-costs-parcels"),
]
