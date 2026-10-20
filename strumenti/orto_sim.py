#!/usr/bin/env python3
"""Strumenti per l'orto tecnologico partendo da zero: piano colture, simulazione irrigazione e registro.

Non serve nessun hardware e nessuna libreria esterna (solo Python 3). Serve a imparare e a decidere PRIMA di spendere.
La simulazione qui è la versione semplice (1 zona, solo isteresi e tempo massimo); il sistema completo con più zone,
cisterna, sicurezze e guasti è in `sistema/` (python3 -m sistema.simula) e la sua logica gira uguale sull'ESP32.

Uso:
  python3 orto_sim.py piano --mese 4 [--spazio balcone|terreno]      -> cosa seminare/trapiantare questo mese
  python3 orto_sim.py simula --mese 7 --giorni 30 [--area 2] [--seme 1] [--meteo meteo.csv]
                                                                     -> confronto timer fisso / controllo con sensore
  python3 orto_sim.py registro aggiungi --attivita raccolto --coltura pomodoro --kg 1.2 [--euro 0] [--note ...]
  python3 orto_sim.py registro riepilogo                             -> totali per coltura (kg, spese, ricavi)

Il modello del terreno è un "secchio": acqua disponibile in mm (0 = appassimento, CAPACITA = terreno saturo), consumo
= ET0 x Kc nelle ore di luce, pioggia ed irrigazione che riempiono, eccesso perso per drenaggio. È un'approssimazione
didattica: i valori veri vanno tarati con il sensore e con l'osservazione delle piante.
Il file meteo facoltativo è un CSV con colonne: giorno,et0_mm,pioggia_mm (una riga per giorno).
"""
import argparse, csv, datetime, os, random, sys

# Valori medi indicativi per l'Italia centro-meridionale (mm/giorno di ET0, probabilità e mm medi di pioggia).
ET0_MESE = {1: 1.0, 2: 1.5, 3: 2.5, 4: 3.5, 5: 4.5, 6: 5.5, 7: 6.0, 8: 5.5, 9: 4.0, 10: 2.5, 11: 1.5, 12: 1.0}
PIOGGIA_MESE = {1: (0.35, 8), 2: (0.33, 8), 3: (0.30, 7), 4: (0.30, 7), 5: (0.22, 6), 6: (0.12, 6), 7: (0.06, 6),
                8: (0.08, 8), 9: (0.18, 9), 10: (0.28, 10), 11: (0.35, 10), 12: (0.37, 9)}

# coltura: mesi di semina/trapianto, giorni al raccolto, Kc medio, spazio adatto, si parte gratis da scarti/semi di casa?
COLTURE = {
    "lattuga":        ([2, 3, 4, 5, 8, 9, 10], 50, 1.00, "balcone", "semi da una pianta lasciata andare a seme"),
    "rucola":         ([3, 4, 5, 9, 10], 35, 1.00, "balcone", "semi molto economici, si risemina da sola"),
    "ravanello":      ([2, 3, 4, 5, 9, 10], 30, 0.90, "balcone", "semi economici; il più veloce, ottimo per imparare"),
    "microgreens":    (list(range(1, 13)), 10, 1.00, "balcone", "semi di senape, rucola, girasole; si vendono bene"),
    "basilico":       ([4, 5, 6], 60, 1.00, "balcone", "talee da un mazzo comprato: radicano in acqua in 7-10 giorni"),
    "pomodoro":       ([3, 4, 5], 90, 1.15, "balcone", "semi da un pomodoro maturo (varietà non ibride)"),
    "peperoncino":    ([2, 3, 4], 110, 1.05, "balcone", "semi da peperoncini secchi"),
    "zucchina":       ([4, 5, 6], 55, 1.00, "terreno", "semi da zucchina lasciata maturare"),
    "fagiolo":        ([4, 5, 6, 7], 70, 1.05, "terreno", "fagioli secchi da dispensa (non trattati)"),
    "patata":         ([2, 3, 4, 8], 100, 1.10, "terreno", "patate germogliate di casa"),
    "aglio":          ([10, 11, 12, 1], 210, 0.95, "balcone", "spicchi di aglio di casa"),
    "cipollotto":     (list(range(1, 13)), 30, 1.00, "balcone", "ricresce dalla base con le radici in acqua o terra"),
    "fava":           ([10, 11], 180, 1.05, "terreno", "fave secche; arricchisce il terreno di azoto"),
    "spinacio":       ([2, 3, 9, 10], 45, 1.00, "balcone", "semi economici"),
}

