#!/usr/bin/env python3
"""Problemi e soluzioni a confronto: ogni problema (meteo, corrente, allagamento, guasti) è simulato senza e con la
soluzione, e i risultati vanno in SOLUZIONI.md. Così si sceglie cosa comprare o costruire con i numeri, non a occhio.

Uso (dalla radice del repository):
  python3 -m sistema.soluzioni                 -> scrive SOLUZIONI.md
  python3 -m sistema.soluzioni --solo nubifragio
"""
import argparse

from .simula import esegui

RIALZATE = {0: {"drenaggio_mm_h": 15.0}, 1: {"drenaggio_mm_h": 15.0}}
PACCIAMATE = {0: {"pacciamatura": True}, 1: {"pacciamatura": True}}


def ore(x):
    return "%.0f" % x


def metriche(r, chiavi, guasto_dal=None, allarme=None, zona=None):
    valori = {
        "sofferenza h": ore(sum(r["ore_stress"])),
        "ristagno h": ore(sum(r["ore_ristagno"])),
        "radici senza ossigeno h": ore(sum(r["ore_asfissia"])),
        "acqua L": ore(r["litri"]),
        "acqua persa L": ore(r["litri_persi"]),
        "troppo pieno L": ore(r["troppo_pieno_l"]),
        "ESP32 spento h": "%.1f" % (r["minuti_spento"] / 60),
        "riavvii": str(r["riavvii"]),
        "quadro": "DISTRUTTO" if r["quadro_distrutto"] else "salvo",
        "irrigazione col gelo min": str(r["gelo_irriga_min"]),
        "cisterna al minimo dal giorno": str(r["giorno_cisterna_bassa"] or "mai"),
        "batteria minima": "-" if r["batteria_min"] is None else "%.0f%%" % (r["batteria_min"] * 100),
    }
    if allarme:
        # tempo tra la prima partenza della pompa dopo il guasto e l'allarme
        primo = next((m for m, a, c in r["eventi"] if a == allarme and c == "comparso"), None)
        avvio = next((m for m, z in r["avvii_pompa"] if m >= (guasto_dal or 0) and zona in (None, z)), None)
        valori["allarme dopo"] = ("mai" if primo is None or avvio is None
                                  else "%d min dall'avvio" % max(0, primo - avvio) if primo - avvio < 120
                                  else "%.1f ore" % ((primo - avvio) / 60))
    return [valori[k] for k in chiavi]


