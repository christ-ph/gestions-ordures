def _f(x):
    return float(x) if x is not None else None


def s_user(u):
    d = {"id": str(u.id), "nom": u.nom, "email": u.email, "telephone": u.telephone, "role": u.role,
         "is_verified": u.is_verified, "is_active": u.is_active}
    if u.role == "CLIENT" and hasattr(u, "profil_client"):
        p = u.profil_client
        d.update(adresse=p.adresse, qr_code_unique=p.qr_code_unique, est_nouveau=p.est_nouveau)
    elif u.role == "EBOUEUR" and hasattr(u, "profil_eboueur"):
        d.update(zone_affectee=u.profil_eboueur.zone_affectee, disponible=u.profil_eboueur.disponible)
    elif u.role == "ADMIN" and hasattr(u, "profil_admin"):
        d.update(matricule=u.profil_admin.matricule)
    return d


def s_service(s):
    return {"id": str(s.id), "type": s.type, "poids_max_kg": _f(s.poids_max_kg), "taille_max": s.taille_max,
            "tarif_mensuel": _f(s.tarif_mensuel), "priorite": s.obtenir_priorite()}


def s_point(p):
    return {"id": str(p.id), "client": str(p.client.user_id), "client_nom": p.client.user.nom,
            "latitude": p.latitude, "longitude": p.longitude, "adresse": p.adresse, "zone": p.zone,
            "poids_estime": _f(p.poids_estime), "taille": p.taille, "capacite_max": _f(p.capacite_max),
            "temporaire": p.temporaire}


def s_souscription(s):
    return {"id": str(s.id), "service_id": str(s.service_id), "service_type": s.service.type,
            "client_nom": s.client.user.nom, "date_debut": s.date_debut.isoformat(),
            "date_fin": s.date_fin.isoformat(), "jours_choisis": s.jours_choisis,
            "mois_gratuits_restants": s.mois_gratuits_restants, "renouvellement_auto": s.renouvellement_auto,
            "statut": s.statut, "poids_estime": _f(s.poids_estime), "taille": s.taille}


def s_planning(p):
    return {"id": str(p.id), "date_tournee": p.date_tournee.isoformat(), "ordre_passage": p.ordre_passage,
            "statut": p.statut, "heure_arrivee": p.heure_arrivee.isoformat() if p.heure_arrivee else None,
            "eboueur_nom": p.eboueur.user.nom, "point": s_point(p.point_collecte), "priorite": p.priorite,
            "type_service": p.souscription.service.type if p.souscription else "EXPRESS",
            "est_synchronise": p.est_synchronise}


def s_paiement(p):
    return {"id": str(p.id), "souscription": str(p.souscription_id), "montant": _f(p.montant), "mode": p.mode,
            "reference_api": p.reference_api, "statut": p.statut, "date_paiement": p.date_paiement.isoformat()}


def s_notification(n):
    return {"id": str(n.id), "titre": n.titre, "message": n.message, "type": n.type, "est_lue": n.est_lue,
            "date_envoi": n.date_envoi.isoformat()}


def s_signalement(s):
    return {"id": str(s.id), "client_nom": s.client.user.nom, "photo_url": s.photo_url, "latitude": s.latitude,
            "longitude": s.longitude, "description": s.description, "statut": s.statut,
            "date_creation": s.date_creation.isoformat()}


def s_log(l):
    return {"id": str(l.id), "utilisateur": l.utilisateur.email if l.utilisateur else "—", "action": l.action,
            "endpoint": l.endpoint, "statut_http": l.statut_http, "timestamp": l.timestamp.isoformat()}