CAPACITA_MM = 60.0          # acqua disponibile massima nello strato delle radici (terreno medio, ~30 cm)
STRESS = 0.30               # sotto il 30% della capacità la pianta soffre
ECCESSO = 0.95              # sopra il 95% c'è rischio di ristagno e marciumi


def piano(mese, spazio):
    adatte = [(n, c) for n, c in COLTURE.items() if mese in c[0] and (spazio == "terreno" or c[3] == "balcone")]
    if not adatte:
        print("Nessuna coltura in tabella per questo mese: usa il tempo per il compost e per preparare i contenitori.")
        return
    oggi = datetime.date.today()
    inizio = datetime.date(oggi.year + (mese < oggi.month), mese, 15)   # metà del mese scelto, quest'anno o il prossimo
    print(f"Mese {mese} – spazio: {spazio}. Ordinate dalla più veloce:\n")
    for nome, (_, giorni, _, _, gratis) in sorted(adatte, key=lambda x: x[1][1]):
        print(f"- {nome:<12} raccolto in ~{giorni:>3} giorni (seminando il {inizio:%d/%m}: dal {inizio + datetime.timedelta(days=giorni):%d/%m})"
              f" – a costo zero: {gratis}")


def meteo_sintetico(mese, giorni, seme):
    rnd = random.Random(seme)
    p, mm = PIOGGIA_MESE[mese]
    righe = []
    for g in range(giorni):
        et0 = max(0.3, rnd.gauss(ET0_MESE[mese], ET0_MESE[mese] * 0.15))
        pioggia = rnd.expovariate(1 / mm) if rnd.random() < p else 0.0
        righe.append((et0, pioggia))
    return righe


def leggi_meteo(percorso):
    with open(percorso, newline="", encoding="utf-8") as f:
        return [(float(r["et0_mm"]), float(r["pioggia_mm"])) for r in csv.DictReader(f)]


class Controllo:
    """Stessa logica del firmware: accende sotto soglia_on, spegne sopra soglia_off, tempo massimo, pausa minima."""

    def __init__(self, soglia_on=0.45, soglia_off=0.70, max_min=10, pausa_min=60):
        self.soglia_on, self.soglia_off = soglia_on, soglia_off
        self.max_min, self.pausa_min = max_min, pausa_min
        self.acceso, self.min_acceso, self.min_da_ultimo = False, 0, pausa_min

    def passo(self, umidita, pioggia_prevista_mm):
        """Chiamato ogni minuto con l'umidità 0..1; restituisce True se la pompa deve essere accesa."""
        self.min_da_ultimo += 1
        if self.acceso:
            self.min_acceso += 1
            if umidita >= self.soglia_off or self.min_acceso >= self.max_min:
                self.acceso, self.min_da_ultimo = False, 0
        elif umidita < self.soglia_on and self.min_da_ultimo >= self.pausa_min and pioggia_prevista_mm < 3:
            self.acceso, self.min_acceso = True, 0
        return self.acceso


def simula(meteo, area_m2, portata_l_min, kc, strategia):
    acqua = CAPACITA_MM * 0.6
    litri = ore_stress = ore_eccesso = 0.0
    ctrl = Controllo()
    for g, (et0, pioggia) in enumerate(meteo):
        domani = meteo[g + 1][1] if g + 1 < len(meteo) else 0.0   # previsione "perfetta" del giorno dopo
        for minuto in range(24 * 60):
            ora = minuto // 60
            if 7 <= ora < 19:
                acqua -= et0 * kc / (12 * 60)
            if ora == 15 and minuto % 60 == 0:
                acqua += pioggia
            if strategia == "timer":
                pompa = ora == 7 and minuto % 60 < 10          # 10 minuti ogni mattina, piova o no
            else:
                pompa = ctrl.passo(acqua / CAPACITA_MM, domani if ora >= 12 else pioggia)
            if pompa:
                litri += portata_l_min
                acqua += portata_l_min / area_m2              # 1 litro su 1 m² = 1 mm
            acqua = min(max(acqua, 0.0), CAPACITA_MM)
            if minuto % 60 == 0:
                u = acqua / CAPACITA_MM
                ore_stress += u < STRESS
                ore_eccesso += u > ECCESSO
    return litri, ore_stress, ore_eccesso


