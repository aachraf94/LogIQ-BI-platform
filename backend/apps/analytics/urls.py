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
]
