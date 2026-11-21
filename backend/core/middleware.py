import time

from django.http import HttpResponse

from .models import LogMonitoring


class CorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = HttpResponse(status=204) if request.method == "OPTIONS" else self.get_response(request)
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return response


class MonitoringMiddleware:
    """Journalise chaque appel API (utilisateur, endpoint, statut, durée)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        debut = time.time()
        response = self.get_response(request)
        if request.method != "OPTIONS" and request.path.startswith("/api/") and not request.path.startswith("/api/logs"):
            try:
                action = getattr(request, "action_log", request.method)
                LogMonitoring.objects.create(
                    utilisateur=getattr(request, "auth_user", None),
                    action=f"{action} ({int((time.time() - debut) * 1000)} ms)",
                    endpoint=request.path, statut_http=response.status_code)
            except Exception:
                pass
        return response
