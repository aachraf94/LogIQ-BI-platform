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

# Password hashers — bcrypt first so imported HRForce hashes are verified correctly.
# Django's BCryptPasswordHasher stores hashes as "bcrypt$$2b$12$..."
# HRForce raw bcrypt: "$2b$12$..." → prefix with "bcrypt$" on import.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.BCryptPasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",   # fallback for superusers created via createsuperuser
]

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

# --- Email ---
# Local dev: "console" backend prints to stdout.  Production: set EMAIL_BACKEND to smtp.
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "LOGIQ Platform <noreply@logiq.space>")

# --- Logging ---
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} [{levelname}] {name}: {message}",
            "style": "{",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "simple": {
            "format": "[{levelname}] {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
            "level": "INFO",
        },
        "file_django": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOGS_DIR / "django.log",
            "maxBytes": 5 * 1024 * 1024,  # 5 MB
            "backupCount": 5,
            "formatter": "verbose",
            "level": "INFO",
            "encoding": "utf-8",
        },
        "file_api": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOGS_DIR / "api.log",
            "maxBytes": 5 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "verbose",
            "level": "DEBUG",
            "encoding": "utf-8",
        },
        "file_celery": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOGS_DIR / "celery.log",
            "maxBytes": 5 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "verbose",
            "level": "INFO",
            "encoding": "utf-8",
        },
    },
    "loggers": {
        # Django internals — request errors, security, DB queries
        "django": {
            "handlers": ["console", "file_django"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console", "file_django"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.security": {
            "handlers": ["console", "file_django"],
            "level": "WARNING",
            "propagate": False,
        },
        # All local apps — API views, serializers, business logic
        "apps": {
            "handlers": ["console", "file_api"],
            "level": "INFO",
            "propagate": False,
        },
        # Celery tasks
        "celery": {
            "handlers": ["console", "file_celery"],
            "level": "INFO",
            "propagate": False,
        },
        "celery.task": {
            "handlers": ["console", "file_celery"],
            "level": "INFO",
            "propagate": False,
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
}
