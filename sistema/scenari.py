"""Scenari di prova del sistema virtuale: funzionamento normale, guasti, meteo estremo, problemi di corrente,
allagamenti.

Ogni scenario descrive il mondo (mese, giorni, zone, cisterna, guasti, meteo, alimentazione) e cosa ci si aspetta.
Gli stessi scenari sono provati in automatico da test/test_scenari.py (collaudo virtuale), confrontati con le
soluzioni da sistema/soluzioni.py (SOLUZIONI.md) e si rifanno a mano con l'hardware vero (COLLAUDO.md).

Campi possibili: descrizione, mese, giorni, seme, meteo (funzione che modifica la lista dei giorni), zone (modifiche
alle zone di base: {indice: {campo: valore}} o lista completa), parametri del controllore, memoria (True: il
controllore salva blocchi e riavvii come l'ESP32), interruzioni [(minuto, durata)], riavvio_su_avvio_pompa
(l'alimentazione cede quando parte la pompa e l'ESP32 si riavvia), e i campi di Mondo (serbatoio_l,
capacita_serbatoio_l, tetto_m2, sensore_livello, flussimetro, sensore_pioggia, quadro_altezza_mm,
sensore_allagamento_mm, energia, guasti).
"""
G = 1440  # minuti in un giorno
H = 60

ZONE_BASE = [
    {"nome": "pomodori", "area_m2": 2.0, "kc": 1.15},
    {"nome": "insalata", "area_m2": 1.0, "kc": 1.00},
]


def _giorni(da, a, **valori):
    def modifica(meteo):
        for g in meteo[da:a]:
            g.update(valori)
    return modifica


def _calore(meteo):
    for g in meteo[4:14]:
        g.update(et0=8.5, t_media=32.0, escursione=13.0, pioggia=0.0, nuvoloso=False)


def _siccita(meteo):
    for g in meteo:
        g.update(pioggia=0.0, nuvoloso=False)


def _nubifragio(meteo):
    for g in meteo:
        g.update(pioggia=0.0)
    meteo[2].update(pioggia=90.0, ore_pioggia={15: 30.0, 16: 40.0, 17: 20.0}, nuvoloso=True)


def _pioggia_persistente(meteo):
    for g in meteo[1:13]:
        g.update(pioggia=30.0, ore_pioggia={h: 3.0 for h in range(8, 18)}, nuvoloso=True, et0=0.8)


def _previsione_sbagliata(meteo):
    for g in meteo:
        g.update(pioggia=0.0, nuvoloso=False)
    for g in meteo[2:9]:
        g["prevista"] = 12.0                 # la centrale annuncia pioggia ogni giorno, non piove mai


def _gelata(meteo):
    for g in meteo:
        g.update(pioggia=0.0)
    for g in meteo[3:6]:
        g.update(t_media=3.0, escursione=11.0)   # minima intorno a -2 °C


def _solare(meteo):
    for g in meteo:
        g.update(pioggia=0.0, nuvoloso=False)
    for g in meteo[7:13]:
        g["nuvoloso"] = True                 # 6 giorni coperti senza pioggia


