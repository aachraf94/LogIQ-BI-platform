"""Production settings."""

import os
from .base import *  # noqa: F401, F403

DEBUG = False

_allowed = os.environ.get("DJANGO_ALLOWED_HOSTS", "backend,localhost")
ALLOWED_HOSTS = [h.strip() for h in _allowed.split(",")] + ["localhost", "127.0.0.1"]

CORS_ALLOWED_ORIGINS = [
    "https://logiq.space",
    "https://www.logiq.space",
    "http://localhost:3001",
]

# Prod: console shows only WARNING+; files capture INFO+
LOGGING["handlers"]["console"]["level"] = "WARNING"  # type: ignore[index]
LOGGING["loggers"]["django"]["level"] = "WARNING"  # type: ignore[index]
