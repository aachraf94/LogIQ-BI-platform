from django.urls import path

from .views import (
    DataFreshnessView,
    ETLRunListView,
    ETLWebhookView,
    HealthView,
    PlatformStatsView,
)

urlpatterns = [
    # Health
    path("health/", HealthView.as_view(), name="health"),
    path("health/stats/", PlatformStatsView.as_view(), name="platform-stats"),

    # ETL
    path("etl/webhook/", ETLWebhookView.as_view(), name="etl-webhook"),
    path("etl/runs/", ETLRunListView.as_view(), name="etl-run-list"),
    path("etl/freshness/", DataFreshnessView.as_view(), name="data-freshness"),
]
