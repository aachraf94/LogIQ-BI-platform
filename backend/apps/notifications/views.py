import json
import time

from django.http import HttpResponse, StreamingHttpResponse
from django.utils import timezone
from django.views import View
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.users.permissions import IsSuperAdmin

from .models import Alert, AlertRule, Notification, UserAlertRulePreference
from .serializers import (
    AlertAcknowledgeSerializer,
    AlertRuleSerializer,
    AlertRuleWithPreferenceSerializer,
    AlertRuleWriteSerializer,
    AlertSerializer,
    NotificationCountSerializer,
    NotificationSerializer,
    UserAlertRulePreferenceSerializer,
)


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

@extend_schema(tags=["notifications"])
class NotificationListView(generics.ListAPIView):
    """
    List the current user's notifications, newest first.
    Filter by `unread=true` to get only unread notifications.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        qs = self.request.user.notifications.all()
        if self.request.query_params.get("unread") == "true":
            qs = qs.filter(is_read=False)
        return qs

    @extend_schema(
        parameters=[
            OpenApiParameter("unread", bool, description="Filter to unread notifications only"),
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


@extend_schema(tags=["notifications"])
class NotificationCountView(APIView):
    """Return total and unread notification counts for the current user."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: NotificationCountSerializer})
    def get(self, request):
        qs = request.user.notifications
        return Response({
            "total": qs.count(),
            "unread": qs.filter(is_read=False).count(),
        })


