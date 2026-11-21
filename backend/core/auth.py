"""JWT maison (HS256) avec hmac / hashlib / base64."""
import base64
import hashlib
import hmac
import json
import time
from functools import wraps

from django.conf import settings
from django.http import JsonResponse

from .models import User


def _b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(texte):
    return base64.urlsafe_b64decode(texte + "=" * (-len(texte) % 4))


def _signer(message):
    return _b64(hmac.new(settings.SECRET_KEY.encode(), message.encode(), hashlib.sha256).digest())


def creer_token(user, type_="access"):
    ttl = settings.JWT_ACCESS_SECONDS if type_ == "access" else settings.JWT_REFRESH_SECONDS
    entete = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    maintenant = int(time.time())
    charge = _b64(json.dumps({"sub": str(user.id), "role": user.role, "type": type_,
                              "iat": maintenant, "exp": maintenant + ttl}, separators=(",", ":")).encode())
    return f"{entete}.{charge}.{_signer(entete + '.' + charge)}"


def decoder_token(token, type_="access"):
    try:
        entete, charge, signature = token.split(".")
        if not hmac.compare_digest(signature, _signer(f"{entete}.{charge}")):
            return None
        data = json.loads(_unb64(charge))
        if data.get("exp", 0) < time.time() or data.get("type") != type_:
            return None
        return data
    except Exception:
        return None


def tokens_pour(user):
    return {"access": creer_token(user, "access"), "refresh": creer_token(user, "refresh")}


def authentifie(*roles):
    """Décorateur RBAC : sans argument = tout utilisateur connecté."""
    def decorateur(vue):
        @wraps(vue)
        def wrapper(request, *args, **kwargs):
            entete = request.headers.get("Authorization", "")
            if not entete.startswith("Bearer "):
                return JsonResponse({"erreur": "Authentification requise"}, status=401)
            data = decoder_token(entete[7:])
            if not data:
                return JsonResponse({"erreur": "Token invalide ou expiré"}, status=401)
            user = User.objects.filter(pk=data["sub"], is_active=True, is_verified=True).first()
            if not user:
                return JsonResponse({"erreur": "Compte introuvable ou inactif"}, status=401)
            if roles and user.role not in roles:
                return JsonResponse({"erreur": "Accès refusé pour ce rôle"}, status=403)
            request.auth_user = user
            return vue(request, *args, **kwargs)
        return wrapper
    return decorateur