SCENARI = {
    # --- funzionamento normale e guasti ---
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
        "descrizione": "Il tubo della zona 1 si stacca il giorno 5: l'umidità non sale, zona bloccata, cisterna salva.",
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
        "mese": 7, "giorni": 10, "serbatoio_l": 80.0, "meteo": _siccita,
    },
    "tubo_scoppiato": {
        "descrizione": "Il tubo della zona 1 scoppia il giorno 3: esce il doppio dell'acqua e finisce a terra.",
        "mese": 7, "giorni": 6, "guasti": {"tubo_scoppiato": {0: 3 * G}},
    },
    "valvola_bloccata_aperta": {
        "descrizione": "La valvola della zona 2 resta bloccata aperta dal giorno 2: ogni volta che la pompa irriga la "
                       "zona 1 bagna anche la zona 2, che si allaga.",
        "mese": 7, "giorni": 10, "guasti": {"valvola_bloccata_aperta": {1: 2 * G}},
    },
    # --- meteo ---
    "ondata_calore": {
        "descrizione": "Luglio con 10 giorni di caldo africano (ET0 8,5 mm/giorno, massime 38-39 °C).",
        "mese": 7, "giorni": 20, "meteo": _calore,
    },
    "siccita": {
        "descrizione": "60 giorni d'estate senza una goccia di pioggia: per quanto basta la cisterna da 1000 L?",
        "mese": 7, "giorni": 60, "meteo": _siccita, "serbatoio_l": 1000.0,
    },
    "nubifragio": {
        "descrizione": "Ottobre, 90 mm in 3 ore su terreno argilloso (drena 2 mm/ora): acqua ferma sulle aiuole.",
        "mese": 10, "giorni": 8, "meteo": _nubifragio,
        "zone": {0: {"drenaggio_mm_h": 2.0}, 1: {"drenaggio_mm_h": 2.0}},
    },
    "pioggia_persistente": {
        "descrizione": "Novembre, 12 giorni di pioggia (30 mm al giorno) su terreno pesante e compattato "
                       "(drena 1 mm/ora).",
        "mese": 11, "giorni": 16, "meteo": _pioggia_persistente,
        "zone": {0: {"drenaggio_mm_h": 1.0}, 1: {"drenaggio_mm_h": 1.0}},
    },
    "previsione_sbagliata": {
        "descrizione": "Luglio, per 7 giorni la previsione annuncia pioggia che non arriva mai.",
        "mese": 7, "giorni": 12, "meteo": _previsione_sbagliata,
    },
    "gelata_tardiva": {
        "descrizione": "Aprile, terreno asciutto e 3 notti con minime sotto zero.",
        "mese": 4, "giorni": 8, "meteo": _gelata, "zone": {0: {"umidita": 0.42}, 1: {"umidita": 0.42}},
    },
    "gelo": {
        "descrizione": "Gennaio freddo: allarme gelo di notte.",
        "mese": 1, "giorni": 7, "meteo": _giorni(0, 7, t_media=2.0),
    },
    # --- corrente ---
    "riavvio": {
        "descrizione": "Mancanza di corrente durante un'irrigazione il giorno 2: alla riaccensione la pompa è ferma "
                       "e il sistema riparte da solo.",
        "mese": 7, "giorni": 5, "interruzioni": [(2 * G + 7 * H + 3, 2)],
    },
    "blackout_lungo": {
        "descrizione": "Ondata di calore e salta la corrente per 72 ore dal giorno 6 (interruttore scattato mentre "
                       "sei via).",
        "mese": 7, "giorni": 20, "meteo": _calore, "interruzioni": [(5 * G + 8 * H, 72 * H)],
    },
    "brownout_pompa": {
        "descrizione": "Quando parte la pompa la tensione cala e l'ESP32 si riavvia (alimentatore debole); dal giorno 2 "
                       "il sensore della zona 2 è anche fuori dalla terra e legge sempre 'secco'.",
        "mese": 7, "giorni": 7, "riavvio_su_avvio_pompa": True,
        "guasti": {"sensore_fuori_terra": {1: 2 * G}},
    },
    "solare_nuvoloso": {
        "descrizione": "Orto senza rete: pannello 5 W e batteria 12 V 7 Ah (84 Wh), luglio con 6 giorni coperti.",
        "mese": 7, "giorni": 20, "meteo": _solare,
        "energia": {"pannello_w": 5.0, "batteria_wh": 84.0, "carica": 0.8},
    },
    # --- allagamento ---
    "quadro_allagato": {
        "descrizione": "Nubifragio di 90 mm su terreno argilloso con il quadro elettrico appoggiato a terra (fondo a "
                       "5 cm): l'acqua ferma arriva all'elettronica.",
        "mese": 10, "giorni": 8, "meteo": _nubifragio, "quadro_altezza_mm": 50.0, "sensore_allagamento_mm": 20.0,
        "zone": {0: {"drenaggio_mm_h": 2.0}, 1: {"drenaggio_mm_h": 2.0}},
    },
}
