#!/usr/bin/env python3
"""Esegue uno scenario del sistema virtuale e produce registro CSV e rapporto HTML.

Uso (dalla radice del repository):
  python3 -m sistema.simula --elenco
  python3 -m sistema.simula normale
  python3 -m sistema.simula tubo_rotto --rapporto rapporto.html --csv registro.csv
  python3 -m sistema.simula normale --parametri '{"soglia_on": 0.5, "max_min": 8}'
  python3 -m sistema.simula tutti                      -> tabella riassuntiva di tutti gli scenari
  python3 -m sistema.simula normale --zone '[{"nome":"pomodori","area_m2":2,"kc":1.15}]' --portata 1.5
"""
import argparse
import csv
import json
import sys

from .controllo import Controllore
from .modello import Mondo, meteo_sintetico, STRESS, RISTAGNO
from .scenari import SCENARI, ZONE_BASE
from .rapporto import scrivi_rapporto


def esegui(nome, parametri=None, zone=None, portata=1.0, registra_ogni=10):
    sc = SCENARI[nome]
    zone = zone or ZONE_BASE
    meteo = meteo_sintetico(sc["mese"], sc["giorni"], sc.get("seme", 1))
    if "temp_media" in sc:
        for g in meteo:
            g["t_media"] = sc["temp_media"]
    mondo = Mondo(zone, meteo, serbatoio_l=sc.get("serbatoio_l", 800.0), guasti=sc.get("guasti"),
                  sensore_livello=sc.get("sensore_livello", True), seme=sc.get("seme", 1),
                  portata_l_min=portata)
    ctrl = Controllore(len(zone), parametri)
    riavvii = set(sc.get("riavvii", []))
    righe, eventi, attivi = [], [], set()
    ore_stress = [0] * len(zone)
    ore_ristagno = [0] * len(zone)
    pompa_dopo_riavvio = 0
    spento_fino = -1
    for m in range(sc["giorni"] * 1440):
        if m in riavvii:
            eventi.append((m, "RIAVVIO", "mancanza di corrente per 2 minuti"))
            spento_fino = m + 2
            ctrl = Controllore(len(zone), parametri)   # il controllore riparte da zero, come l'ESP32
        if m < spento_fino:
            out = {"pompa": False, "valvole": [False] * len(zone), "umidita": [None] * len(zone),
                   "allarmi": [], "stato": ["spento"] * len(zone)}
        else:
            out = ctrl.passo(mondo.letture(m))
            if m == spento_fino and out["pompa"]:
                pompa_dopo_riavvio += 1
        mondo.avanza(m, out)
        nuovi = set(out["allarmi"])
        for a in sorted(nuovi - attivi):
            eventi.append((m, a, "comparso"))
        for a in sorted(attivi - nuovi):
            eventi.append((m, a, "rientrato"))
        attivi = nuovi
        if m % 60 == 0:
            for i, u in enumerate(mondo.umidita_vera()):
                ore_stress[i] += u < STRESS
                ore_ristagno[i] += u > RISTAGNO
        if m % registra_ogni == 0:
            righe.append({"minuto": m, "giorno": m // 1440 + 1, "ora": "%02d:%02d" % (m % 1440 // 60, m % 60),
                          "serbatoio_l": round(mondo.serbatoio, 1), "pompa": int(out["pompa"]),
                          **{"u%d_vera" % (i + 1): round(u, 3) for i, u in enumerate(mondo.umidita_vera())},
                          **{"u%d_letta" % (i + 1): (None if u is None else round(u, 3))
                             for i, u in enumerate(out["umidita"])},
                          **{"stato%d" % (i + 1): s for i, s in enumerate(out["stato"])},
                          "allarmi": " ".join(out["allarmi"])})
    return {
        "nome": nome, "descrizione": sc["descrizione"], "zone": zone, "righe": righe, "eventi": eventi,
        "ore_stress": ore_stress, "ore_ristagno": ore_ristagno, "litri": mondo.litri_usati,
        "pompa_minuti": mondo.pompa_minuti, "minuti_a_secco": mondo.minuti_a_secco,
        "pompa_dopo_riavvio": pompa_dopo_riavvio, "serbatoio_finale": mondo.serbatoio,
        "capacita_serbatoio": mondo.capacita,
        "allarmi_visti": sorted({e[1] for e in eventi if e[2] == "comparso"}),
    }


def stampa(r):
    print("%s – %s" % (r["nome"], r["descrizione"]))
    for i, z in enumerate(r["zone"]):
        print("  zona %d %-9s ore in sofferenza %4d   ore di ristagno %4d"
              % (i + 1, z["nome"], r["ore_stress"][i], r["ore_ristagno"][i]))
    print("  acqua usata %.0f L, pompa %d min, pompa a secco %d min, serbatoio finale %.0f L"
          % (r["litri"], r["pompa_minuti"], r["minuti_a_secco"], r["serbatoio_finale"]))
    print("  allarmi: %s" % (", ".join(r["allarmi_visti"]) or "nessuno"))
    for m, a, cosa in r["eventi"][:12]:
        print("    giorno %d %02d:%02d  %-16s %s" % (m // 1440 + 1, m % 1440 // 60, m % 60, a, cosa))
    if len(r["eventi"]) > 12:
        print("    ... altri %d eventi nel rapporto" % (len(r["eventi"]) - 12))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("scenario", nargs="?", default="normale")
    ap.add_argument("--elenco", action="store_true", help="mostra gli scenari disponibili")
    ap.add_argument("--parametri", help="JSON con i parametri del controllore da cambiare")
    ap.add_argument("--zone", help='JSON: [{"nome":..., "area_m2":..., "kc":...}, ...] (default 2 zone di prova)')
    ap.add_argument("--portata", type=float, default=1.0, help="L/min che arrivano alla zona che irriga")
    ap.add_argument("--rapporto", help="file HTML con grafici ed eventi")
    ap.add_argument("--csv", help="registro ogni 10 minuti")
    a = ap.parse_args()
    if a.elenco:
        for n, s in SCENARI.items():
            print("%-27s %s" % (n, s["descrizione"]))
        return
    parametri = json.loads(a.parametri) if a.parametri else None
    zone = json.loads(a.zone) if a.zone else None
    if zone:
        for z in zone:
            z.setdefault("nome", "zona")
    if a.scenario == "tutti":
        print("%-27s %8s %8s %7s %6s  %s" % ("scenario", "soffer.h", "ristag.h", "litri", "secco", "allarmi"))
        for n in SCENARI:
            r = esegui(n, parametri, zone, a.portata)
            print("%-27s %8d %8d %7.0f %6d  %s" % (n, sum(r["ore_stress"]), sum(r["ore_ristagno"]), r["litri"],
                                                   r["minuti_a_secco"], ", ".join(r["allarmi_visti"]) or "-"))
        return
    if a.scenario not in SCENARI:
        sys.exit("Scenario sconosciuto: %s (usa --elenco)" % a.scenario)
    r = esegui(a.scenario, parametri, zone, a.portata)
    stampa(r)
    if a.csv:
        with open(a.csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, list(r["righe"][0]))
            w.writeheader()
            w.writerows(r["righe"])
        print("Registro: %s" % a.csv)
    if a.rapporto:
        scrivi_rapporto(r, a.rapporto)
        print("Rapporto: %s (aprilo con il browser)" % a.rapporto)


if __name__ == "__main__":
    main()
