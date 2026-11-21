import os
from pathlib import Path
import dj_database_url 

BASE_DIR = Path(__file__).resolve().parent.parent

# Utilisation de noms de variables standards (SECRET_KEY et DEBUG)
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-me-in-production")
DEBUG = os.environ.get("DEBUG", "True") == "True"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "core.apps.CoreConfig",
]

# Ajout de WhiteNoise pour servir les fichiers statiques en production
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware", # <-- AJOUTÉ
    "core.middleware.CorsMiddleware",
    "core.middleware.MonitoringMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
AUTH_USER_MODEL = "core.User"
AUTH_PASSWORD_VALIDATORS = []

# Configuration intelligente de la base de données
if os.environ.get("DATABASE_URL"):
    # Utilisé sur Render (lit l'URL de la base PostgreSQL)
    DATABASES = {
        "default": dj_database_url.config(
            default=os.environ.get("DATABASE_URL"),
            conn_max_age=600,
            ssl_require=True
        )
    }
else:
    # Utilisé en local (SQLite)
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Douala"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DATA_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024  # photos de signalement en base64

if os.environ.get("EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ["EMAIL_HOST"]
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "1") == "1"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@gestion-ordures.cm")

OTP_VALIDITE_MINUTES = 10
JWT_ACCESS_SECONDS = 60 * 60
JWT_REFRESH_SECONDS = 60 * 60 * 24 * 7
CAPACITE_EBOUEUR_KG = 2000

# Configuration des fichiers statiques pour WhiteNoise
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
