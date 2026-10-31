#!/usr/bin/env python3
"""Scarica lo storico da Home Assistant e lo riassume giorno per giorno in un CSV per il Registro del gemello.

Uso:
  python3 strumenti/storico_ha.py --url http://homeassistant.local:8123 --token TOKEN --giorni 30 --file misure.csv

Il token si crea nel profilo di Home Assistant (Token di accesso a lungo termine). Non va su GitHub.
Colonne del CSV: data, ph_medio, ec_media, t_acqua_media, t_acqua_max, t_aria_min, t_aria_max, ur_media e, se in Home
Assistant ci sono i sensori del garage e di fuori (ENTITA_AMBIENTE), t_garage_min, t_garage_max, t_est_min, t_est_max:
lo stesso file va nel Registro e nella scheda Calibrazione del gemello.
"""
import argparse
import csv
import datetime
import json
import urllib.parse
import urllib.request

ENTITA = {
    "ph": "sensor.agritech_idroponica_ph",
    "ec": "sensor.agritech_idroponica_ec",
    "t_acqua": "sensor.agritech_idroponica_temperatura_acqua",
    "t_aria": "sensor.agritech_idroponica_temperatura_aria",
    "ur": "sensor.agritech_idroponica_umidita_aria",
}


# facoltativi: con questi la scheda Calibrazione confronta anche garage e temperatura esterna (nomi da adattare)
ENTITA_AMBIENTE = {
    "t_garage": "sensor.agritech_garage_temperatura",
    "t_est": "sensor.agritech_esterno_temperatura",
}


def riassumi(storico, entita=ENTITA, ambiente=ENTITA_AMBIENTE):
    """storico: risposta di /api/history/period (lista di liste di stati) -> righe giornaliere."""
    per_id = {}
    for serie in storico:
        for st in serie:
            try:
                v = float(st["state"])
            except (KeyError, TypeError, ValueError):
                continue                                  # unavailable, unknown
            giorno = st["last_changed"][:10]
            per_id.setdefault(st.get("entity_id") or serie[0]["entity_id"], {}).setdefault(giorno, []).append(v)
    giorni = sorted({g for d in per_id.values() for g in d})
    righe = []
    media = lambda l: round(sum(l) / len(l), 3) if l else ""
    for g in giorni:
        val = {k: per_id.get(e, {}).get(g, []) for k, e in entita.items()}
        righe.append({"data": g, "ph_medio": media(val["ph"]), "ec_media": media(val["ec"]),
                      "t_acqua_media": media(val["t_acqua"]), "t_acqua_max": max(val["t_acqua"]) if val["t_acqua"] else "",
                      "t_aria_min": min(val["t_aria"]) if val["t_aria"] else "", "t_aria_max": max(val["t_aria"]) if val["t_aria"] else "",
                      "ur_media": media(val["ur"])})
        for k, e in ambiente.items():
            v = per_id.get(e, {}).get(g, [])
            if v:
                righe[-1][k + "_min"], righe[-1][k + "_max"] = min(v), max(v)
    if any(k + "_min" in r for r in righe for k in ambiente):      # stesse colonne in tutte le righe
        for r in righe:
            for k in ambiente:
                r.setdefault(k + "_min", "")
                r.setdefault(k + "_max", "")
    return righe


def scarica(url, token, giorni):
    inizio = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=giorni)).isoformat()
    q = url.rstrip("/") + "/api/history/period/" + urllib.parse.quote(inizio) + "?filter_entity_id=" + ",".join(list(ENTITA.values()) + list(ENTITA_AMBIENTE.values()))
    req = urllib.request.Request(q, headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--url", required=True)
    a.add_argument("--token", required=True)
    a.add_argument("--giorni", type=int, default=30)
    a.add_argument("--file", default="misure.csv")
    x = a.parse_args()
    righe = riassumi(scarica(x.url, x.token, x.giorni))
    with open(x.file, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(righe[0].keys()) if righe else ["data"])
        w.writeheader()
        w.writerows(righe)
    print("%d giorni salvati in %s" % (len(righe), x.file))


if __name__ == "__main__":
    main()
