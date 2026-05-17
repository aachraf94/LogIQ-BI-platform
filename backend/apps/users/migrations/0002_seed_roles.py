"""
Data migration: seed the 5 default operational roles.
These are system roles (is_system=True) and cannot be deleted via admin.
"""

from django.db import migrations

ROLES = [
    {
        "name": "direction_generale",
        "display_name": "Direction Générale",
        "description": "Accès complet à tous les tableaux de bord. Vue stratégique 360°.",
        "dashboards": ["overview", "transport", "parcels", "routes"],
        "color": "#7c3aed",
        "is_system": True,
    },
    {
        "name": "responsable_transport",
        "display_name": "Responsable Transport",
        "description": "Accès aux tableaux Vue d'ensemble et Transport. Suivi des demandes, coûts et performances transport.",
        "dashboards": ["overview", "transport"],
        "color": "#0ea5e9",
        "is_system": True,
    },
    {
        "name": "responsable_colis",
        "display_name": "Responsable Colis & PCC",
        "description": "Accès aux tableaux Vue d'ensemble et Colis & Contrôle des Coûts. Suivi des écarts tarifaires.",
        "dashboards": ["overview", "parcels"],
        "color": "#10b981",
        "is_system": True,
    },
    {
        "name": "responsable_tournees",
        "display_name": "Responsable Tournées",
        "description": "Accès aux tableaux Vue d'ensemble et Tournées. Suivi des itinéraires et optimisation des routes.",
        "dashboards": ["overview", "routes"],
        "color": "#f59e0b",
        "is_system": True,
    },
    {
        "name": "analyste",
        "display_name": "Analyste BI",
        "description": "Accès en lecture à tous les tableaux de bord. Pas d'accès à la configuration des alertes.",
        "dashboards": ["overview", "transport", "parcels", "routes"],
        "color": "#6366f1",
        "is_system": True,
    },
]


def seed_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    for data in ROLES:
        Role.objects.get_or_create(name=data["name"], defaults=data)


def unseed_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    Role.objects.filter(name__in=[r["name"] for r in ROLES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_roles, reverse_code=unseed_roles),
    ]
