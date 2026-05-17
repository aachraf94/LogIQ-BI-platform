"""
Base Django settings shared across all environments.
"""

import os
from datetime import timedelta
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
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # Local apps
    "apps.users",
    "apps.notifications",
    "apps.analytics",
    "apps.integrations",
]

AUTH_USER_MODEL = "users.User"

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
        "PORT": os.environ.get("WAREHOUSE_DB_PORT", "5433"),
    },
}

DATABASE_ROUTERS = ["config.db_router.LogiqDBRouter"]

# --- Celery ---
CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_BEAT_SCHEDULE = {
    "evaluate-alert-rules": {
        "task": "apps.notifications.tasks.evaluate_alert_rules",
        "schedule": timedelta(minutes=15),
    },
}

# --- DRF ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# --- JWT ---
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# --- OpenAPI / Swagger ---
SPECTACULAR_SETTINGS = {
    "TITLE": "LOGIQ Platform API",
    "DESCRIPTION": (
        "REST API for the LOGIQ BI Platform — Yalidine logistics operations.\n\n"
        "**Authentication**: Use `POST /api/users/auth/login/` to obtain a Bearer token, "
        "then click **Authorize** and enter `Bearer <access_token>`."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SWAGGER_UI_SETTINGS": {
        "deepLinking": True,
        "persistAuthorization": True,
        "displayOperationId": False,
        "filter": True,
        "syntaxHighlight.activate": True,
    },
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": False,
    "TAGS": [
        {"name": "auth", "description": "Login, logout, token refresh"},
        {"name": "profile", "description": "Current user profile & sessions"},
        {"name": "preferences", "description": "UI & notification preferences"},
        {"name": "notifications", "description": "In-app notifications"},
        {"name": "announcements", "description": "System-wide announcements"},
        {"name": "alert-rules", "description": "Threshold alert configuration (admin)"},
        {"name": "alerts", "description": "Triggered alert instances"},
        {"name": "admin-users", "description": "User management (superadmin only)"},
    ],
}

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Algiers"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
