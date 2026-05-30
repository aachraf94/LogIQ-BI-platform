"""
Replace the 8 old generic default alert rules with 30 new ones —
one per KPI across both On-Demand Transport and Parcel Delivery dashboards.
Thresholds are set to sensible operational defaults based on domain knowledge.
"""
from django.db import migrations


NEW_DEFAULT_RULES = [
    # ── Parcel Delivery — Operations ──────────────────────────────────────────
    {
        "name": "Colis traités — volume faible",
        "description": "Volume hebdomadaire de colis traités inférieur à 500.",
        "dashboard": "parcels", "kpi_category": "operations",
        "metric": "pd_ops_total_parcels", "operator": "lt", "threshold": 500.0,
        "severity": "info", "cooldown_minutes": 10080,
    },
    {
        "name": "Colis livrés — volume faible",
        "description": "Nombre de colis livrés dans la semaine inférieur à 300.",
        "dashboard": "parcels", "kpi_category": "operations",
        "metric": "pd_ops_delivered", "operator": "lt", "threshold": 300.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Retours — volume élevé",
        "description": "Nombre de retours hebdomadaires supérieur à 80.",
        "dashboard": "parcels", "kpi_category": "operations",
        "metric": "pd_ops_returns", "operator": "gt", "threshold": 80.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Colis en transit — accumulation",
        "description": "Plus de 200 colis en transit en fin de semaine.",
        "dashboard": "parcels", "kpi_category": "operations",
        "metric": "pd_ops_in_transit", "operator": "gt", "threshold": 200.0,
        "severity": "info", "cooldown_minutes": 10080,
    },
    {
        "name": "Durée moy. livraison — trop longue",
        "description": "Durée moyenne de livraison supérieure à 72 heures (3 jours).",
        "dashboard": "parcels", "kpi_category": "operations",
        "metric": "pd_ops_avg_duration", "operator": "gt", "threshold": 72.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },

    # ── Parcel Delivery — Cost & Profitability ────────────────────────────────
    {
        "name": "Frais collectés — revenus faibles",
        "description": "Frais collectés sur la semaine inférieurs à 500 000 DZD.",
        "dashboard": "parcels", "kpi_category": "cost_profitability",
        "metric": "pd_cost_fees_collected", "operator": "lt", "threshold": 500_000.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Coût opérationnel — élevé",
        "description": "Coût opérationnel hebdomadaire supérieur à 600 000 DZD.",
        "dashboard": "parcels", "kpi_category": "cost_profitability",
        "metric": "pd_cost_total_cost", "operator": "gt", "threshold": 600_000.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Marge brute livraison — critique",
        "description": "Marge brute hebdomadaire inférieure à 5 %.",
        "dashboard": "parcels", "kpi_category": "cost_profitability",
        "metric": "pd_cost_gross_margin", "operator": "lt", "threshold": 5.0,
        "severity": "critical", "cooldown_minutes": 10080,
    },
    {
        "name": "Marge brute livraison — faible",
        "description": "Marge brute hebdomadaire inférieure à 15 %.",
        "dashboard": "parcels", "kpi_category": "cost_profitability",
        "metric": "pd_cost_gross_margin", "operator": "lt", "threshold": 15.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Frais moy. / colis — bas",
        "description": "Frais moyens par colis livré inférieurs à 400 DZD.",
        "dashboard": "parcels", "kpi_category": "cost_profitability",
        "metric": "pd_cost_avg_fee", "operator": "lt", "threshold": 400.0,
        "severity": "info", "cooldown_minutes": 10080,
    },
    {
        "name": "Coût / colis livré — élevé",
        "description": "Coût moyen par colis livré supérieur à 500 DZD.",
        "dashboard": "parcels", "kpi_category": "cost_profitability",
        "metric": "pd_cost_per_delivery", "operator": "gt", "threshold": 500.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },

    # ── Parcel Delivery — Performance ─────────────────────────────────────────
    {
        "name": "Taux de livraison — critique",
        "description": "Taux de livraison hebdomadaire inférieur à 70 %.",
        "dashboard": "parcels", "kpi_category": "performance",
        "metric": "pd_perf_delivery_rate", "operator": "lt", "threshold": 70.0,
        "severity": "critical", "cooldown_minutes": 10080,
    },
    {
        "name": "Taux de livraison — faible",
        "description": "Taux de livraison hebdomadaire inférieur à 83 %.",
        "dashboard": "parcels", "kpi_category": "performance",
        "metric": "pd_perf_delivery_rate", "operator": "lt", "threshold": 83.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Tentatives moy. — trop élevées",
        "description": "Nombre moyen de tentatives supérieur à 2,5 par colis.",
        "dashboard": "parcels", "kpi_category": "performance",
        "metric": "pd_perf_avg_attempts", "operator": "gt", "threshold": 2.5,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Succès 1ère tentative — faible",
        "description": "Taux de succès à la première tentative inférieur à 60 %.",
        "dashboard": "parcels", "kpi_category": "performance",
        "metric": "pd_perf_first_attempt_rate", "operator": "lt", "threshold": 60.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Durée moy. livraison (perf) — longue",
        "description": "Durée moyenne de livraison supérieure à 72 heures.",
        "dashboard": "parcels", "kpi_category": "performance",
        "metric": "pd_perf_avg_duration", "operator": "gt", "threshold": 72.0,
        "severity": "info", "cooldown_minutes": 10080,
    },
    {
        "name": "Sinistres — volume élevé",
        "description": "Plus de 10 dossiers de sinistres ouverts dans la semaine.",
        "dashboard": "parcels", "kpi_category": "performance",
        "metric": "pd_perf_claims_count", "operator": "gt", "threshold": 10.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },

    # ── Transport — Operations ────────────────────────────────────────────────
    {
        "name": "Demandes transport — volume faible",
        "description": "Moins de 30 demandes de transport sur la semaine.",
        "dashboard": "transport", "kpi_category": "operations",
        "metric": "tr_ops_total_requests", "operator": "lt", "threshold": 30.0,
        "severity": "info", "cooldown_minutes": 10080,
    },
    {
        "name": "Taux de complétion — faible",
        "description": "Taux de complétion hebdomadaire inférieur à 75 %.",
        "dashboard": "transport", "kpi_category": "operations",
        "metric": "tr_ops_completion_rate", "operator": "lt", "threshold": 75.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Taux d'annulation — élevé",
        "description": "Taux d'annulation hebdomadaire supérieur à 15 %.",
        "dashboard": "transport", "kpi_category": "operations",
        "metric": "tr_ops_cancellation_rate", "operator": "gt", "threshold": 15.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Distance moy. — anormalement basse",
        "description": "Distance moyenne par trajet inférieure à 20 km.",
        "dashboard": "transport", "kpi_category": "operations",
        "metric": "tr_ops_avg_distance", "operator": "lt", "threshold": 20.0,
        "severity": "info", "cooldown_minutes": 10080,
    },
    {
        "name": "Arrêts moy. / demande — élevés",
        "description": "Nombre moyen d'arrêts par demande supérieur à 5.",
        "dashboard": "transport", "kpi_category": "operations",
        "metric": "tr_ops_avg_stops", "operator": "gt", "threshold": 5.0,
        "severity": "info", "cooldown_minutes": 10080,
    },

    # ── Transport — Cost & Profitability ──────────────────────────────────────
    {
        "name": "Revenu transport — faible",
        "description": "Revenu transport hebdomadaire inférieur à 200 000 DZD.",
        "dashboard": "transport", "kpi_category": "cost_profitability",
        "metric": "tr_cost_total_revenue", "operator": "lt", "threshold": 200_000.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Coût transport — élevé",
        "description": "Coût total transport hebdomadaire supérieur à 300 000 DZD.",
        "dashboard": "transport", "kpi_category": "cost_profitability",
        "metric": "tr_cost_total_cost", "operator": "gt", "threshold": 300_000.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Marge brute transport — négative",
        "description": "Marge brute transport hebdomadaire négative (perte nette).",
        "dashboard": "transport", "kpi_category": "cost_profitability",
        "metric": "tr_cost_gross_margin", "operator": "lt", "threshold": 0.0,
        "severity": "critical", "cooldown_minutes": 10080,
    },
    {
        "name": "Marge transport (%) — critique",
        "description": "Marge transport hebdomadaire inférieure à 5 %.",
        "dashboard": "transport", "kpi_category": "cost_profitability",
        "metric": "tr_cost_margin_pct", "operator": "lt", "threshold": 5.0,
        "severity": "critical", "cooldown_minutes": 10080,
    },
    {
        "name": "Marge transport (%) — faible",
        "description": "Marge transport hebdomadaire inférieure à 15 %.",
        "dashboard": "transport", "kpi_category": "cost_profitability",
        "metric": "tr_cost_margin_pct", "operator": "lt", "threshold": 15.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Coût / km — élevé",
        "description": "Coût par kilomètre supérieur à 50 DZD/km.",
        "dashboard": "transport", "kpi_category": "cost_profitability",
        "metric": "tr_cost_per_km", "operator": "gt", "threshold": 50.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },

    # ── Transport — Performance ───────────────────────────────────────────────
    {
        "name": "Ponctualité — critique",
        "description": "Taux de ponctualité hebdomadaire inférieur à 70 %.",
        "dashboard": "transport", "kpi_category": "performance",
        "metric": "tr_perf_on_time_rate", "operator": "lt", "threshold": 70.0,
        "severity": "critical", "cooldown_minutes": 10080,
    },
    {
        "name": "Ponctualité — faible",
        "description": "Taux de ponctualité hebdomadaire inférieur à 85 %.",
        "dashboard": "transport", "kpi_category": "performance",
        "metric": "tr_perf_on_time_rate", "operator": "lt", "threshold": 85.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Durée moy. transport — longue",
        "description": "Durée moyenne des trajets supérieure à 8 heures.",
        "dashboard": "transport", "kpi_category": "performance",
        "metric": "tr_perf_avg_duration", "operator": "gt", "threshold": 8.0,
        "severity": "info", "cooldown_minutes": 10080,
    },
    {
        "name": "Note client — basse",
        "description": "Note client moyenne inférieure à 3,0 / 5.",
        "dashboard": "transport", "kpi_category": "performance",
        "metric": "tr_perf_avg_rating", "operator": "lt", "threshold": 3.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Retard arrivée — élevé",
        "description": "Retard moyen à l'arrivée supérieur à 45 minutes.",
        "dashboard": "transport", "kpi_category": "performance",
        "metric": "tr_perf_avg_delay", "operator": "gt", "threshold": 45.0,
        "severity": "warning", "cooldown_minutes": 10080,
    },
    {
        "name": "Taux de nuit — élevé",
        "description": "Plus de 30 % des trajets effectués de nuit.",
        "dashboard": "transport", "kpi_category": "performance",
        "metric": "tr_perf_night_shift_rate", "operator": "gt", "threshold": 30.0,
        "severity": "info", "cooldown_minutes": 10080,
    },
]


def reseed_rules(apps, schema_editor):
    AlertRule = apps.get_model("notifications", "AlertRule")
    # Delete all old default rules
    AlertRule.objects.filter(is_default=True).delete()
    # Seed new ones
    for rule_data in NEW_DEFAULT_RULES:
        AlertRule.objects.create(**rule_data, is_default=True, is_active=True, notify_roles=[])


def reverse_reseed(apps, schema_editor):
    AlertRule = apps.get_model("notifications", "AlertRule")
    AlertRule.objects.filter(is_default=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0005_alertrule_kpi_category'),
    ]

    operations = [
        migrations.RunPython(reseed_rules, reverse_code=reverse_reseed),
    ]
