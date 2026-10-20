#!/usr/bin/env python3
"""Esegue uno scenario del sistema virtuale e produce registro CSV e rapporto HTML.

Uso (dalla radice del repository):
  python3 -m sistema.simula --elenco
  python3 -m sistema.simula normale
  python3 -m sistema.simula nubifragio --rapporto rapporto.html --csv registro.csv
  python3 -m sistema.simula normale --parametri '{"soglia_on": 0.5, "max_min": 8}'
  python3 -m sistema.simula normale --zone '[{"nome":"pomodori","area_m2":2,"kc":1.15}]' --portata 1.5
  python3 -m sistema.simula normale --meteo meteo.csv     -> meteo reale (strumenti/scarica_meteo.py)
  python3 -m sistema.simula tutti                         -> tabella riassuntiva di tutti gli scenari
  python3 -m sistema.soluzioni                            -> problemi e soluzioni a confronto (SOLUZIONI.md)
"""
import argparse
import csv
import json
import sys

from .controllo import Controllore
from .modello import Mondo, meteo_sintetico, leggi_meteo_csv, STRESS, ASFISSIA_ORE
from .scenari import SCENARI, ZONE_BASE
from .rapporto import scrivi_rapporto

CAMPI_MONDO = ("serbatoio_l", "capacita_serbatoio_l", "tetto_m2", "sensore_livello", "flussimetro", "sensore_pioggia",
               "quadro_altezza_mm", "sensore_allagamento_mm", "energia", "guasti")


def prepara(nome, modifiche=None, zone=None, meteo_csv=None):
    """Scenario + modifiche (per provare le soluzioni) -> configurazione completa."""
    sc = dict(SCENARI[nome])
    for k, v in (modifiche or {}).items():
        if k == "zone" and isinstance(v, dict) and isinstance(sc.get("zone"), dict):
            unite = {i: dict(d) for i, d in sc["zone"].items()}
            for i, d in v.items():
                unite.setdefault(i, {}).update(d)
            sc["zone"] = unite
        elif k == "parametri":
            sc["parametri"] = dict(sc.get("parametri", {}), **v)
        else:
            sc[k] = v
    base = [dict(z) for z in (zone or ZONE_BASE)]
    if isinstance(sc.get("zone"), list):
        base = [dict(z) for z in sc["zone"]]
    elif isinstance(sc.get("zone"), dict):
        for i, d in sc["zone"].items():
            if i < len(base):
                base[i].update(d)
    sc["zone_finali"] = base
    if meteo_csv:
        meteo = leggi_meteo_csv(meteo_csv)
        sc["giorni"] = len(meteo)
    else:
        meteo = meteo_sintetico(sc["mese"], sc["giorni"], sc.get("seme", 1))
        if sc.get("meteo"):
            sc["meteo"](meteo)
    sc["meteo_finale"] = meteo
    return sc


