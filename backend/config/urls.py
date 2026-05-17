"""Root URL configuration."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

# Admin cosmetics
admin.site.site_header = "LOGIQ — Administration"
admin.site.site_title = "LOGIQ Admin"
admin.site.index_title = "Tableau de bord administrateur"

urlpatterns = [
    path("admin/", admin.site.urls),

    # OpenAPI schema + UI
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    # App routes
    path("api/users/", include("apps.users.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/analytics/", include("apps.analytics.urls")),
    path("api/integrations/", include("apps.integrations.urls")),
]
