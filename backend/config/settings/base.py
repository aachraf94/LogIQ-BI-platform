"""
Base Django settings shared across all environments.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get("SECRET_KEY", "insecure-dev-key")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    "django_filters",
    # Local apps
    "apps.users",
    "apps.notifications",
    "apps.analytics",
    "apps.integrations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("PLATFORM_DB_NAME", "logiq_platform"),
        "USER": os.environ.get("PLATFORM_DB_USER", "postgres"),
        "PASSWORD": os.environ.get("PLATFORM_DB_PASSWORD", "changeme"),
        "HOST": os.environ.get("PLATFORM_DB_HOST", "localhost"),
        "PORT": os.environ.get("PLATFORM_DB_PORT", "5432"),
    },
    "warehouse": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("WAREHOUSE_DB_NAME", "logiq_warehouse"),
        "USER": os.environ.get("WAREHOUSE_DB_USER", "postgres"),
        "PASSWORD": os.environ.get("WAREHOUSE_DB_PASSWORD", "changeme"),
        "HOST": os.environ.get("WAREHOUSE_DB_HOST", "localhost"),
        "PORT": os.environ.get("WAREHOUSE_DB_PORT", "5432"),
    },
}

DATABASE_ROUTERS = ["config.db_router.LogiqDBRouter"]

CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Algiers"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
