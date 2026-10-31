#!/usr/bin/env python3
"""Casi di riferimento per il confronto tra il motore Python (fonte autorevole: controllo.py gira sull'ESP32) e il
motore dell'orto del browser (gemello/orto_minuti.js, traduzione riga per riga).

Ogni caso contiene TUTTI gli ingressi (meteo giorno per giorno, zone, parametri, guasti, blackout) e i risultati del
Python: eventi della pompa (minuto, zona, accesa/spenta), allarmi comparsi e rientrati, litri e umidità a fine giorno.
Il browser rilegge gli stessi ingressi e deve dare gli stessi eventi (test/js/test_orto_differenziale.js).
Senza rumore sulle letture: con il rumore i due generatori casuali sarebbero diversi. Il caso "replay" verifica a parte
la sola logica di controllo con le letture rumorose registrate dal Python.

Uso: python3 -m sistema.differenziale > test/contratti/irrigazione.json
"""
import json
import random

from .controllo import Controllore, ControlloreTimer
from .modello import Mondo, meteo_sintetico

ZONE = [{"nome": "pomodori", "area_m2": 4.0, "kc": 1.1, "umidita": 0.6},
        {"nome": "insalate", "area_m2": 2.0, "kc": 1.0, "umidita": 0.5, "capacita_mm": 40.0, "drenaggio_mm_h": 15.0}]


def _anno(seme):
    giorni = []
    for mese, n in zip(range(1, 13), (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)):
        giorni += meteo_sintetico(mese, n, seme + mese)
    return giorni


def _giorno(et0, pioggia, t_media, escursione=10.0, mese=7):
    return {"et0": et0, "pioggia": pioggia, "t_media": t_media, "escursione": escursione, "nuvoloso": pioggia > 1,
            "mese": mese}


def _pulisci(meteo):
    """Solo i campi che il motore usa, così il JSON è completo e piccolo."""
    campi = ("et0", "pioggia", "t_media", "escursione", "nuvoloso", "mese", "prevista")
    return [{k: g[k] for k in campi if k in g} for g in meteo]


def casi():
    estate = meteo_sintetico(7, 7, 2)
    inverno = [dict(g, t_media=g["t_media"] - 7) for g in meteo_sintetico(1, 31, 4)]   # gelo di notte
    return [
        {"nome": "giornata_asciutta", "meteo": [_giorno(6.5, 0, 27)], "zone": [dict(ZONE[0], umidita=0.42), ZONE[1]]},
        {"nome": "giornata_piovosa", "meteo": [_giorno(2.0, 25, 18), _giorno(3.0, 0, 20)],
         "zone": [dict(ZONE[0], umidita=0.40), ZONE[1]]},
        {"nome": "settimana_estiva", "meteo": estate, "zone": ZONE},
        {"nome": "mese_invernale", "meteo": inverno, "zone": ZONE},
        {"nome": "anno_completo", "meteo": _anno(10), "zone": ZONE, "mondo": {"tetto_m2": 12.0}},
        {"nome": "blackout", "meteo": estate, "zone": ZONE, "interruzioni": [[2 * 1440 + 600, 30 * 60]]},
        {"nome": "sensore_guasto", "meteo": estate, "zone": ZONE,
         "mondo": {"guasti": {"sensore_staccato": {"0": 1440}}}},
        {"nome": "serbatoio_vuoto", "meteo": [_giorno(6.0, 0, 26)] * 5, "zone": ZONE,
         "mondo": {"serbatoio_l": 120.0, "capacita_serbatoio_l": 200.0, "sensore_livello": True}},
        {"nome": "pompa_guasta_flussimetro", "meteo": estate, "zone": ZONE,
         "mondo": {"flussimetro": True, "guasti": {"pompa_guasta": 2 * 1440}}},
        {"nome": "tubo_rotto", "meteo": estate, "zone": ZONE, "mondo": {"guasti": {"tubo_rotto": {"1": 1440}}}},
        {"nome": "valvola_bloccata_aperta", "meteo": estate, "zone": ZONE, "parametri": {},
         "mondo": {"guasti": {"valvola_bloccata_aperta": {"1": 1440}}}},
        {"nome": "manuale_timer", "meteo": estate, "zone": ZONE, "timer": {"ora_min": 420, "durata_min": 12}},
        {"nome": "aiuola_vuota_portate_diverse", "meteo": estate,
         "zone": [dict(ZONE[0], portata_l_min=0.76), dict(ZONE[1], portata_l_min=0.38, attiva=False)]},
        {"nome": "serra_pioggia_solo_in_cisterna", "meteo": inverno[:10] + estate, "zone": ZONE,
         "mondo": {"pioggia_zone": False, "sensore_pioggia": False}, "parametri": {"pioggia_salta_mm": 1e9}},
        {"nome": "goccia_efficienza_e_deriva", "meteo": estate,
         "zone": [dict(ZONE[0], efficienza=0.9, bias=-0.05), dict(ZONE[1], efficienza=0.9)]},
    ]