@extend_schema(tags=["notifications"])
class NotificationMarkReadView(APIView):
    """Mark a single notification as read."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: NotificationSerializer})
    def post(self, request, pk):
        try:
            notif = request.user.notifications.get(pk=pk)
        except Notification.DoesNotExist:
            return Response({"detail": "Notification introuvable."}, status=status.HTTP_404_NOT_FOUND)
        notif.mark_read()
        return Response(NotificationSerializer(notif).data)


@extend_schema(tags=["notifications"])
class NotificationMarkAllReadView(APIView):
    """Mark all of the current user's unread notifications as read at once."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiResponse(description="Nombre de notifications marquées comme lues")})
    def post(self, request):
        updated = request.user.notifications.filter(is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({"marked_read": updated})


# ---------------------------------------------------------------------------
# Alert Rules (admin only)
# ---------------------------------------------------------------------------

@extend_schema(tags=["alert-rules"])
class AlertRuleListCreateView(generics.ListCreateAPIView):
    """
    List all alert rules or create a new one.
    Only superadmins can create rules; authenticated users with dashboard access can view them.
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AlertRuleWriteSerializer
        return AlertRuleSerializer

    def get_queryset(self):
        qs = AlertRule.objects.select_related("created_by").all()
        if not self.request.user.is_superuser:
            # Non-admins only see rules for their accessible dashboards
            qs = qs.filter(dashboard__in=self.request.user.accessible_dashboards)
        return qs

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsSuperAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


@extend_schema(tags=["alert-rules"])
class AlertRuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete an alert rule (superadmin only for write operations)."""
    queryset = AlertRule.objects.select_related("created_by").all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return AlertRuleWriteSerializer
        return AlertRuleSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsSuperAdmin()]
        return [IsAuthenticated()]


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@extend_schema(tags=["alerts"])
class AlertListView(generics.ListAPIView):
    """
    List triggered alerts visible to the current user (filtered by their accessible dashboards).
    Filter by `unacknowledged=true` to see only pending alerts.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AlertSerializer

    def get_queryset(self):
        qs = Alert.objects.select_related("rule", "acknowledged_by").filter(
            rule__dashboard__in=self.request.user.accessible_dashboards
        )
        if self.request.query_params.get("unacknowledged") == "true":
            qs = qs.filter(is_acknowledged=False)
        return qs

    @extend_schema(
        parameters=[
            OpenApiParameter("unacknowledged", bool, description="Return only unacknowledged alerts"),
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


@extend_schema(tags=["alerts"])
class AlertAcknowledgeView(APIView):
    """
    Acknowledge an alert, optionally leaving a note.
    Only users with access to the alert's dashboard can acknowledge it.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=AlertAcknowledgeSerializer,
        responses={200: AlertSerializer},
    )
    def post(self, request, pk):
        try:
            alert = Alert.objects.select_related("rule").get(pk=pk)
        except Alert.DoesNotExist:
            return Response({"detail": "Alerte introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.can_access_dashboard(alert.rule.dashboard):
            return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)

        if alert.is_acknowledged:
            return Response({"detail": "Alerte déjà acquittée."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AlertAcknowledgeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        alert.acknowledge(user=request.user, note=serializer.validated_data.get("note", ""))
        return Response(AlertSerializer(alert).data)


# ---------------------------------------------------------------------------
# Server-Sent Events — real-time notification push
# ---------------------------------------------------------------------------

def _sse_event(event_type: str, data: dict) -> str:
    """Format a single SSE message."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def _notification_stream(user):
    """
    Generator that streams new notifications and unread counts to the client.
    Sends a heartbeat comment every 20 s to keep the connection alive through proxies.
    Polls the database every 3 s — lightweight for a BI platform with few concurrent users.
    """
    # Baseline: don't replay notifications that existed before the stream opened
    last_id = (
        Notification.objects.filter(user=user)
        .values_list("id", flat=True)
        .order_by("-id")
        .first()
        or 0
    )
    heartbeat_counter = 0

    # Send initial unread count so the client has a starting state immediately
    unread = Notification.objects.filter(user=user, is_read=False).count()
    yield _sse_event("count", {"unread": unread})

    while True:
        time.sleep(3)
        heartbeat_counter += 1

        # Push any new notifications since last_id
        new_notifs = (
            Notification.objects.filter(user=user, id__gt=last_id)
            .order_by("id")
        )
        for notif in new_notifs:
            yield _sse_event("notification", NotificationSerializer(notif).data)
            last_id = notif.id

        # Always push updated unread count so badges stay in sync
        if new_notifs.exists():
            unread = Notification.objects.filter(user=user, is_read=False).count()
            yield _sse_event("count", {"unread": unread})

        # Heartbeat every 20 s (every ~7 poll cycles)
        if heartbeat_counter % 7 == 0:
            yield ": heartbeat\n\n"


class NotificationStreamView(View):
    """
    Server-Sent Events endpoint for real-time notification delivery.
    Plain Django View — bypasses DRF content negotiation which rejects text/event-stream.

    Auth: JWT access token passed as ?token= query param (EventSource cannot set headers).
    """

    def get(self, request):
        token_str = request.GET.get("token", "")
        if not token_str:
            return HttpResponse("Unauthorized", status=401)

        try:
            auth = JWTAuthentication()
            validated_token = auth.get_validated_token(token_str)
            user = auth.get_user(validated_token)
        except Exception:
            return HttpResponse("Unauthorized", status=401)

        if not user or not user.is_active:
            return HttpResponse("Forbidden", status=403)

        response = StreamingHttpResponse(
            _notification_stream(user),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


# ---------------------------------------------------------------------------
# User Alert Rule Preferences
# ---------------------------------------------------------------------------

@extend_schema(tags=["alert-preferences"])
class UserAlertRuleListView(generics.ListAPIView):
    """
    List all AlertRules visible to the current user, annotated with their
    personal subscription status (is_subscribed).
    Superadmins see all rules; regular users see only rules for their dashboards.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AlertRuleWithPreferenceSerializer

    def get_queryset(self):
        qs = AlertRule.objects.select_related("created_by").all()
        if not self.request.user.is_superuser:
            qs = qs.filter(dashboard__in=self.request.user.accessible_dashboards)
        return qs


@extend_schema(tags=["alert-preferences"])
class UserAlertRuleSubscribeView(APIView):
    """
    Set the current user's subscription preference for a specific AlertRule.
    POST with { "is_subscribed": true/false }
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=UserAlertRulePreferenceSerializer,
        responses={200: UserAlertRulePreferenceSerializer},
    )
    def post(self, request, rule_pk):
        try:
            rule = AlertRule.objects.get(pk=rule_pk)
        except AlertRule.DoesNotExist:
            return Response({"detail": "Règle introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.is_superuser and not request.user.can_access_dashboard(rule.dashboard):
            return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)

        is_subscribed = bool(request.data.get("is_subscribed", True))
        pref, _ = UserAlertRulePreference.objects.update_or_create(
            user=request.user,
            rule=rule,
            defaults={"is_subscribed": is_subscribed},
        )
        return Response(UserAlertRulePreferenceSerializer(pref).data)
