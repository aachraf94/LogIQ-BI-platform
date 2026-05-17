from django.urls import path

from .views import (
    AlertAcknowledgeView,
    AlertListView,
    AlertRuleDetailView,
    AlertRuleListCreateView,
    NotificationCountView,
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
    NotificationStreamView,
)

urlpatterns = [
    # --- Notifications ---
    path("", NotificationListView.as_view(), name="notification-list"),
    path("count/", NotificationCountView.as_view(), name="notification-count"),
    path("<int:pk>/read/", NotificationMarkReadView.as_view(), name="notification-read"),
    path("read-all/", NotificationMarkAllReadView.as_view(), name="notification-read-all"),

    # --- SSE stream ---
    path("stream/", NotificationStreamView.as_view(), name="notification-stream"),

    # --- Alert rules ---
    path("rules/", AlertRuleListCreateView.as_view(), name="alert-rule-list"),
    path("rules/<int:pk>/", AlertRuleDetailView.as_view(), name="alert-rule-detail"),

    # --- Alerts ---
    path("alerts/", AlertListView.as_view(), name="alert-list"),
    path("alerts/<int:pk>/acknowledge/", AlertAcknowledgeView.as_view(), name="alert-acknowledge"),
]
