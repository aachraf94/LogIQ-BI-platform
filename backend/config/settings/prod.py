"""Production settings."""

from .base import *  # noqa: F401, F403

DEBUG = False

ALLOWED_HOSTS = ["backend", "localhost"]

CORS_ALLOWED_ORIGINS = [
    "http://frontend:3000",
    "http://localhost:3001",
]

# Prod: console shows only WARNING+; files capture INFO+
LOGGING["handlers"]["console"]["level"] = "WARNING"  # type: ignore[index]
LOGGING["loggers"]["django"]["level"] = "WARNING"  # type: ignore[index]
