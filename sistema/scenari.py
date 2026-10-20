"""Scenari di prova del sistema virtuale: funzionamento normale e guasti.

Ogni scenario descrive il mondo (mese, giorni, zone, serbatoio, guasti) e cosa ci si aspetta. Gli stessi scenari
sono provati in automatico da test/test_scenari.py (collaudo virtuale) e si rifanno a mano sul banco con l'hardware
vero (COLLAUDO.md).
"""
G = 1440  # minuti in un giorno

ZONE_BASE = [
    {"nome": "pomodori", "area_m2": 2.0, "kc": 1.15},
    {"nome": "insalata", "area_m2": 1.0, "kc": 1.00},
]

SCENARI = {
    "normale": {
        "descrizione": "Luglio, 2 zone, cisterna piena: nessuna pianta in sofferenza, nessun ristagno, nessun allarme.",
        "mese": 7, "giorni": 30,
    },
    "pioggia": {
        "descrizione": "Aprile piovoso: con pioggia prevista non si irriga (salvo soglia critica).",
        "mese": 4, "giorni": 30, "seme": 3,
    },
    "sensore_staccato": {
        "descrizione": "Il sensore della zona 1 si stacca il giorno 3: allarme subito, zona in emergenza a tempo.",
        "mese": 7, "giorni": 10, "guasti": {"sensore_staccato": {0: 3 * G}},
    },
    "sensore_fuori_terra": {
        "descrizione": "Il sensore della zona 2 esce dalla terra il giorno 3: legge 'secco', l'acqua non lo raggiunge, "
                       "la zona viene bloccata invece di irrigare all'infinito.",
        "mese": 7, "giorni": 10, "guasti": {"sensore_fuori_terra": {1: 3 * G}},
    },
    "tubo_rotto": {
        "descrizione": "Il tubo della zona 1 si rompe il giorno 5: l'umidità non sale, zona bloccata, cisterna salva.",
        "mese": 7, "giorni": 10, "guasti": {"tubo_rotto": {0: 5 * G}},
    },
    "pompa_guasta": {
        "descrizione": "La pompa si guasta il giorno 5: il serbatoio non scende, allarme e irrigazione bloccata.",
        "mese": 7, "giorni": 10, "guasti": {"pompa_guasta": 5 * G},
    },
    "pompa_guasta_senza_livello": {
        "descrizione": "Pompa guasta senza sensore di livello: se ne accorge il controllo di efficacia sulle zone.",
        "mese": 7, "giorni": 10, "guasti": {"pompa_guasta": 5 * G}, "sensore_livello": False,
    },
    "serbatoio_vuoto": {
        "descrizione": "Cisterna quasi vuota a luglio: la pompa non gira mai a secco, allarme di serbatoio basso.",
        "mese": 7, "giorni": 10, "serbatoio_l": 80.0,
    },
    "gelo": {
        "descrizione": "Gennaio freddo: allarme gelo di notte.",
        "mese": 1, "giorni": 7, "temp_media": 2.0,
    },
    "riavvio": {
        "descrizione": "Mancanza di corrente durante un'irrigazione il giorno 2: alla riaccensione la pompa è ferma "
                       "e il sistema riparte da solo.",
        "mese": 7, "giorni": 5, "riavvii": [2 * G + 7 * 60 + 3],
    },
}
