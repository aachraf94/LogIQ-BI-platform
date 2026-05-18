import os

import requests as http_requests
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Announcement, DashboardBookmark, LoginSession, Role, User, UserActivity
from .permissions import IsSuperAdmin
from .serializers import (
    AdminActivitySummarySerializer,
    AdminUserEditSerializer,
    AnnouncementSerializer,
    AnnouncementWriteSerializer,
    DashboardBookmarkSerializer,
    RoleWriteSerializer,
    UserActivitySerializer,
    UserActivityWriteSerializer,
    UserStatsSerializer,
    LoginSerializer,
    LoginSessionSerializer,
    RoleSerializer,
    UserActivateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserPreferencesSerializer,
    UserRoleAssignSerializer,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_user_agent(ua_string: str) -> dict:
    """Return {browser, os, device_type} from a User-Agent header."""
    try:
        import user_agents
        ua = user_agents.parse(ua_string)
        device_type = "mobile" if ua.is_mobile else ("tablet" if ua.is_tablet else "pc")
        return {
            "browser": ua.browser.family or "",
            "os": ua.os.family or "",
            "device_type": device_type,
        }
    except Exception:
        return {"browser": "", "os": "", "device_type": ""}


def _get_client_ip(request) -> str | None:
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

@extend_schema(tags=["auth"])
class LoginView(APIView):
    """
    Authenticate with HRForce credentials.
    Returns a JWT access token (60 min) and a refresh token (7 days)
    alongside the full user profile.
    """
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer  # used by spectacular for request body

    @extend_schema(
        request=LoginSerializer,
        responses={
            200: OpenApiResponse(description="Authentification réussie — tokens + profil utilisateur"),
            400: OpenApiResponse(description="Identifiants invalides ou compte inactif"),
        },
        examples=[
            OpenApiExample(
                "Exemple requête",
                value={"username": "a.benali", "password": "••••••"},
                request_only=True,
            )
        ],
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        refresh = RefreshToken.for_user(user)
        access = refresh.access_token

        # Record login session
        ua_info = _parse_user_agent(request.META.get("HTTP_USER_AGENT", ""))
        LoginSession.objects.create(
            user=user,
            ip_address=_get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            jti=str(access.get("jti", "")),
            **ua_info,
        )

        # First-login onboarding flag
        is_first_login = not user.has_completed_onboarding

        return Response({
            "access": str(access),
            "refresh": str(refresh),
            "is_first_login": is_first_login,
            "user": UserDetailSerializer(user, context={"request": request}).data,
        })


@extend_schema(tags=["auth"])
class LogoutView(APIView):
    """
    Invalidate the refresh token and close the current session.
    Pass the refresh token in the request body.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request={"application/json": {"type": "object", "properties": {"refresh": {"type": "string"}}}},
        responses={204: OpenApiResponse(description="Déconnexion réussie")},
    )
    def post(self, request):
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                jti = str(token.get("jti", ""))
                token.blacklist()
                # Close the matching login session
                LoginSession.objects.filter(
                    user=request.user, jti=jti, is_active=True
                ).update(logged_out_at=timezone.now(), is_active=False)
            except TokenError:
                pass  # already blacklisted or invalid — still return 204
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["auth"])
class TokenRefreshView(APIView):
    """
    Obtain a new access token using a valid refresh token.
    Because ROTATE_REFRESH_TOKENS=True, a new refresh token is also returned.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        request={"application/json": {"type": "object", "properties": {"refresh": {"type": "string"}}}},
        responses={200: OpenApiResponse(description="Nouveaux tokens access + refresh")},
    )
    def post(self, request):
        from rest_framework_simplejwt.views import TokenRefreshView as _BaseRefresh
        return _BaseRefresh.as_view()(request._request)


# ---------------------------------------------------------------------------
# Current user — profile, preferences, sessions
# ---------------------------------------------------------------------------

@extend_schema(tags=["profile"])
class MeView(APIView):
    """Return the full profile of the currently authenticated user."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UserDetailSerializer})
    def get(self, request):
        # Ensure preferences row exists
        request.user.get_preferences()
        return Response(UserDetailSerializer(request.user, context={"request": request}).data)


@extend_schema(tags=["profile"])
class OnboardingCompleteView(APIView):
    """
    Mark the current user's onboarding as complete.
    Call this once the user has finished the first-login walkthrough.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiResponse(description="Onboarding marqué comme complété")})
    def post(self, request):
        if not request.user.has_completed_onboarding:
            request.user.has_completed_onboarding = True
            request.user.save(update_fields=["has_completed_onboarding"])
        return Response({"detail": "Onboarding complété."})


