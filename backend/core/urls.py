from django.urls import path

from . import views as v

urlpatterns = [
    path("auth/register/", v.register),
    path("auth/verify-otp/", v.verify_otp),
    path("auth/resend-otp/", v.resend_otp),
    path("auth/login/", v.login),
    path("auth/refresh/", v.refresh),
    path("auth/me/", v.me),

    path("users/", v.users),
    path("users/<uuid:pk>/", v.user_detail),
    path("services/", v.services_view),
    path("services/<uuid:pk>/", v.service_detail),
    path("points/", v.points),
    path("points/<uuid:pk>/", v.point_detail),

    path("souscriptions/", v.souscriptions),
    path("souscriptions/simuler/", v.souscription_simuler),
    path("souscriptions/<uuid:pk>/payer/", v.souscription_payer),
    path("paiements/", v.paiements),

    path("planning/", v.planning_list),
    path("planning/generer/", v.planning_generer),
    path("planning/express/", v.planning_express),
    path("planning/sync/", v.planning_sync),
    path("planning/<uuid:pk>/arrivee/", v.planning_arrivee),
    path("planning/<uuid:pk>/valider/", v.planning_valider),
    path("planning/<uuid:pk>/incident/", v.planning_incident),

    path("signalements/", v.signalements),
    path("signalements/<uuid:pk>/convertir/", v.signalement_convertir),
    path("signalements/<uuid:pk>/traiter/", v.signalement_traiter),

    path("notifications/", v.notifications),
    path("notifications/lire-tout/", v.notifications_lire_tout),
    path("notifications/<uuid:pk>/lire/", v.notification_lire),

    path("dashboard/", v.dashboard),
    path("logs/", v.logs),
]