CASI = [
    {"id": "nubifragio", "titolo": "Nubifragio su terreno argilloso", "scenario": "nubifragio",
     "problema": "90 mm in 3 ore su un terreno che drena 2 mm/ora: l'acqua resta ferma sulle aiuole per giorni e le "
                 "radici restano senza ossigeno. Il sistema non irriga (giusto) e avvisa con Zx_ALLAGATA, ma "
                 "l'elettronica non può togliere l'acqua: la soluzione è nel terreno.",
     "metriche": ["ristagno h", "radici senza ossigeno h", "troppo pieno L"],
     "varianti": [("Aiuole a terra, argilla (2 mm/ora)", {}),
                  ("Aiuole rialzate 20-30 cm con compost (15 mm/ora)", {"zone": RIALZATE})],
     "soluzione": "Aiuole rialzate 20-30 cm (terra + compost + sabbia) e un solco di scolo ai lati verso il punto più "
                  "basso. Il troppo pieno della cisterna va portato con un tubo lontano da aiuole e quadro.",
     "costo": "0-10 € (compost fatto in casa, terra di scavo, un tubo per il troppo pieno)"},
    {"id": "quadro_allagato", "titolo": "Acqua nel quadro elettrico", "scenario": "quadro_allagato",
     "problema": "Con il quadro appoggiato a terra l'acqua ferma del nubifragio arriva all'elettronica: ESP32 e relè "
                 "da buttare, impianto fermo finché non si ricompra e si rimonta tutto.",
     "metriche": ["quadro", "ESP32 spento h", "radici senza ossigeno h"],
     "varianti": [("Quadro a 5 cm da terra", {}),
                  ("Quadro a 5 cm, aiuole rialzate", {"zone": RIALZATE}),
                  ("Quadro a 50 cm su palo + sensore allagamento", {"quadro_altezza_mm": 500.0})],
     "soluzione": "Quadro stagno IP65 fissato a 50 cm o più da terra (palo, muro), pressacavi verso il basso, sensore "
                  "di acqua sul fondo del quadro (allarme ALLAGAMENTO_QUADRO e pompa ferma). Qui anche le sole aiuole "
                  "rialzate salvano il quadro, perché l'acqua ferma resta sotto i 5 cm; con un temporale più forte o "
                  "un terreno in conca no: il quadro in alto è la protezione certa, le aiuole salvano le radici.",
     "costo": "5-10 € (palo o staffa, sensore di acqua 1-2 €)"},
    {"id": "pioggia_persistente", "titolo": "Due settimane di pioggia", "scenario": "pioggia_persistente",
     "problema": "12 giorni di pioggia (30 mm al giorno) su terreno pesante e compattato: ristagno quasi continuo, marciumi.",
     "metriche": ["ristagno h", "radici senza ossigeno h", "acqua L"],
     "varianti": [("Terreno pesante (1 mm/ora)", {}),
                  ("Aiuole rialzate (15 mm/ora)", {"zone": RIALZATE})],
     "soluzione": "Aiuole rialzate e scoli come per il nubifragio; nei mesi piovosi colture che sopportano l'umido. "
                  "Il sistema non irriga mai durante la pioggia e avvisa se una zona resta satura oltre 6 ore.",
     "costo": "0-10 €"},
    {"id": "previsione_sbagliata", "titolo": "Previsione di pioggia sbagliata", "scenario": "previsione_sbagliata",
     "problema": "La previsione annuncia pioggia per 7 giorni ma non piove: se il sistema si fida ciecamente, a "
                 "luglio le piante restano senz'acqua.",
     "metriche": ["sofferenza h", "acqua L"],
     "varianti": [("Si fida sempre della previsione", {"parametri": {"soglia_critica": 0.0}}),
                  ("Soglia critica: irriga comunque sotto il 30%", {})],
     "soluzione": "Già nel controllo: con pioggia prevista non si irriga, ma sotto la soglia critica (30%) si irriga "
                  "lo stesso. La previsione fa risparmiare acqua, non decide mai da sola.",
     "costo": "0 € (parametro soglia_critica)"},
    {"id": "ondata_calore", "titolo": "Ondata di calore", "scenario": "ondata_calore",
     "problema": "10 giorni a 38-39 °C: le piante bevono il 40% in più e la cisterna scende in fretta.",
     "metriche": ["sofferenza h", "acqua L"],
     "varianti": [("Terreno nudo", {}),
                  ("Pacciamatura (paglia, foglie, cartone)", {"zone": PACCIAMATE})],
     "soluzione": "Pacciamatura di 5-10 cm (paglia, sfalci secchi, foglie, cartone): meno evaporazione e terreno più "
                  "fresco. Rete ombreggiante sulle insalate. Il controllo segnala CALDO: controlla le piante.",
     "costo": "0 € (materiale di recupero); rete ombreggiante 5-10 €"},
    {"id": "siccita", "titolo": "Siccità di 60 giorni", "scenario": "siccita",
     "problema": "Due mesi senza pioggia: la cisterna da 1000 L finisce e le ultime settimane le piante soffrono.",
     "metriche": ["cisterna al minimo dal giorno", "sofferenza h", "acqua L"],
     "varianti": [("Terreno nudo, soglie normali", {}),
                  ("Pacciamatura", {"zone": PACCIAMATE}),
                  ("Pacciamatura + risparmio sotto 300 L", {"zone": PACCIAMATE,
                                                            "parametri": {"riserva_l": 300.0}})],
     "soluzione": "Pacciamatura, e soglie di risparmio quando la cisterna scende sotto la riserva (allarme "
                  "SERBATOIO_RISERVA: irriga tra 35% e 55% invece che tra 45% e 70%). Se non basta: seconda cisterna o "
                  "più tetto collegato alla grondaia (1 mm di pioggia su 10 m² = 8 L).",
     "costo": "0 € (pacciamatura, parametro riserva_l); cisterna IBC usata 30-60 €"},
    {"id": "gelata_tardiva", "titolo": "Gelata tardiva", "scenario": "gelata_tardiva",
     "problema": "Terreno asciutto e notti sotto zero: irrigare col gelo fa ghiaccio su foglie e tubi (che possono "
                 "spaccarsi).",
     "metriche": ["irrigazione col gelo min", "sofferenza h"],
     "varianti": [("Irriga anche col gelo", {"parametri": {"blocco_gelo": False}}),
                  ("Blocco irrigazione sotto 2 °C", {})],
     "soluzione": "Già nel controllo: niente irrigazione sotto 2 °C (allarme GELO). In più: tessuto non tessuto sulle "
                  "piantine, svuotare i tubi a fine stagione.",
     "costo": "0 € (parametro blocco_gelo); tessuto non tessuto 3-5 €"},
    {"id": "blackout_lungo", "titolo": "Blackout lungo durante il caldo", "scenario": "blackout_lungo",
     "problema": "Salta la corrente per 72 ore in piena ondata di calore mentre sei via: nessuno se ne accorge.",
     "metriche": ["sofferenza h", "ESP32 spento h"],
     "varianti": [("Blackout 72 ore, nessun avviso", {}),
                  ("Blackout 24 ore (avviso e intervento in giornata)", {"interruzioni": [(5 * 1440 + 480, 24 * 60)]}),
                  ("Batteria tampone / UPS", {"interruzioni": []})],
     "soluzione": "Avviso sul telefono se il nodo non trasmette da 30 minuti (fase 6 del piano: lo fa la centrale, "
                  "non l'ESP32 spento). Il terreno umido regge circa un giorno anche col caldo. Per chi è spesso via: "
                  "batteria tampone 12 V con caricatore, o pannello solare dimensionato (vedi sotto).",
     "costo": "0 € avviso; batteria 12 V 7 Ah + caricatore 20-30 €"},
    {"id": "brownout_pompa", "titolo": "Calo di tensione alla partenza della pompa", "scenario": "brownout_pompa",
     "problema": "Alimentatore debole o cavi sottili: quando parte la pompa la tensione cala e l'ESP32 si riavvia. "
                 "Ogni riavvio azzera tempi e blocchi, la pompa riparte, e con un sensore fuori terra la zona si "
                 "allaga senza che scatti mai un allarme.",
     "metriche": ["ristagno h", "radici senza ossigeno h", "acqua L", "riavvii"],
     "varianti": [("Prima versione del controllo (senza memoria)", {"memoria": False}),
                  ("Memoria + blocco RIAVVII_FREQUENTI", {}),
                  ("Alimentazione corretta (nessun calo)", {"riavvio_su_avvio_pompa": False})],
     "soluzione": "Software (già nel firmware): blocchi e stato della pompa salvati nella memoria dell'ESP32 prima "
                  "di accenderla; dopo 3 riavvii di fila con la pompa accesa tutto si ferma con RIAVVII_FREQUENTI. "
                  "Hardware: alimentatore con margine (pompa + 50%), ESP32 su step-down separato, condensatore "
                  "470-1000 µF sul 5 V, cavi della pompa di sezione adeguata e corti.",
     "costo": "0 € software; condensatore e step-down 2-3 €"},
    {"id": "solare_nuvoloso", "titolo": "Pannello solare e giorni nuvolosi", "scenario": "solare_nuvoloso",
     "problema": "Pannello da 5 W e batteria da 7 Ah: con 6 giorni coperti la batteria si svuota, l'ESP32 si spegne "
                 "e l'orto resta senza controllo proprio in estate.",
     "metriche": ["ESP32 spento h", "sofferenza h", "batteria minima"],
     "varianti": [("5 W / 7 Ah, pompa fino a batteria vuota", {"parametri": {"batteria_min_pompa": 0.0}}),
                  ("5 W / 7 Ah, pompa ferma sotto il 35%", {}),
                  ("20 W / 12 Ah, pompa ferma sotto il 35%",
                   {"energia": {"pannello_w": 20.0, "batteria_wh": 144.0, "carica": 0.8}})],
     "soluzione": "Protezione batteria (già nel controllo: BATTERIA_BASSA, pompa ferma sotto il 35%, l'ESP32 resta "
                  "acceso e avvisa). Dimensionamento: consumo giornaliero = ESP32 ~15 Wh + pompa (W x minuti/60); "
                  "pannello almeno 3-4 volte il consumo diviso le ore di sole del mese peggiore; batteria per 3-4 "
                  "giorni di autonomia. Il simulatore fa il conto: prova le misure con --zone e lo scenario solare.",
     "costo": "pannello 20 W 20-30 €, batteria 12 V 12 Ah 25-35 €, regolatore 8-12 €"},
    {"id": "valvola_bloccata_aperta", "titolo": "Elettrovalvola bloccata aperta", "scenario": "valvola_bloccata_aperta",
     "problema": "Una valvola resta aperta (sporco, molla rotta): ogni volta che si irriga un'altra zona, l'acqua "
                 "finisce anche lì.",
     "metriche": ["ristagno h", "acqua L", "sofferenza h", "allarme dopo"],
     "guasto_dal": 2 * 1440, "allarme": "Z2_ACQUA_INATTESA", "zona": 0,
     "varianti": [("Senza controllo acqua inattesa", {"parametri": {"acqua_inattesa": 0.0}}),
                  ("Con controllo acqua inattesa + sensore pioggia", {}),
                  ("Controllo attivo ma senza sensore pioggia", {"sensore_pioggia": False})],
     "soluzione": "Controllo Zx_ACQUA_INATTESA (già nel controllo): se una zona si bagna senza la sua valvola e senza "
                  "pioggia scatta l'allarme; le altre zone si irrigano solo finché quella non è troppo bagnata, "
                  "così niente allagamento e niente piante a secco finché non pulisci o cambi la valvola. Serve sapere se piove: sensore di pioggia "
                  "(2-5 €) o dati dalla centrale. Filtro a rete prima delle valvole contro lo sporco.",
     "costo": "sensore pioggia 2-5 €, filtro a rete 3-5 €"},
    {"id": "tubo_scoppiato", "titolo": "Tubo scoppiato", "scenario": "tubo_scoppiato",
     "problema": "Un raccordo salta: l'acqua esce a terra al doppio della portata.",
     "metriche": ["acqua persa L", "allarme dopo"], "guasto_dal": 3 * 1440, "allarme": "Z1_INEFFICACE", "zona": 0,
     "varianti": [("Senza flussimetro (se ne accorge l'umidità)", {})],
     "varianti_extra": [("Con flussimetro (allarme Z1_PERDITA)", {"flussimetro": True}, "Z1_PERDITA")],
     "soluzione": "Flussimetro a turbina (tipo YF-S201) dopo la pompa: perdita vista in 2 minuti invece che dopo "
                  "l'irrigazione, e pompa guasta vista anche senza sensore di livello.",
     "costo": "flussimetro 3-6 €"},
    {"id": "pompa_guasta", "titolo": "Pompa guasta", "scenario": "pompa_guasta",
     "problema": "La pompa si rompe: bisogna saperlo subito, non quando le piante appassiscono.",
     "metriche": ["sofferenza h", "allarme dopo"], "guasto_dal": 5 * 1440, "allarme": "POMPA_NON_EROGA",
     "varianti": [("Sensore di livello in cisterna", {}),
                  ("Flussimetro", {"flussimetro": True, "sensore_livello": False})],
     "soluzione": "Basta uno dei due: livello a ultrasuoni (serve anche per la riserva) o flussimetro (più rapido). "
                  "L'avviso sul telefono (fase 6) è quello che salva le piante: il blocco evita solo di peggiorare.",
     "costo": "3-9 €"},
]