def _guasti(g):
    """Le chiavi delle zone in JSON sono stringhe: il Mondo vuole interi."""
    out = {}
    for k, v in (g or {}).items():
        out[k] = {int(z): m for z, m in v.items()} if isinstance(v, dict) else v
    return out


def esegui(caso):
    meteo = _pulisci(caso["meteo"])
    zone = [dict(z) for z in caso["zone"]]
    n = len(zone)
    kw = dict(caso.get("mondo", {}))
    kw["guasti"] = _guasti(kw.get("guasti"))
    mondo = Mondo(zone, meteo, rumore=0, **kw)
    par = caso.get("parametri", {})
    interruzioni = caso.get("interruzioni", [])
    memoria = {}
    ctrl, acceso_prima, pompa_prima = None, False, False
    eventi, allarmi_ev, attivi, giorni = [], [], set(), []
    ore_stress, ore_ristagno = [0] * n, [0] * n
    usati_prima = 0.0
    for m in range(len(meteo) * 1440):
        acceso = not any(a <= m < a + d for a, d in interruzioni)
        if acceso and not acceso_prima:
            if "timer" in caso:
                ctrl = ControlloreTimer(n, caso["timer"]["ora_min"], caso["timer"]["durata_min"])
            else:
                ctrl = Controllore(n, par, memoria)
                memoria = ctrl.memoria()
        if acceso:
            out = ctrl.passo(mondo.letture(m))
            if getattr(ctrl, "memoria_cambiata", False):
                memoria = ctrl.memoria()
        else:
            out = {"pompa": False, "valvole": [False] * n, "allarmi": []}
        if out["pompa"] != pompa_prima:
            eventi.append([m, out["valvole"].index(True) if out["pompa"] else -1])
        acceso_prima, pompa_prima = acceso, out["pompa"]
        mondo.avanza(m, out, alimentato=acceso)
        nuovi = set(out["allarmi"])
        for a in sorted(nuovi - attivi):
            allarmi_ev.append([m, a, 1])
        for a in sorted(attivi - nuovi):
            allarmi_ev.append([m, a, 0])
        attivi = nuovi
        if m % 60 == 0:
            for i, (u, r) in enumerate(zip(mondo.umidita_vera(), mondo.in_ristagno())):
                ore_stress[i] += u < 0.30
                ore_ristagno[i] += r
        if m % 1440 == 1439:
            giorni.append({"litri": mondo.litri_usati - usati_prima, "umidita": mondo.umidita_vera(),
                           "serbatoio": mondo.serbatoio,
                           "zone": [[z["litri"], z["persi"], z["sprecati"]] for z in mondo.zone]})
            usati_prima = mondo.litri_usati
    return {"eventi_pompa": eventi, "allarmi": allarmi_ev, "giorni": giorni,
            "totali": {"litri": mondo.litri_usati, "persi": mondo.litri_persi, "dispersi": mondo.litri_dispersi,
                       "pompa_minuti": mondo.pompa_minuti, "troppo_pieno": mondo.troppo_pieno_l,
                       "ore_stress": ore_stress, "ore_ristagno": ore_ristagno}}


def replay(giorni=2, seme=5):
    """Letture CON rumore registrate dal mondo Python e uscite del controllore: il browser rilegge le letture."""
    meteo = meteo_sintetico(7, giorni, seme)
    mondo = Mondo([dict(z) for z in ZONE], meteo, seme=seme, flussimetro=True, sensore_livello=True)
    ctrl = Controllore(len(ZONE), {})
    righe = []
    for m in range(giorni * 1440):
        let = mondo.letture(m)
        out = ctrl.passo(let)
        righe.append([let["adc"], let["serbatoio_basso"], let["serbatoio_l"], let["temp_c"], let["pioggia_prevista_mm"],
                      let["pioggia_in_corso"], let["flusso_l_min"], out["pompa"], out["valvole"].index(True) if out["pompa"] else -1,
                      out["allarmi"]])
        mondo.avanza(m, out)
    return righe


def contratto():
    lista = []
    for c in casi():
        caso = dict(c, meteo=_pulisci(c["meteo"]))
        caso["atteso"] = esegui(caso)
        lista.append(caso)
    return {"descrizione": "Generato da sistema/differenziale.py: non modificare a mano.", "casi": lista,
            "replay": replay()}


if __name__ == "__main__":
    print(json.dumps(contratto(), separators=(",", ":")))
