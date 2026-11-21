# Système Intelligent de Gestion et de Collecte des Ordures

Django pur (sans DRF) · React + Tailwind v4 (design system `input.css`) · React Native + NativeWind

## 1. Backend (http://localhost:8000)

    cd backend
    python3 -m venv venv
    source venv/bin/activate            # Windows : venv\Scripts\activate
    pip install -r requirements.txt
    python manage.py makemigrations core
    python manage.py migrate
    python manage.py seed               # comptes et données de démonstration
    python manage.py runserver 0.0.0.0:8000

Le code OTP s'affiche dans la console du serveur (mode DEBUG).
SMTP réel : `EMAIL_HOST=smtp.exemple.com EMAIL_HOST_USER=... EMAIL_HOST_PASSWORD=... python manage.py runserver`
Rappels (veille 20h, J-7) : `python manage.py rappels` (à planifier avec cron).

## 2. Web (http://localhost:5173)

    cd web-frontend
    npm install
    npm run dev

Autre URL d'API : `VITE_API_URL=http://IP:8000/api npm run dev`
Polices Pally : copier Pally-Regular.otf, Pally-Medium.otf, Pally-Bold.otf dans `web-frontend/public/fonts/`.

## 3. Mobile

    cd mobile-app
    npm install
    npx expo install --fix
    EXPO_PUBLIC_API_URL=http://<IP_DE_TON_PC>:8000/api npx expo start -c

Windows PowerShell : `$env:EXPO_PUBLIC_API_URL="http://<IP>:8000/api"; npx expo start -c`
Le téléphone et le PC doivent être sur le même Wi-Fi.

## Comptes de démonstration (créés par `seed`)

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | admin@gestion.cm | Admin1234! |
| Client (nouveau, 2 mois gratuits) | client@gestion.cm | Client1234! |
| Éboueur | eboueur1@gestion.cm | Eboueur1234! |
| Éboueur | eboueur2@gestion.cm | Eboueur1234! |

## Flux de test

1. Web, compte client : souscrire à un plan (2 jours ouvrables, 2 mois gratuits).
2. Web, compte admin : Dashboard, choisir une date, « Générer le Planning ».
3. Mobile, éboueur : Tournée, « Je suis arrivé » (le client est notifié), puis « Valider (Scan QR) ». Le QR est dans l'onglet « Mon QR » du compte client.
4. Hors-ligne : coupe le Wi-Fi, valide, rallume : la file se synchronise seule.

## Documentation UML

`docs/diagramme_classes.mmd` (Mermaid) et `docs/diagramme_classes.puml` (PlantUML).

## Remarques

- FCM, Redis et PostGIS du cahier ne sont pas implémentés (SQLite et Django natif imposés par le prompt).
- Le cache de distances est un cache mémoire dans `GrapheCollecte`.
