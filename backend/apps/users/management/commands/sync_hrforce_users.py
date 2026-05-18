"""
Management command: sync users from HRForce into the Django platform DB.

Usage:
    python manage.py sync_hrforce_users
    python manage.py sync_hrforce_users --dry-run
    python manage.py sync_hrforce_users --company-id 3

What it does:
    1. Calls the HRForce /users endpoint (paginated).
    2. Excludes the TEST company (id=9).
    3. For each user:
       - Creates the Django User row if it doesn't exist (is_active=False).
       - Updates profile fields (name, email, phone, agence, company) if changed.
       - Sets the password by prefixing the raw bcrypt hash with "bcrypt$"
         so Django's BCryptPasswordHasher can verify it.
       - Does NOT override is_active or role on existing users
         (those are managed by the superadmin in the platform).
    4. Prints a summary: created / updated / skipped / errors.

Password handling:
    HRForce stores passwords as raw bcrypt: "$2b$12$<salt><hash>"
    Django's BCryptPasswordHasher expects:  "bcrypt$$2b$12$<salt><hash>"
    The prefix "bcrypt$" is added during import. Django never re-hashes it.

Security:
    Passwords are fetched over the API and written directly to the platform DB.
    They are NEVER stored in the warehouse staging tables.
    The HRForce API token is read from the HRFORCE_API_TOKEN env var.
"""

import os
import time

import requests
from django.core.management.base import BaseCommand, CommandError

from apps.users.models import User


HRFORCE_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
HRFORCE_TOKEN = os.environ.get("HRFORCE_API_TOKEN", "")
EXCLUDED_COMPANY_IDS = {9}
PAGE_SIZE = 100


def _hrforce_headers() -> dict:
    return {"Authorization": f"Token {HRFORCE_TOKEN}", "Accept": "application/json"}


def _to_django_bcrypt(raw_hash: str) -> str:
    """
    Convert a raw bcrypt hash from HRForce to Django's BCryptPasswordHasher format.

    HRForce raw : $2b$12$abcdefghijklmnopqrstuvwxyz...
    Django expects: bcrypt$$2b$12$abcdefghijklmnopqrstuvwxyz...

    If the hash is already prefixed (e.g. re-running the command), return as-is.
    If the hash is empty or None, return an unusable password marker.
    """
    if not raw_hash:
        return "!"  # Django's unusable password marker

    if raw_hash.startswith("bcrypt$"):
        return raw_hash  # already in Django format

    if raw_hash.startswith("$2b$") or raw_hash.startswith("$2a$") or raw_hash.startswith("$2y$"):
        return f"bcrypt${raw_hash}"

    # Unrecognised format — mark as unusable so the user cannot log in
    # but the account can still be activated later with a valid hash
    return "!"


def _fetch_all_users() -> list:
    """Paginate through HRForce /users endpoint and return all user dicts."""
    users = []
    page = 1
    while True:
        resp = requests.get(
            f"{HRFORCE_BASE_URL}/hrforce/users/",
            headers=_hrforce_headers(),
            params={"page": page, "page_size": PAGE_SIZE},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        # Support both {"results": [...]} and plain list responses
        items = data.get("results", data) if isinstance(data, dict) else data
        if not items:
            break

        users.extend(items)

        # Stop when we get fewer items than a full page
        if len(items) < PAGE_SIZE:
            break
        page += 1
        time.sleep(0.1)  # be polite to the API

    return users


class Command(BaseCommand):
    help = "Synchronise HRForce users into the Django platform database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate the sync without writing to the database.",
        )
        parser.add_argument(
            "--company-id",
            type=int,
            default=None,
            help="Only sync users belonging to this company.",
        )
        parser.add_argument(
            "--update-passwords",
            action="store_true",
            default=True,
            help="Re-sync bcrypt passwords on every run (default: True).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        company_filter = options["company_id"]
        update_passwords = options["update_passwords"]

        if not HRFORCE_TOKEN:
            raise CommandError(
                "HRFORCE_API_TOKEN environment variable is not set. "
                "The command cannot authenticate with HRForce."
            )

        self.stdout.write(self.style.MIGRATE_HEADING("Fetching users from HRForce..."))
        try:
            raw_users = _fetch_all_users()
        except requests.RequestException as exc:
            raise CommandError(f"Failed to fetch users from HRForce: {exc}")

        self.stdout.write(f"  → {len(raw_users)} users received from API")

        created = updated = skipped = errors = 0

        for u in raw_users:
            company_id = u.get("company_id")

            # Exclude TEST company and optional company filter
            if company_id in EXCLUDED_COMPANY_IDS:
                skipped += 1
                continue
            if company_filter and company_id != company_filter:
                skipped += 1
                continue

            hrforce_id = u.get("user_id") or u.get("id")
            if not hrforce_id:
                self.stderr.write(f"  [SKIP] User with no id: {u}")
                skipped += 1
                continue

            username = u.get("username") or u.get("email", "").split("@")[0]
            if not username:
                self.stderr.write(f"  [SKIP] User {hrforce_id} has no username or email")
                skipped += 1
                continue

            raw_password = u.get("password", "")
            django_password = _to_django_bcrypt(raw_password)

            profile = {
                "first_name": (u.get("first_name") or u.get("family_name") or "").strip(),
                "last_name": (u.get("last_name") or u.get("first_name") or "").strip(),
                "email": u.get("email", ""),
                "phone": u.get("phone", "") or "",
                "department": u.get("department", "") or "",
                "agence_id": u.get("agency_id"),
                "agence_name": u.get("agency_name", "") or "",
                "company_id": company_id,
                "company_name": u.get("company_name", "") or "",
            }

            try:
                existing = User.objects.filter(hrforce_id=hrforce_id).first()

                if existing is None:
                    # ── New user ──────────────────────────────────────────
                    if not dry_run:
                        user = User(
                            hrforce_id=hrforce_id,
                            username=username,
                            is_active=False,   # admin must activate
                            **profile,
                        )
                        user.password = django_password
                        user.save()
                    self.stdout.write(
                        self.style.SUCCESS(f"  [CREATE] {username} (hrforce_id={hrforce_id})")
                    )
                    created += 1

                else:
                    # ── Existing user — update profile fields only ────────
                    changed = False
                    for field, value in profile.items():
                        if getattr(existing, field) != value:
                            if not dry_run:
                                setattr(existing, field, value)
                            changed = True

                    # Re-sync password if the hash changed or update_passwords flag is set
                    if update_passwords and existing.password != django_password and django_password != "!":
                        if not dry_run:
                            existing.password = django_password
                        changed = True

                    if changed:
                        if not dry_run:
                            existing.save()
                        self.stdout.write(f"  [UPDATE] {username} (hrforce_id={hrforce_id})")
                        updated += 1
                    else:
                        skipped += 1

            except Exception as exc:
                self.stderr.write(
                    self.style.ERROR(f"  [ERROR] {username} (hrforce_id={hrforce_id}): {exc}")
                )
                errors += 1

        # ── Summary ───────────────────────────────────────────────────────
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Sync complete" + (" (DRY RUN)" if dry_run else "") + ":"))
        self.stdout.write(self.style.SUCCESS(f"  Created : {created}"))
        self.stdout.write(self.style.WARNING(f"  Updated : {updated}"))
        self.stdout.write(f"  Skipped : {skipped}")
        if errors:
            self.stdout.write(self.style.ERROR(f"  Errors  : {errors}"))
        self.stdout.write("")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run — no changes were written to the database."))
