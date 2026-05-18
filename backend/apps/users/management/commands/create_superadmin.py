"""
Management command: create or update the platform superadmin from environment variables.

Usage:
    python manage.py create_superadmin

Reads from environment:
    SUPERADMIN_USERNAME   (default: admin)
    SUPERADMIN_EMAIL      (default: admin@logiq.local)
    SUPERADMIN_PASSWORD   (required)

If the user already exists it updates is_active, is_staff, is_superuser, and
resets the password — safe to run on every deploy.
"""

import os

from django.core.management.base import BaseCommand, CommandError

from apps.users.models import User


class Command(BaseCommand):
    help = "Create or update the platform superadmin using credentials from environment variables."

    def handle(self, *args, **options):
        username = os.environ.get("SUPERADMIN_USERNAME", "admin")
        email = os.environ.get("SUPERADMIN_EMAIL", "admin@logiq.local")
        password = os.environ.get("SUPERADMIN_PASSWORD", "")

        if not password:
            raise CommandError(
                "SUPERADMIN_PASSWORD environment variable is not set. "
                "Add it to your .env file and try again."
            )

        user, created = User.objects.get_or_create(username=username)

        user.email = email
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.hrforce_id = None  # superadmin is not an HRForce user
        user.set_password(password)
        user.save()

        action = "Created" if created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} superadmin: username={username!r}, email={email!r}"
            )
        )
