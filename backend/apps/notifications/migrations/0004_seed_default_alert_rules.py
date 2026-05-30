"""
Seed default alert rules covering the main KPIs from both
Parcel Delivery and On-demand Transport dashboards.
These rules have is_default=True so the frontend can show them
as system-provided baselines that users can subscribe/unsubscribe from.
"""
from django.db import migrations


DEFAULT_RULES = [
    # ── Parcel Delivery ────────────────────────────────────────────────────
    {
        "name": "Taux de livraison critique",
        "description": "Alerte critique quand le taux de livraison mensuel passe sous 70 %.",
        "metric": "taux_livraison_pct",
        "operator": "lt",
        "threshold": 70.0,
        "severity": "critical",
        "dashboard": "parcels",
        "cooldown_minutes": 120,
    },
    {
        "name": "Taux de livraison faible",
        "description": "Avertissement quand le taux de livraison mensuel passe sous 85 %.",
        "metric": "taux_livraison_pct",
        "operator": "lt",
        "threshold": 85.0,
        "severity": "warning",
        "dashboard": "parcels",
        "cooldown_minutes": 60,
    },
    {
        "name": "Écart tarifaire élevé (PCC)",
        "description": "Avertissement quand l'écart tarifaire moyen mensuel dépasse 15 %.",
        "metric": "ecart_tarif_pct",
        "operator": "gt",
        "threshold": 15.0,
        "severity": "warning",
        "dashboard": "parcels",
        "cooldown_minutes": 60,
    },
    {
        "name": "Colis sous-tarif nombreux",
        "description": "Avertissement quand le nombre de colis sous-tarif mensuel dépasse 100.",
        "metric": "nbr_sous_tarif",
        "operator": "gt",
        "threshold": 100.0,
        "severity": "warning",
        "dashboard": "parcels",
        "cooldown_minutes": 60,
    },
    {
        "name": "Volume de livraisons journalier faible",
        "description": "Information quand le nombre de livraisons du jour est inférieur à 50.",
        "metric": "nbr_livraisons_jour",
        "operator": "lt",
        "threshold": 50.0,
        "severity": "info",
        "dashboard": "parcels",
        "cooldown_minutes": 240,
    },
    # ── Transport ──────────────────────────────────────────────────────────
    {
        "name": "Marge brute transport critique",
        "description": "Alerte critique quand la marge brute transport mensuelle passe sous 5 %.",
        "metric": "marge_brute_transport_pct",
        "operator": "lt",
        "threshold": 5.0,
        "severity": "critical",
        "dashboard": "transport",
        "cooldown_minutes": 120,
    },
    {
        "name": "Marge brute transport faible",
        "description": "Avertissement quand la marge brute transport mensuelle passe sous 15 %.",
        "metric": "marge_brute_transport_pct",
        "operator": "lt",
        "threshold": 15.0,
        "severity": "warning",
        "dashboard": "transport",
        "cooldown_minutes": 60,
    },
    {
        "name": "Coût transport mensuel élevé",
        "description": "Avertissement quand le coût transport mensuel total dépasse 5 000 000 DZD.",
        "metric": "transport_cost_dzd",
        "operator": "gt",
        "threshold": 5_000_000.0,
        "severity": "warning",
        "dashboard": "transport",
        "cooldown_minutes": 60,
    },
]


def seed_default_rules(apps, schema_editor):
    AlertRule = apps.get_model("notifications", "AlertRule")
    for rule_data in DEFAULT_RULES:
        AlertRule.objects.get_or_create(
            name=rule_data["name"],
            defaults={**rule_data, "is_default": True, "is_active": True},
        )


def remove_default_rules(apps, schema_editor):
    AlertRule = apps.get_model("notifications", "AlertRule")
    AlertRule.objects.filter(is_default=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0003_alertrule_is_default_useralertrulepreference'),
    ]

    operations = [
        migrations.RunPython(seed_default_rules, reverse_code=remove_default_rules),
    ]
