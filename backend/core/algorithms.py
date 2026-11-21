"""Algorithmes cœur métier en Python pur : ordonnancement et graphes."""
import heapq
import math
from dataclasses import dataclass

R_TERRE_KM = 6371.0088


def haversine(lat1, lon1, lat2, lon2):
    """Distance orthodromique en kilomètres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R_TERRE_KM * math.asin(math.sqrt(a))


# 1. Job Scheduling : file de priorité + Earliest Deadline First
@dataclass(frozen=True)
class Tache:
    id: str
    priorite: int      # 1 = Express, 2 = VIP, 3 = Standard
    deadline: float    # heure limite de passage (EDF)
    zone: str
    poids: float       # kg
    lat: float
    lon: float


@dataclass(frozen=True)
class Collecteur:
    id: str
    zone: str
    capacite_kg: float


def ordonnancer(taches):
    """Tâches triées par (priorité, échéance) via un tas binaire."""
    tas = []
    for seq, t in enumerate(taches):
        heapq.heappush(tas, (t.priorite, t.deadline, seq, t))
    return [heapq.heappop(tas)[3] for _ in range(len(tas))]


def affecter_taches(taches, collecteurs):
    """Affecte les tâches (dans l'ordre de priorité) aux éboueurs.

    Contraintes : capacité en poids ; affinité de zone (zone propre, puis zone
    déjà desservie, puis charge la plus faible).
    Retourne (tournees {id_collecteur: [Tache]}, non_affectees [Tache]).
    """
    charges = {c.id: 0.0 for c in collecteurs}
    zones_servies = {c.id: set() for c in collecteurs}
    tournees = {c.id: [] for c in collecteurs}
    non_affectees = []
    for t in ordonnancer(taches):
        candidats = [c for c in collecteurs if charges[c.id] + t.poids <= c.capacite_kg]
        if not candidats:
            non_affectees.append(t)
            continue

        def cle(c):
            affinite = 0 if c.zone == t.zone else (1 if t.zone in zones_servies[c.id] else 2)
            return (affinite, charges[c.id])

        choisi = min(candidats, key=cle)
        charges[choisi.id] += t.poids
        zones_servies[choisi.id].add(t.zone)
        tournees[choisi.id].append(t)
    return tournees, non_affectees


# 2. Graphe pondéré : Plus Proche Voisin + 2-opt + insertion incrémentale
class GrapheCollecte:
    """Graphe complet pondéré par la distance de Haversine.

    noeuds : liste de tuples (id, latitude, longitude). Une tournée est une liste d'indices.
    """

    def __init__(self, noeuds):
        self.noeuds = list(noeuds)
        self._cache = {}

    def ajouter(self, noeud):
        self.noeuds.append(noeud)
        return len(self.noeuds) - 1

    def distance(self, i, j):
        if i == j:
            return 0.0
        cle = (i, j) if i < j else (j, i)
        if cle not in self._cache:
            a, b = self.noeuds[cle[0]], self.noeuds[cle[1]]
            self._cache[cle] = haversine(a[1], a[2], b[1], b[2])
        return self._cache[cle]

    def longueur(self, tour):
        return sum(self.distance(tour[k], tour[k + 1]) for k in range(len(tour) - 1))

    def plus_proche_voisin(self, depart=0, indices=None):
        restants = set(range(len(self.noeuds)) if indices is None else indices)
        if not restants:
            return []
        courant = depart if depart in restants else min(restants)
        tour = [courant]
        restants.discard(courant)
        while restants:
            courant = min(restants, key=lambda j: (self.distance(tour[-1], j), j))
            tour.append(courant)
            restants.discard(courant)
        return tour

    def deux_opt(self, tour):
        """Amélioration locale 2-opt sur un chemin ouvert (le départ reste fixe)."""
        meilleur = list(tour)
        ameliore = True
        while ameliore:
            ameliore = False
            for i in range(1, len(meilleur) - 1):
                for j in range(i + 1, len(meilleur)):
                    a, b, c = meilleur[i - 1], meilleur[i], meilleur[j]
                    d = meilleur[j + 1] if j + 1 < len(meilleur) else None
                    ancien = self.distance(a, b) + (self.distance(c, d) if d is not None else 0.0)
                    nouveau = self.distance(a, c) + (self.distance(b, d) if d is not None else 0.0)
                    if nouveau < ancien - 1e-9:
                        meilleur[i:j + 1] = reversed(meilleur[i:j + 1])
                        ameliore = True
        return meilleur

    def tournee_optimale(self, depart=0, indices=None):
        return self.deux_opt(self.plus_proche_voisin(depart, indices))

    def cout_insertion(self, tour, k, a_partir_de=0):
        """Coût marginal minimal d'insertion du noeud k : (cout_km, position)."""
        if not tour:
            return 0.0, 0
        meilleur = None
        for pos in range(a_partir_de, len(tour) + 1):
            if pos == len(tour):
                cout = self.distance(tour[-1], k)
            elif pos == 0:
                cout = self.distance(k, tour[0])
            else:
                cout = (self.distance(tour[pos - 1], k) + self.distance(k, tour[pos])
                        - self.distance(tour[pos - 1], tour[pos]))
            if meilleur is None or cout < meilleur[0]:
                meilleur = (cout, pos)
        return meilleur

    def inserer_incremental(self, tour, k, a_partir_de=0):
        """Insère k dans la tournée active sans la recalculer entièrement."""
        _, pos = self.cout_insertion(tour, k, a_partir_de)
        return list(tour[:pos]) + [k] + list(tour[pos:])