@extend_schema(tags=["preferences"])
class PreferencesView(APIView):
    """
    Retrieve or update the current user's UI and notification preferences.
    Only fields included in the request body are updated (partial update).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UserPreferencesSerializer})
    def get(self, request):
        prefs = request.user.get_preferences()
        return Response(UserPreferencesSerializer(prefs).data)

    @extend_schema(
        request=UserPreferencesSerializer,
        responses={200: UserPreferencesSerializer},
    )
    def patch(self, request):
        prefs = request.user.get_preferences()
        serializer = UserPreferencesSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@extend_schema(tags=["profile"])
class SessionListView(APIView):
    """
    List the current user's recent login sessions (last 10).
    Useful for security audit — shows device, browser, IP, and duration.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: LoginSessionSerializer(many=True)})
    def get(self, request):
        sessions = request.user.login_sessions.all()[:10]
        return Response(LoginSessionSerializer(sessions, many=True).data)


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------

@extend_schema(tags=["announcements"])
class AnnouncementListView(APIView):
    """
    Return active announcements visible to the current user's role.
    Expired announcements are automatically excluded.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: AnnouncementSerializer(many=True)})
    def get(self, request):
        now = timezone.now()
        qs = Announcement.objects.filter(is_active=True).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        )
        visible = [a for a in qs if a.is_visible_to(request.user)]
        return Response(AnnouncementSerializer(visible, many=True).data)


@extend_schema(tags=["announcements"])
class AnnouncementAdminView(APIView):
    """Create a new announcement (superadmin only)."""
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        request=AnnouncementWriteSerializer,
        responses={201: AnnouncementSerializer},
    )
    def post(self, request):
        serializer = AnnouncementWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        announcement = serializer.save(created_by=request.user)
        return Response(AnnouncementSerializer(announcement).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["announcements"])
class AnnouncementDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a single announcement (superadmin only)."""
    permission_classes = [IsSuperAdmin]
    queryset = Announcement.objects.all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return AnnouncementWriteSerializer
        return AnnouncementSerializer


# ---------------------------------------------------------------------------
# Admin — user management (superadmin only)
# ---------------------------------------------------------------------------

