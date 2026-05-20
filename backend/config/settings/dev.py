"""Development settings."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend root (two levels up from this file)
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_path)

from .base import *  # noqa: F401, F403

DEBUG = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# Dev: verbose console output + DEBUG level for local app code
LOGGING["handlers"]["console"]["level"] = "DEBUG"  # type: ignore[index]
LOGGING["loggers"]["apps"]["level"] = "DEBUG"  # type: ignore[index]
