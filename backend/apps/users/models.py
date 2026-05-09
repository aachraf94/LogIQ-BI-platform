"""
User models.

TODO:
- Extend AbstractUser with role field (Admin, Analyst, Viewer)
- Add profile fields: phone, department, preferred_language
- Implement JWT token model for API authentication
"""

from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    # TODO: Add role, phone, department fields
    pass
