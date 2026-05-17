from rest_framework.permissions import BasePermission, IsAuthenticated


class IsSuperAdmin(BasePermission):
    """Only Django superusers."""
    message = "Accès réservé aux super-administrateurs."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class HasDashboardAccess(BasePermission):
    """
    View-level permission. Set `dashboard_key` on the view class.
    Superusers pass unconditionally.
    """
    message = "Vous n'avez pas accès à ce tableau de bord."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        key = getattr(view, "dashboard_key", None)
        if not key:
            return True
        return request.user.can_access_dashboard(key)


class CanAccessOverview(BasePermission):
    message = "Accès au tableau de bord Vue d'ensemble refusé."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.can_access_dashboard("overview")


class CanAccessTransport(BasePermission):
    message = "Accès au tableau de bord Transport refusé."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.can_access_dashboard("transport")


class CanAccessParcels(BasePermission):
    message = "Accès au tableau de bord Colis & PCC refusé."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.can_access_dashboard("parcels")


class CanAccessRoutes(BasePermission):
    message = "Accès au tableau de bord Tournées refusé."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.can_access_dashboard("routes")
