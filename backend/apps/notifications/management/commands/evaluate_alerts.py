from django.core.management.base import BaseCommand

from apps.notifications.tasks import evaluate_alert_rules


class Command(BaseCommand):
    help = "Evaluate all active alert rules against the warehouse KPIs and dispatch notifications."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Fetch metrics and check conditions but do not create alerts or send notifications.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self._dry_run()
        else:
            self.stdout.write("Running alert evaluation …")
            result = evaluate_alert_rules()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Done — evaluated: {result['evaluated']}, fired: {result['fired']}"
                )
            )

    def _dry_run(self):
        from apps.notifications.models import AlertRule
        from apps.notifications.tasks import _fetch_metric

        self.stdout.write(self.style.WARNING("Dry-run mode — no alerts will be created.\n"))

        rules = AlertRule.objects.filter(is_active=True).order_by("dashboard", "kpi_category", "metric")
        if not rules.exists():
            self.stdout.write("No active alert rules found.")
            return

        fired = 0
        skipped_cooldown = 0
        no_data = 0

        for rule in rules:
            if rule.is_in_cooldown():
                self.stdout.write(f"  [cooldown]  {rule.name}")
                skipped_cooldown += 1
                continue

            value = _fetch_metric(rule.metric)
            if value is None:
                self.stdout.write(self.style.WARNING(f"  [no data]   {rule.name}"))
                no_data += 1
                continue

            would_fire = rule.evaluate(value)
            status = self.style.ERROR("WOULD FIRE") if would_fire else self.style.SUCCESS("ok")
            self.stdout.write(
                f"  [{status}]  {rule.name}  —  "
                f"value={value:.2f}  {rule.operator}  threshold={rule.threshold}"
            )
            if would_fire:
                fired += 1

        self.stdout.write(
            f"\nSummary: {rules.count()} rules — "
            f"{fired} would fire, "
            f"{skipped_cooldown} in cooldown, "
            f"{no_data} no data."
        )
