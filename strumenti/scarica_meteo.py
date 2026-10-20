#!/usr/bin/env python3
"""Scarica il meteo reale di un periodo passato da Open-Meteo (gratuito, senza chiave) per il simulatore.

Uso:
  python3 strumenti/scarica_meteo.py --lat 40.0 --lon 9.0 --da 2024-07-01 --a 2024-08-31 --file estate2024.csv
  python3 -m sistema.simula normale --meteo estate2024.csv --rapporto r.html
  python3 -m sistema.simula tutti --meteo estate2024.csv

Le coordinate del tuo orto si leggono su una mappa (tasto destro sul punto). Colonne del CSV: data, et0_mm,
pioggia_mm, t_min, t_max. Così provi l'impianto sulle estati vere della tua zona, siccità e nubifragi compresi.
"""
import argparse
import csv
import json
import urllib.parse
import urllib.request

URL = "https://archive-api.open-meteo.com/v1/archive"
VARIABILI = "et0_fao_evapotranspiration,precipitation_sum,temperature_2m_min,temperature_2m_max"


def converti(dati):
    """Risposta JSON di Open-Meteo -> righe per il CSV del simulatore (salta i giorni senza dati)."""
    d = dati["daily"]
    righe = []
    for i, giorno in enumerate(d["time"]):
        valori = (d["et0_fao_evapotranspiration"][i], d["precipitation_sum"][i],
                  d["temperature_2m_min"][i], d["temperature_2m_max"][i])
        if any(v is None for v in valori):
            continue
        et0, pioggia, tmin, tmax = valori
        righe.append({"data": giorno, "et0_mm": round(et0, 2), "pioggia_mm": round(pioggia, 1),
                      "t_min": round(tmin, 1), "t_max": round(tmax, 1)})
    return righe


def scarica(lat, lon, da, a):
    q = urllib.parse.urlencode({"latitude": lat, "longitude": lon, "start_date": da, "end_date": a,
                                "daily": VARIABILI, "timezone": "Europe/Rome"})
    with urllib.request.urlopen(URL + "?" + q, timeout=60) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--da", required=True, help="AAAA-MM-GG")
    ap.add_argument("--a", required=True, help="AAAA-MM-GG")
    ap.add_argument("--file", default="meteo.csv")
    a = ap.parse_args()
    righe = converti(scarica(a.lat, a.lon, a.da, a.a))
    with open(a.file, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, ["data", "et0_mm", "pioggia_mm", "t_min", "t_max"])
        w.writeheader()
        w.writerows(righe)
    pioggia = sum(r["pioggia_mm"] for r in righe)
    print("%d giorni salvati in %s: pioggia totale %.0f mm, ET0 media %.1f mm/giorno, massima %.1f °C"
          % (len(righe), a.file, pioggia, sum(r["et0_mm"] for r in righe) / max(len(righe), 1),
             max((r["t_max"] for r in righe), default=0)))


if __name__ == "__main__":
    main()