def esegui_caso(c):
    righe = []
    for etichetta, mod in c["varianti"]:
        righe.append((etichetta, metriche(esegui(c["scenario"], modifiche=mod), c["metriche"],
                                          c.get("guasto_dal"), c.get("allarme"), c.get("zona"))))
    for etichetta, mod, allarme in c.get("varianti_extra", []):
        righe.append((etichetta, metriche(esegui(c["scenario"], modifiche=mod), c["metriche"],
                                          c.get("guasto_dal"), allarme, c.get("zona"))))
    return righe


def markdown(risultati):
    out = ["# Soluzioni provate in virtuale", "",
           "Documento generato da `python3 -m sistema.soluzioni`: ogni problema è simulato **senza e con la "
           "soluzione** con lo stesso controllo che gira sull'ESP32. I numeri sono del modello didattico (2 zone di "
           "prova, cisterna 1000 L, tetto 10 m²): rifai il confronto con le tue zone e tara il modello con le prove "
           "di campo (COLLAUDO.md, C2). Per uno scenario: `python3 -m sistema.simula <scenario> --rapporto r.html`.",
           "", "Legenda: *sofferenza* = ore con terreno sotto il 30%; *ristagno* = ore con acqua ferma sopra il terreno saturo; "
           "*radici senza ossigeno* = ore di ristagno oltre le prime 24 di fila (danno alla coltura).", ""]
    for c, righe in risultati:
        out += ["## %s" % c["titolo"], "", "**Problema.** %s" % c["problema"], "",
                "| | " + " | ".join(c["metriche"]) + " |", "|---|" + "---|" * len(c["metriche"])]
        out += ["| %s | %s |" % (e, " | ".join(v)) for e, v in righe]
        out += ["", "**Soluzione.** %s" % c["soluzione"], "", "**Costo.** %s" % c["costo"], "",
                "Scenario: `%s`" % c["scenario"], ""]
    out += ["## Cosa fare, in ordine", "",
            "| Priorità | Soluzione | Costo | Contro |",
            "|---|---|---|---|",
            "| 1 | Quadro stagno a 50 cm da terra, pressacavi in basso, sensore acqua nel quadro | 5-10 € | allagamento dell'elettronica |",
            "| 2 | Alimentazione con margine, ESP32 su step-down separato, condensatore sul 5 V | 2-3 € | riavvii alla partenza della pompa |",
            "| 3 | Aiuole rialzate + scoli + troppo pieno della cisterna lontano | 0-10 € | nubifragi, pioggia persistente |",
            "| 4 | Pacciamatura | 0 € | caldo, siccità |",
            "| 5 | Sensore di livello o flussimetro (meglio entrambi) | 3-15 € | pompa guasta, tubi rotti, riserva |",
            "| 6 | Sensore di pioggia | 2-5 € | valvola bloccata aperta, irrigare sotto la pioggia |",
            "| 7 | Avvisi sul telefono dalla centrale (nodo muto, allarmi) | 0 € | blackout, ogni guasto mentre sei via |",
            "| 8 | Batteria tampone o solare dimensionato | 20-80 € | blackout lunghi, orti senza rete |",
            "",
            "Le soluzioni software (memoria e blocco riavvii, soglia critica, blocco gelo, riserva, acqua inattesa, "
            "protezione batteria, filtro delle letture, verifica dopo l'irrigazione) sono già nel controllo e "
            "provate dai test.", ""]
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--solo", help="un solo caso (id)")
    ap.add_argument("--file", default="SOLUZIONI.md")
    a = ap.parse_args()
    casi = [c for c in CASI if not a.solo or c["id"] == a.solo]
    risultati = []
    for c in casi:
        righe = esegui_caso(c)
        risultati.append((c, righe))
        print("\n%s" % c["titolo"])
        for e, v in righe:
            print("  %-50s %s" % (e, "  ".join("%s=%s" % kv for kv in zip(c["metriche"], v))))
    if not a.solo:
        with open(a.file, "w", encoding="utf-8") as f:
            f.write(markdown(risultati))
        print("\nScritto %s" % a.file)


if __name__ == "__main__":
    main()
