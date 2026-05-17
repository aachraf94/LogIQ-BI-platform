from django.urls import path

from .views import (
    ActivityTrackView,
    AdminActivitySummaryView,
    AdminRoleCreateView,
    AdminRoleDetailView,
    AdminRoleListView,
    AdminUserActivateView,
    AdminUserDetailView,
    AdminUserForceLogoutView,
    AdminUserListView,
    AdminUserRoleAssignView,
    AdminUserSessionsView,
    AdminUserStatsView,
    AnnouncementAdminView,
    AnnouncementDetailView,
    AnnouncementListView,
    BookmarkDetailView,
    BookmarkListCreateView,
    LoginView,
    LogoutView,
    MeView,
    MyActivityView,
    OnboardingCompleteView,
    PreferencesView,
    SessionListView,
    TokenRefreshView,
)

urlpatterns = [
    # ── Auth ──────────────────────────────────────────────────────────────
    path("auth/login/",   LoginView.as_view(),        name="login"),
    path("auth/logout/",  LogoutView.as_view(),        name="logout"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),

    # ── Current user ──────────────────────────────────────────────────────
    path("me/",                        MeView.as_view(),              name="me"),
    path("me/onboarding/complete/",    OnboardingCompleteView.as_view(), name="onboarding-complete"),
    path("me/preferences/",            PreferencesView.as_view(),     name="preferences"),
    path("me/sessions/",               SessionListView.as_view(),     name="sessions"),
    path("me/bookmarks/",              BookmarkListCreateView.as_view(), name="bookmark-list"),
    path("me/bookmarks/<int:pk>/",     BookmarkDetailView.as_view(),  name="bookmark-detail"),
    path("me/activity/",               MyActivityView.as_view(),      name="my-activity"),

    # ── Activity (write) ──────────────────────────────────────────────────
    path("activity/track/", ActivityTrackView.as_view(), name="activity-track"),

    # ── Announcements ─────────────────────────────────────────────────────
    path("announcements/",                AnnouncementListView.as_view(),   name="announcement-list"),
    path("announcements/manage/",         AnnouncementAdminView.as_view(),  name="announcement-create"),
    path("announcements/manage/<int:pk>/", AnnouncementDetailView.as_view(), name="announcement-detail"),

    # ── Admin — user management ───────────────────────────────────────────
    path("admin/users/",                       AdminUserListView.as_view(),      name="admin-user-list"),
    path("admin/users/stats/",                 AdminUserStatsView.as_view(),     name="admin-user-stats"),
    path("admin/users/activate/",              AdminUserActivateView.as_view(),  name="admin-user-activate"),
    path("admin/users/assign-role/",           AdminUserRoleAssignView.as_view(), name="admin-user-role"),
    path("admin/users/<uuid:pk>/",             AdminUserDetailView.as_view(),    name="admin-user-detail"),
    path("admin/users/<uuid:pk>/sessions/",    AdminUserSessionsView.as_view(),  name="admin-user-sessions"),
    path("admin/users/<uuid:pk>/force-logout/", AdminUserForceLogoutView.as_view(), name="admin-user-force-logout"),

    # ── Admin — roles ─────────────────────────────────────────────────────
    path("admin/roles/",          AdminRoleListView.as_view(),   name="admin-role-list"),
    path("admin/roles/create/",   AdminRoleCreateView.as_view(), name="admin-role-create"),
    path("admin/roles/<int:pk>/", AdminRoleDetailView.as_view(), name="admin-role-detail"),

    # ── Admin — activity ──────────────────────────────────────────────────
    path("admin/activity/", AdminActivitySummaryView.as_view(), name="admin-activity"),
]
