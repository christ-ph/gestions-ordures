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
    "gmailapi_backend", # <-- Ajouté
]

# Ajout de WhiteNoise pour servir les fichiers statiques en production
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
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

# ==========================================
# CONFIGURATION DE L'ENVOI D'EMAILS (API GMAIL)
# ==========================================
# Au lieu du SMTP (bloqué par Render), on utilise l'API Google (port 443)
EMAIL_BACKEND = "gmailapi_backend.mail.GmailBackend"

# Récupération des identifiants OAuth2 depuis les variables d'environnement
GMAIL_API_CLIENT_ID = os.environ.get("GMAIL_API_CLIENT_ID", "")
GMAIL_API_CLIENT_SECRET = os.environ.get("GMAIL_API_CLIENT_SECRET", "")
GMAIL_API_REFRESH_TOKEN = os.environ.get("GMAIL_API_REFRESH_TOKEN", "")

# L'adresse d'envoi DOIT être exactement l'adresse Gmail qui a généré les tokens OAuth2
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@gestion-ordures.cm")

OTP_VALIDITE_MINUTES = 10
JWT_ACCESS_SECONDS = 60 * 60
JWT_REFRESH_SECONDS = 60 * 60 * 24 * 7
CAPACITE_EBOUEUR_KG = 2000

# Configuration des fichiers statiques pour WhiteNoise
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