@extend_schema(tags=["admin-users"])
class AdminUserListView(generics.ListAPIView):
    """
    List all users with their role and activation status.
    Supports search by username / email / first name / last name.
    """
    permission_classes = [IsSuperAdmin]
    serializer_class = UserListSerializer
    search_fields = ["username", "email", "first_name", "last_name", "agence_name"]
    filterset_fields = ["is_active", "role", "company_id"]
    ordering_fields = ["date_joined", "last_login", "last_name"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        return User.objects.select_related("role").all()


@extend_schema(tags=["admin-users"])
class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update a single user.
    GET returns the full profile; PATCH allows editing role, activation status,
    contact info and organisation fields.
    Passwords are managed by HRForce — not editable here.
    """
    permission_classes = [IsSuperAdmin]
    queryset = User.objects.select_related("role", "preferences").all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return AdminUserEditSerializer
        return UserDetailSerializer

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = AdminUserEditSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        instance.refresh_from_db()
        return Response(UserDetailSerializer(instance, context={"request": request}).data)


@extend_schema(tags=["admin-users"])
class AdminUserActivateView(APIView):
    """
    Bulk activate or deactivate users.
    Pass a list of UUIDs and the desired `is_active` state.
    """
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        request=UserActivateSerializer,
        responses={200: OpenApiResponse(description="Résultat de l'opération")},
    )
    def post(self, request):
        serializer = UserActivateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = User.objects.filter(
            id__in=serializer.validated_data["user_ids"]
        ).update(is_active=serializer.validated_data["is_active"])
        action = "activés" if serializer.validated_data["is_active"] else "désactivés"
        return Response({"detail": f"{updated} utilisateur(s) {action}."})


@extend_schema(tags=["admin-users"])
class AdminUserRoleAssignView(APIView):
    """
    Assign (or remove) a role from one or more users.
    Set `role_id` to `null` to unassign the current role.
    """
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        request=UserRoleAssignSerializer,
        responses={200: OpenApiResponse(description="Résultat de l'assignation")},
    )
    def post(self, request):
        serializer = UserRoleAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role_id = serializer.validated_data["role_id"]
        # Validate role exists if not null
        if role_id is not None:
            try:
                Role.objects.get(pk=role_id)
            except Role.DoesNotExist:
                return Response({"detail": "Rôle introuvable."}, status=status.HTTP_400_BAD_REQUEST)
        updated = User.objects.filter(
            id__in=serializer.validated_data["user_ids"]
        ).update(role_id=role_id)
        return Response({"detail": f"Rôle mis à jour pour {updated} utilisateur(s)."})


@extend_schema(tags=["admin-users"])
class AdminRoleListView(generics.ListAPIView):
    """List all available roles with their dashboard permissions and user counts."""
    permission_classes = [IsSuperAdmin]
    serializer_class = RoleSerializer
    queryset = Role.objects.prefetch_related("users").all()


@extend_schema(tags=["admin-users"])
class AdminRoleCreateView(APIView):
    """Create a custom role (non-system roles only — system roles are seeded via migration)."""
    permission_classes = [IsSuperAdmin]

    @extend_schema(request=RoleWriteSerializer, responses={201: RoleSerializer})
    def post(self, request):
        serializer = RoleWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.save(is_system=False)
        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["admin-users"])
class AdminRoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a role.
    System roles (is_system=True) cannot be deleted via API.
    """
    permission_classes = [IsSuperAdmin]
    queryset = Role.objects.prefetch_related("users").all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return RoleWriteSerializer
        return RoleSerializer

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response(
                {"detail": "Les rôles système ne peuvent pas être supprimés."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Unassign the role from all users before deleting
        role.users.update(role=None)
        role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["admin-users"])
class AdminUserSyncView(APIView):
    """
    Trigger an immediate HRForce → platform user sync.
    Mirrors the logic of the sync_hrforce_users management command.
    New users are created with is_active=False; existing profiles are updated.
    Role and is_active are never overwritten on existing users.
    """
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        responses={200: OpenApiResponse(description="Sync summary: created / updated / skipped / errors")},
    )
    def post(self, request):
        base_url = os.environ.get("API_BASE_URL", "http://localhost:8001")
        token = os.environ.get("HRFORCE_API_TOKEN", "")
        if not token:
            return Response({"detail": "HRFORCE_API_TOKEN not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        EXCLUDED = {9}
        LIMIT = 100

        # HRForce /hrforce/users/ uses 'limit' param and returns {"items": [...]}
        all_users = []
        page = 1
        try:
            while True:
                resp = http_requests.get(
                    f"{base_url}/hrforce/users/",
                    headers=headers,
                    params={"page": page, "limit": LIMIT},
                    timeout=30,
                )
                resp.raise_for_status()
                data = resp.json()
                # Response is {"items": [...]}
                items = data.get("items", []) if isinstance(data, dict) else data
                if not items:
                    break
                all_users.extend(items)
                if len(items) < LIMIT:
                    break
                page += 1
        except Exception as exc:
            return Response(
                {"detail": f"Cannot reach HRForce API: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        created = updated = skipped = errors = 0

        for u in all_users:
            # HRForce nests company/agency/occupation as objects
            company = u.get("company") or {}
            agency = u.get("agency") or {}
            occupation = u.get("occupation") or {}

            company_id = company.get("id")
            if company_id in EXCLUDED:
                skipped += 1
                continue

            hrforce_id = u.get("id")
            if not hrforce_id:
                skipped += 1
                continue

            email = u.get("email", "")
            # Build a collision-proof username: prefix_hrforceid (e.g. "a.benali_1042")
            # Plain email prefixes collide across companies; the hrforce_id suffix makes it unique.
            email_prefix = email.split("@")[0] if email else ""
            username = f"{email_prefix}_{hrforce_id}" if email_prefix else f"user_{hrforce_id}"

            raw_pw = u.get("password", "")
            if raw_pw and not raw_pw.startswith("bcrypt$"):
                django_pw = f"bcrypt${raw_pw}" if raw_pw.startswith(("$2b$", "$2a$", "$2y$")) else "!"
            else:
                django_pw = raw_pw or "!"

            # Fields synced from HRForce — never overwrites is_active or role on existing users
            profile = {
                "first_name": (u.get("firstName") or "").strip(),
                "last_name": (u.get("familyName") or "").strip(),
                "email": email,
                "hrforce_code": u.get("code") or "",
                "hrforce_role": u.get("role") or "",
                "occupation": occupation.get("name") or "",
                "agence_id": agency.get("id"),
                "agence_name": agency.get("name") or "",
                "agence_code": agency.get("code") or "",
                "company_id": company_id,
                "company_name": company.get("companyName") or "",
            }

            try:
                existing = User.objects.filter(hrforce_id=hrforce_id).first()
                if existing is None:
                    user = User(
                        hrforce_id=hrforce_id,
                        username=username,
                        is_active=False,  # admin must activate
                        **profile,
                    )
                    user.password = django_pw
                    user.save()
                    created += 1
                else:
                    changed = any(getattr(existing, f) != v for f, v in profile.items())
                    # Migrate username to the collision-proof format on existing users
                    if existing.username != username:
                        existing.username = username
                        changed = True
                    if django_pw != "!" and existing.password != django_pw:
                        existing.password = django_pw
                        changed = True
                    if changed:
                        for f, v in profile.items():
                            setattr(existing, f, v)
                        existing.save()
                        updated += 1
                    else:
                        skipped += 1
            except Exception:
                errors += 1

        return Response({
            "total_fetched": len(all_users),
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "errors": errors,
        })


@extend_schema(tags=["admin-users"])
class AdminUserStatsView(APIView):
    """
    Aggregated user statistics for the admin dashboard.
    Returns totals, active/inactive counts, breakdown by role,
    users never logged in, and new users this month.
    """
    permission_classes = [IsSuperAdmin]

    @extend_schema(responses={200: UserStatsSerializer})
    def get(self, request):
        from datetime import timedelta

        from django.db.models import Count

        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        by_role = list(
            User.objects.filter(is_active=True, role__isnull=False)
            .values("role__name", "role__display_name", "role__color")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        by_role_formatted = [
            {
                "role_name": r["role__name"],
                "display_name": r["role__display_name"],
                "color": r["role__color"],
                "count": r["count"],
            }
            for r in by_role
        ]

        return Response({
            "total": User.objects.count(),
            "active": User.objects.filter(is_active=True).count(),
            "inactive": User.objects.filter(is_active=False).count(),
            "superadmins": User.objects.filter(is_superuser=True).count(),
            "without_role": User.objects.filter(is_active=True, role__isnull=True, is_superuser=False).count(),
            "by_role": by_role_formatted,
            "new_this_month": User.objects.filter(date_joined__gte=month_start).count(),
            "never_logged_in": User.objects.filter(is_active=True, last_login__isnull=True).count(),
        })


@extend_schema(tags=["admin-users"])
class AdminUserSessionsView(APIView):
    """
    View all login sessions for a specific user (superadmin only).
    Useful for auditing suspicious activity.
    """
    permission_classes = [IsSuperAdmin]

    @extend_schema(responses={200: LoginSessionSerializer(many=True)})
    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)
        sessions = user.login_sessions.all()[:20]
        return Response(LoginSessionSerializer(sessions, many=True).data)


@extend_schema(tags=["admin-users"])
class AdminUserForceLogoutView(APIView):
    """
    Terminate all active sessions for a user and blacklist their refresh tokens.
    Use when a compromised account needs to be immediately locked out.
    """
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        responses={200: OpenApiResponse(description="Sessions terminées")},
    )
    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)

        terminated = user.login_sessions.filter(is_active=True).update(
            logged_out_at=timezone.now(), is_active=False
        )
        # Blacklist all outstanding refresh tokens for this user via simplejwt
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
            tokens = OutstandingToken.objects.filter(user=user)
            for t in tokens:
                try:
                    t.blacklistedtoken  # already blacklisted
                except Exception:
                    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
                    BlacklistedToken.objects.get_or_create(token=t)
        except Exception:
            pass  # token_blacklist table may not exist yet

        return Response({
            "detail": f"{terminated} session(s) terminée(s) pour {user.username}.",
            "sessions_terminated": terminated,
        })


# ---------------------------------------------------------------------------
# Dashboard Bookmarks
# ---------------------------------------------------------------------------

@extend_schema(tags=["bookmarks"])
class BookmarkListCreateView(generics.ListCreateAPIView):
    """
    List the current user's bookmarks plus shared bookmarks from role members.
    Create a new bookmark for any dashboard the user can access.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = DashboardBookmarkSerializer

    def get_queryset(self):
        user = self.request.user
        # Own bookmarks
        own = Q(user=user)
        # Shared bookmarks from role peers who have access to the same dashboards
        shared = Q(is_shared=True, dashboard__in=user.accessible_dashboards)
        return (
            DashboardBookmark.objects.select_related("user")
            .filter(own | shared)
            .distinct()
            .order_by("-updated_at")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@extend_schema(tags=["bookmarks"])
class BookmarkDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a bookmark.
    Only the owner can modify or delete their bookmark.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = DashboardBookmarkSerializer

    def get_queryset(self):
        user = self.request.user
        return DashboardBookmark.objects.filter(
            Q(user=user) | Q(is_shared=True, dashboard__in=user.accessible_dashboards)
        ).select_related("user")

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in ("GET", "HEAD", "OPTIONS") and obj.user != request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Vous ne pouvez modifier que vos propres signets.")


# ---------------------------------------------------------------------------
# User Activity Tracking
# ---------------------------------------------------------------------------

@extend_schema(tags=["activity"])
class ActivityTrackView(APIView):
    """
    Record a dashboard visit or user action.
    Call this from the frontend on each page view or significant interaction.
    Lightweight — bulk-inserts, no response body beyond confirmation.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=UserActivityWriteSerializer,
        responses={201: OpenApiResponse(description="Activité enregistrée")},
    )
    def post(self, request):
        serializer = UserActivityWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        UserActivity.objects.create(
            user=request.user,
            **serializer.validated_data,
        )
        return Response(status=status.HTTP_201_CREATED)


@extend_schema(tags=["activity"])
class MyActivityView(generics.ListAPIView):
    """List the current user's recent activity (last 50 events)."""
    permission_classes = [IsAuthenticated]
    serializer_class = UserActivitySerializer

    def get_queryset(self):
        return self.request.user.activities.all()[:50]


@extend_schema(tags=["activity"])
class AdminActivitySummaryView(APIView):
    """
    Per-dashboard activity summary for the superadmin stats panel.
    Shows visits and unique users for today and the current week.
    """
    permission_classes = [IsSuperAdmin]

    @extend_schema(responses={200: AdminActivitySummarySerializer(many=True)})
    def get(self, request):
        from datetime import timedelta

        from django.db.models import Count

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=now.weekday())

        dashboards = ["overview", "transport", "parcels", "routes"]
        result = []
        for dash in dashboards:
            today_qs = UserActivity.objects.filter(
                dashboard=dash, action="view", created_at__gte=today_start
            )
            week_qs = UserActivity.objects.filter(
                dashboard=dash, action="view", created_at__gte=week_start
            )
            result.append({
                "dashboard": dash,
                "visits_today": today_qs.count(),
                "visits_this_week": week_qs.count(),
                "unique_users_today": today_qs.values("user").distinct().count(),
            })

        return Response(result)