def esegui(nome, parametri=None, zone=None, portata=1.0, modifiche=None, meteo_csv=None, registra_ogni=10):
    sc = prepara(nome, modifiche, zone, meteo_csv)
    zone = sc["zone_finali"]
    n = len(zone)
    par = dict(sc.get("parametri", {}), **(parametri or {}))
    par.setdefault("portata_nominale_l_min", portata)
    kw = {k: sc[k] for k in CAMPI_MONDO if k in sc}
    mondo = Mondo(zone, sc["meteo_finale"], seme=sc.get("seme", 1), portata_l_min=portata, **kw)
    con_memoria = sc.get("memoria", True)
    memoria = {} if con_memoria else None
    interruzioni = sc.get("interruzioni", [])
    brownout = sc.get("riavvio_su_avvio_pompa", False)

    spento = [{"pompa": False, "valvole": [False] * n, "umidita": [None] * n, "allarmi": [], "stato": ["spento"] * n}]
    ctrl, acceso_prima, pompa_prima, riavvio_fino = None, False, False, -1
    righe, eventi, attivi = [], [], set()
    ore_stress, ore_ristagno, ore_asfissia, ristagno_di_fila = [0] * n, [0] * n, [0] * n, [0] * n
    pompa_dopo_riavvio = minuti_spento = riavvii = gelo_irriga_min = 0
    quadro_distrutto = False
    avvii_pompa = []
    batteria_min = 1.0
    for m in range(sc["giorni"] * 1440):
        rete = not any(a <= m < a + d for a, d in interruzioni)
        if mondo.quadro_sommerso_min > 0 and not quadro_distrutto:
            quadro_distrutto = True
            eventi.append((m, "QUADRO_SOMMERSO", "acqua nell'elettronica: ESP32 e relè da sostituire"))
        acceso = rete and mondo.alimentato() and not quadro_distrutto and m >= riavvio_fino
        if acceso and not acceso_prima:
            if ctrl is not None:
                riavvii += 1
            ctrl = Controllore(n, par, memoria)
            if con_memoria:
                memoria = ctrl.memoria()
        elif not acceso and acceso_prima:
            eventi.append((m, "SPENTO", "senza corrente" if not rete or not mondo.alimentato() else "riavvio"))
        if acceso:
            letture = mondo.letture(m)
            out = ctrl.passo(letture)
            if con_memoria and ctrl.memoria_cambiata:
                memoria = ctrl.memoria()
            if not acceso_prima and out["pompa"] and riavvii:
                pompa_dopo_riavvio += 1
            if out["pompa"] and not pompa_prima:
                avvii_pompa.append((m, out["valvole"].index(True)))
            if brownout and out["pompa"] and not pompa_prima:
                riavvio_fino = m + 2          # la pompa parte, la tensione cala, l'ESP32 riparte fra 2 minuti
            if out["pompa"] and letture["temp_c"] <= 2.0:
                gelo_irriga_min += 1
        else:
            out = spento[0]
            minuti_spento += 1
        acceso_prima, pompa_prima = acceso, out["pompa"]
        mondo.avanza(m, out, alimentato=acceso)
        if mondo.energia:
            batteria_min = min(batteria_min, mondo.energia["carica"])
        nuovi = set(out["allarmi"])
        for a in sorted(nuovi - attivi):
            eventi.append((m, a, "comparso"))
        for a in sorted(attivi - nuovi):
            eventi.append((m, a, "rientrato"))
        attivi = nuovi
        if m % 60 == 0:
            for i, (u, r) in enumerate(zip(mondo.umidita_vera(), mondo.in_ristagno())):
                ore_stress[i] += u < STRESS
                ore_ristagno[i] += r
                ristagno_di_fila[i] = ristagno_di_fila[i] + 1 if r else 0
                ore_asfissia[i] += ristagno_di_fila[i] > ASFISSIA_ORE
        if m % registra_ogni == 0:
            riga = {"minuto": m, "giorno": m // 1440 + 1, "ora": "%02d:%02d" % (m % 1440 // 60, m % 60),
                    "serbatoio_l": round(mondo.serbatoio, 1), "pompa": int(out["pompa"]),
                    "acqua_a_terra_mm": round(mondo.livello_acqua_a_terra(), 1)}
            if mondo.energia:
                riga["batteria"] = round(mondo.energia["carica"], 3)
            for i, u in enumerate(mondo.umidita_vera()):
                riga["u%d_vera" % (i + 1)] = round(u, 3)
            for i, u in enumerate(out["umidita"]):
                riga["u%d_letta" % (i + 1)] = None if u is None else round(u, 3)
            for i, s in enumerate(out["stato"]):
                riga["stato%d" % (i + 1)] = s
            riga["allarmi"] = " ".join(out["allarmi"])
            righe.append(riga)
    giorno_cisterna_bassa = next((m // 1440 + 1 for m, a, c in eventi if a == "SERBATOIO_BASSO" and c == "comparso"),
                                 None)
    return {
        "nome": nome, "descrizione": sc["descrizione"], "zone": zone, "righe": righe, "eventi": eventi,
        "ore_stress": ore_stress, "ore_ristagno": ore_ristagno, "ore_asfissia": ore_asfissia,
        "litri": mondo.litri_usati, "litri_persi": mondo.litri_persi, "troppo_pieno_l": mondo.troppo_pieno_l,
        "pompa_minuti": mondo.pompa_minuti, "minuti_a_secco": mondo.minuti_a_secco,
        "pompa_dopo_riavvio": pompa_dopo_riavvio, "serbatoio_finale": mondo.serbatoio,
        "capacita_serbatoio": mondo.capacita, "minuti_spento": minuti_spento, "riavvii": riavvii,
        "quadro_distrutto": quadro_distrutto, "gelo_irriga_min": gelo_irriga_min,
        "batteria_min": batteria_min if mondo.energia else None, "giorno_cisterna_bassa": giorno_cisterna_bassa,
        "avvii_pompa": avvii_pompa,
        "allarmi_visti": sorted({e[1] for e in eventi if e[2] == "comparso"}),
    }


def stampa(r):
    print("%s – %s" % (r["nome"], r["descrizione"]))
    for i, z in enumerate(r["zone"]):
        print("  zona %d %-9s ore in sofferenza %4d   ore di ristagno %4d   ore di asfissia radici %4d"
              % (i + 1, z["nome"], r["ore_stress"][i], r["ore_ristagno"][i], r["ore_asfissia"][i]))
    print("  acqua usata %.0f L (persa %.0f L), pompa %d min, a secco %d min, cisterna finale %.0f L, troppo pieno %.0f L"
          % (r["litri"], r["litri_persi"], r["pompa_minuti"], r["minuti_a_secco"], r["serbatoio_finale"],
             r["troppo_pieno_l"]))
    print("  ESP32 spento %d min, riavvii %d%s%s" % (
        r["minuti_spento"], r["riavvii"], ", QUADRO DISTRUTTO DALL'ACQUA" if r["quadro_distrutto"] else "",
        "" if r["batteria_min"] is None else ", batteria minima %.0f%%" % (r["batteria_min"] * 100)))
    print("  allarmi: %s" % (", ".join(r["allarmi_visti"]) or "nessuno"))
    for m, a, cosa in r["eventi"][:12]:
        print("    giorno %d %02d:%02d  %-18s %s" % (m // 1440 + 1, m % 1440 // 60, m % 60, a, cosa))
    if len(r["eventi"]) > 12:
        print("    ... altri %d eventi nel rapporto" % (len(r["eventi"]) - 12))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("scenario", nargs="?", default="normale")
    ap.add_argument("--elenco", action="store_true", help="mostra gli scenari disponibili")
    ap.add_argument("--parametri", help="JSON con i parametri del controllore da cambiare")
    ap.add_argument("--zone", help='JSON: [{"nome":..., "area_m2":..., "kc":...}, ...] (default 2 zone di prova)')
    ap.add_argument("--portata", type=float, default=1.0, help="L/min che arrivano alla zona che irriga")
    ap.add_argument("--meteo", help="CSV con meteo reale (giorni, et0_mm, pioggia_mm, t_min, t_max)")
    ap.add_argument("--rapporto", help="file HTML con grafici ed eventi")
    ap.add_argument("--csv", help="registro ogni 10 minuti")
    a = ap.parse_args()
    if a.elenco:
        for n, s in SCENARI.items():
            print("%-26s %s" % (n, s["descrizione"]))
        return
    parametri = json.loads(a.parametri) if a.parametri else None
    zone = json.loads(a.zone) if a.zone else None
    if zone:
        for z in zone:
            z.setdefault("nome", "zona")
    if a.scenario == "tutti":
        print("%-26s %6s %6s %6s %6s %6s %6s  %s" % ("scenario", "soff.h", "rist.h", "asfis", "litri", "persi",
                                                     "spento", "allarmi"))
        for n in SCENARI:
            r = esegui(n, parametri, zone, a.portata, meteo_csv=a.meteo)
            print("%-26s %6d %6d %6d %6.0f %6.0f %6d  %s%s" % (
                n, sum(r["ore_stress"]), sum(r["ore_ristagno"]), sum(r["ore_asfissia"]), r["litri"], r["litri_persi"],
                r["minuti_spento"], ", ".join(r["allarmi_visti"]) or "-",
                "  QUADRO DISTRUTTO" if r["quadro_distrutto"] else ""))
        return
    if a.scenario not in SCENARI:
        sys.exit("Scenario sconosciuto: %s (usa --elenco)" % a.scenario)
    r = esegui(a.scenario, parametri, zone, a.portata, meteo_csv=a.meteo)
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