def cmd_simula(a):
    meteo = leggi_meteo(a.meteo) if a.meteo else meteo_sintetico(a.mese, a.giorni, a.seme)
    kc = COLTURE[a.coltura][2]
    pioggia_tot = sum(p for _, p in meteo)
    print(f"{len(meteo)} giorni, coltura {a.coltura} (Kc {kc}), area {a.area} m², pompa {a.portata} L/min, "
          f"pioggia totale {pioggia_tot:.0f} mm\n")
    print(f"{'strategia':<22}{'litri':>8}{'ore stress':>12}{'ore ristagno':>14}")
    risultati = {}
    for s, nome in (("timer", "timer fisso 10 min/gg"), ("sensore", "sensore + isteresi")):
        risultati[s] = simula(meteo, a.area, a.portata, kc, s)
        l, st, ec = risultati[s]
        print(f"{nome:<22}{l:>8.0f}{st:>12.0f}{ec:>14.0f}")
    lt, ls = risultati["timer"][0], risultati["sensore"][0]
    if lt > 0:
        print(f"\nAcqua risparmiata dal controllo con sensore: {(lt - ls) / lt * 100:.0f}% "
              f"(negativo = il timer dava troppo poca acqua)")


REGISTRO = os.path.join(os.getcwd(), "registro_orto.csv")
CAMPI = ["data", "attivita", "coltura", "kg", "euro", "note"]


def cmd_registro(a):
    if a.azione == "aggiungi":
        nuovo = not os.path.exists(REGISTRO)
        with open(REGISTRO, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, CAMPI)
            if nuovo:
                w.writeheader()
            w.writerow({"data": datetime.date.today().isoformat(), "attivita": a.attivita, "coltura": a.coltura,
                        "kg": a.kg, "euro": a.euro, "note": a.note})
        print(f"Registrato in {REGISTRO}")
        return
    if not os.path.exists(REGISTRO):
        sys.exit(f"Nessun registro in {REGISTRO}: aggiungi prima una riga.")
    tot = {}
    with open(REGISTRO, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            t = tot.setdefault(r["coltura"] or "(generale)", {"kg": 0.0, "spese": 0.0, "ricavi": 0.0})
            t["kg"] += float(r["kg"] or 0) if r["attivita"] == "raccolto" else 0
            euro = float(r["euro"] or 0)
            t["spese" if r["attivita"] == "spesa" else "ricavi"] += euro if r["attivita"] in ("spesa", "vendita") else 0
    print(f"{'coltura':<14}{'kg raccolti':>12}{'spese €':>10}{'ricavi €':>10}")
    for c, t in sorted(tot.items()):
        print(f"{c:<14}{t['kg']:>12.1f}{t['spese']:>10.2f}{t['ricavi']:>10.2f}")
    print(f"{'TOTALE':<14}{sum(t['kg'] for t in tot.values()):>12.1f}{sum(t['spese'] for t in tot.values()):>10.2f}"
          f"{sum(t['ricavi'] for t in tot.values()):>10.2f}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    pp = sub.add_parser("piano")
    pp.add_argument("--mese", type=int, default=datetime.date.today().month, choices=range(1, 13))
    pp.add_argument("--spazio", choices=["balcone", "terreno"], default="balcone")
    ps = sub.add_parser("simula")
    ps.add_argument("--mese", type=int, default=7, choices=range(1, 13))
    ps.add_argument("--giorni", type=int, default=30)
    ps.add_argument("--area", type=float, default=2.0, help="m² irrigati")
    ps.add_argument("--portata", type=float, default=1.0, help="L/min della pompa o del gocciolatoio")
    ps.add_argument("--coltura", choices=sorted(COLTURE), default="pomodoro")
    ps.add_argument("--seme", type=int, default=1, help="cambia il meteo sintetico")
    ps.add_argument("--meteo", help="CSV giorno,et0_mm,pioggia_mm (es. scaricato da Open-Meteo)")
    pr = sub.add_parser("registro")
    pr.add_argument("azione", choices=["aggiungi", "riepilogo"])
    pr.add_argument("--attivita", choices=["semina", "trapianto", "raccolto", "spesa", "vendita", "nota"], default="nota")
    pr.add_argument("--coltura", default="")
    pr.add_argument("--kg", type=float, default=0.0)
    pr.add_argument("--euro", type=float, default=0.0)
    pr.add_argument("--note", default="")
    a = p.parse_args()
    if a.cmd == "piano":
        piano(a.mese, a.spazio)
    elif a.cmd == "simula":
        cmd_simula(a)
    else:
        cmd_registro(a)


if __name__ == "__main__":
    main()
