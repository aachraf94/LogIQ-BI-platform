"""Root URL configuration."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("apps.users.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/analytics/", include("apps.analytics.urls")),
    path("api/integrations/", include("apps.integrations.urls")),
]
