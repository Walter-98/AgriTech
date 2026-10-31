"""Sicurezza del dosaggio: dose massima per l'impianto vero, caso peggiore del dosatore bloccato, matrice dei guasti.

Niente valori "sicuri per tutti": il pH che si ottiene con una dose di acido dipende dal volume, dall'alcalinità
dell'acqua e dalla capacità tampone della soluzione. Qui si calcola, per l'impianto descritto, quanto acido può
arrivare nel caso peggiore (dosatore che resta acceso finché non interviene il temporizzatore hardware) e se il pH
resta sopra la soglia di danno alle radici. Il calcolo usa, in ordine di preferenza:
  1. una TITOLAZIONE misurata sulla soluzione vera (mL di acido aggiunti a un volume noto e pH letto dopo ognuno);
  2. altrimenti il modello chimico semplice di sistema/idro_modello.py (affidabilità C: solo per una prima idea).
Il risultato non autorizza nulla da solo: serve il collaudo fisico (SICUREZZA_DOSAGGIO.md, sezione 5).
Compatibile con MicroPython (niente librerie esterne) perché il firmware può usare dose_massima_ml.
"""

PH_DANNO = 4.5           # sotto: danno alle radici in poche ore (soglia prudente per lattuga e basilico)
PH_SALTO_DOSE = 0.3      # una dose normale non deve spostare il pH più di così (si vede l'effetto, non si esagera)
MEQ_PER_ML_PH_MENO = 6.0   # pH- commerciale (acido fosforico circa 25%): ordine di grandezza, va letto in etichetta


def alcalinita_da_ph(ph):
    """Inverso del modello di idro_modello.py: pH = 4 + 4 a / (a + 0,8), a in meq/L (valido tra pH 4 e 8)."""
    ph = min(max(ph, 4.0), 7.99)
    return 0.8 * (ph - 4.0) / (8.0 - ph)


def ph_da_alcalinita(a):
    if a >= 0:
        return 4.0 + 4.0 * a / (a + 0.8)
    import math
    return max(1.5, 4.0 - 1.5 * math.log10(1 + (-a) / 0.1))


def ph_dopo_acido_titolazione(titolazione, volume_l, ml_acido):
    """titolazione: (volume del campione in L, [(mL di acido aggiunti, pH letto), ...]) misurata sulla soluzione vera.
    Scala i mL sul volume dell'impianto e interpola; oltre l'ultimo punto: pendenza dell'ultimo tratto (prudente)."""
    v_campione, punti = titolazione
    punti = sorted(punti)
    x = ml_acido * v_campione / volume_l           # mL equivalenti nel campione
    if x <= punti[0][0]:
        return punti[0][1]
    for (x0, p0), (x1, p1) in zip(punti, punti[1:]):
        if x <= x1:
            return p0 + (p1 - p0) * (x - x0) / (x1 - x0)
    (x0, p0), (x1, p1) = punti[-2], punti[-1]
    pend = (p1 - p0) / (x1 - x0) if x1 > x0 else 0.0
    return p1 + pend * (x - x1)


def ph_dopo_acido(volume_l, ph_partenza, ml_acido, meq_per_ml, titolazione=None):
    if titolazione:
        # la titolazione parte dal pH della soluzione misurata: si sposta lungo la curva dal punto di partenza
        v_campione, punti = titolazione
        punti = sorted(punti)
        # mL (sul campione) a cui la curva vale ph_partenza
        x0 = None
        for (a, pa), (b, pb) in zip(punti, punti[1:]):
            if pb <= ph_partenza <= pa or pa <= ph_partenza <= pb:
                x0 = a if pa == pb else a + (b - a) * (pa - ph_partenza) / (pa - pb)
                break
        if x0 is None:
            x0 = punti[0][0] if ph_partenza >= punti[0][1] else punti[-1][0]
        return ph_dopo_acido_titolazione(titolazione, volume_l, ml_acido + x0 * volume_l / v_campione)
    a = alcalinita_da_ph(ph_partenza) - ml_acido * meq_per_ml / volume_l
    return ph_da_alcalinita(a)


def dose_massima_ml(volume_l, ph_partenza, meq_per_ml, ph_minimo=PH_DANNO, titolazione=None):
    """mL di acido che portano il pH da ph_partenza a ph_minimo (bisezione: vale anche con la titolazione)."""
    lo, hi = 0.0, 1.0
    while ph_dopo_acido(volume_l, ph_partenza, hi, meq_per_ml, titolazione) > ph_minimo and hi < 1e6:
        hi *= 2
    for _ in range(60):
        mid = (lo + hi) / 2
        if ph_dopo_acido(volume_l, ph_partenza, mid, meq_per_ml, titolazione) > ph_minimo:
            lo = mid
        else:
            hi = mid
    return lo


def verifica_installazione(volume_l, portata_ml_s, timer_hw_s, ml_per_dose, diluizione=1.0, meq_per_ml=MEQ_PER_ML_PH_MENO,
                           ph_obiettivo=5.8, ph_banda=0.3, volume_minimo_l=None, titolazione=None):
    """Caso peggiore del dosatore di pH- bloccato acceso:
    - si parte dal pH più basso del funzionamento normale (obiettivo meno banda) e dal volume più basso (galleggiante
      di minimo, se indicato): è lì che la stessa dose fa più danno;
    - arriva portata × timer hardware di acido diluito (il firmware può essere bloccato: conta solo il temporizzatore);
    - il pH deve restare sopra PH_DANNO. Inoltre una dose normale non deve spostarlo più di PH_SALTO_DOSE.
    Restituisce esito ('sicuro'/'non_sicuro'), numeri e limiti da rispettare. 'sicuro' vale solo per il modello o
    la titolazione usati: va confermato con la prova fisica F7 (SICUREZZA_DOSAGGIO.md)."""
    meq = meq_per_ml / diluizione
    v = volume_minimo_l or volume_l
    ph0 = ph_obiettivo - ph_banda
    ml_peggiore = portata_ml_s * timer_hw_s
    ph_peggiore = ph_dopo_acido(v, ph0, ml_peggiore, meq, titolazione)
    ph_dose = ph_dopo_acido(v, ph_obiettivo + ph_banda, ml_per_dose, meq, titolazione)
    salto = (ph_obiettivo + ph_banda) - ph_dose
    ml_max = dose_massima_ml(v, ph0, meq, PH_DANNO, titolazione)
    problemi = []
    if ph_peggiore < PH_DANNO:
        problemi.append("dosatore bloccato: in %d s arrivano %.1f mL e il pH scende a %.2f (sotto %.1f)"
                        % (timer_hw_s, ml_peggiore, ph_peggiore, PH_DANNO))
    if salto > PH_SALTO_DOSE:
        problemi.append("una dose normale da %.2f mL sposta il pH di %.2f (più di %.1f)" % (ml_per_dose, salto, PH_SALTO_DOSE))
    return {
        "esito": "non_sicuro" if problemi else "sicuro",
        "fonte": "titolazione misurata" if titolazione else "modello chimico semplice (affidabilità C): fare la titolazione",
        "volume_l": v, "ph_partenza": ph0, "ml_caso_peggiore": ml_peggiore, "ph_caso_peggiore": ph_peggiore,
        "ml_massimi_prima_del_danno": ml_max,
        "timer_hw_massimo_s": ml_max / portata_ml_s if portata_ml_s > 0 else None,
        "portata_massima_ml_s": ml_max / timer_hw_s if timer_hw_s > 0 else None,
        "salto_ph_dose": salto, "problemi": problemi,
    }


# Matrice dei guasti (FMEA semplificata). Scale 1-5: gravità (5 = piante perse o pericolo per le persone), probabilità
# (None = non stimabile senza dati di campo), rilevabilità (1 = sempre rilevato subito, 5 = non rilevato).
# "hw" = protezione che funziona anche con il firmware bloccato o sbagliato. "verifica" = prova fisica richiesta.
MATRICE_GUASTI = [
    {"id": "G1", "tipo": "hardware", "guasto": "Relè di abilitazione dei dosatori incollato chiuso",
     "causa": "contatti saldati da correnti di spunto, fine vita", "effetto": "i MOSFET restano alimentati: basta un MOSFET in corto per dosare senza fine",
     "gravita": 5, "probabilita": 2, "rilevabilita": 2,
     "protezione_sw": "autotest del taglio a ogni avvio e ogni 24 h: con il relè comandato aperto il sensore di tensione deve leggere 0; se no, dosaggio bloccato",
     "protezione_hw": "temporizzatore hardware (relè a ritardo) in serie che apre comunque dopo pochi secondi; fusibile; galleggiante di minimo in serie",
     "hw": True, "verifica": "F3 (relè incollato simulato con un ponticello: il temporizzatore deve aprire)"},
    {"id": "G2", "tipo": "hardware", "guasto": "MOSFET di un dosatore in corto",
     "causa": "sovratensione senza diodo, calore", "effetto": "pompa sempre accesa quando il relè di abilitazione è chiuso",
     "gravita": 5, "probabilita": 2, "rilevabilita": 3,
     "protezione_sw": "relè di abilitazione chiuso solo durante una dose; controllo EC/pH dopo ogni dose (DOSATORE_BLOCCATO)",
     "protezione_hw": "relè di abilitazione in serie + temporizzatore hardware + diodo di ricircolo",
     "hw": True, "verifica": "F2 (MOSFET in corto simulato: la pompa deve fermarsi al massimo dopo il tempo del temporizzatore)"},
    {"id": "G3", "tipo": "software", "guasto": "ESP32 bloccato con un'uscita accesa",
     "causa": "errore nel firmware, disturbo, memoria piena", "effetto": "il firmware non spegne la pompa",
     "gravita": 5, "probabilita": 3, "rilevabilita": 4,
     "protezione_sw": "watchdog (riavvio); al riavvio tutte le uscite a 0",
     "protezione_hw": "temporizzatore hardware indipendente dall'ESP32: apre l'alimentazione dei dosatori dopo il tempo massimo",
     "hw": True, "verifica": "F4 (firmware fermato con un comando di debug a dosatore acceso)"},
    {"id": "G4", "tipo": "software", "guasto": "Watchdog che non interviene",
     "causa": "disattivato per sbaglio, alimentato dal ciclo bloccato", "effetto": "l'ESP32 resta bloccato",
     "gravita": 4, "probabilita": 2, "rilevabilita": 5,
     "protezione_sw": "nessuna affidabile (è il software stesso che è fermo)",
     "protezione_hw": "temporizzatore hardware (G3) e arresto di emergenza a fungo NC",
     "hw": True, "verifica": "F4"},
    {"id": "G5", "tipo": "sensore", "guasto": "Sonda pH guasta, staccata o non tarata",
     "causa": "elettrodo vecchio, bolla d'aria, taratura scaduta", "effetto": "il controllo vede pH alto e continua a dosare acido",
     "gravita": 4, "probabilita": 4, "rilevabilita": 3,
     "protezione_sw": "letture fuori campo, ferme o con salti scartate; dose inefficace -> blocco; taratura entro 30 giorni; confronto con la penna",
     "protezione_hw": "limite fisico dell'acido per ogni dose (volume del dosatore e temporizzatore)",
     "hw": True, "verifica": "F6 (sonda in aria e in soluzione tampone sbagliata: nessuna dose)"},
    {"id": "G6", "tipo": "hardware", "guasto": "Pompa dosatrice con portata eccessiva",
     "causa": "pompa diversa da quella collaudata, tubo più grosso", "effetto": "ogni dose è più grande del previsto",
     "gravita": 4, "probabilita": 3, "rilevabilita": 3,
     "protezione_sw": "dose calcolata in mL dalla portata MISURATA al collaudo; verifica dell'effetto dopo ogni dose",
     "protezione_hw": "temporizzatore hardware dimensionato con verifica_installazione sulla portata misurata",
     "hw": True, "verifica": "F1 (portata misurata con un cilindro graduato, 3 prove)"},
    {"id": "G7", "tipo": "processo", "guasto": "Dosatore vuoto o tubo con aria",
     "causa": "tanica finita", "effetto": "dosi senza effetto, il controllo insiste",
     "gravita": 2, "probabilita": 4, "rilevabilita": 2,
     "protezione_sw": "DOSAGGIO_INEFFICACE dopo 3 dosi senza effetto: blocco fino a reset", "protezione_hw": "",
     "hw": False, "verifica": "F6"},
    {"id": "G8", "tipo": "processo", "guasto": "Serbatoio piccolo o livello basso",
     "causa": "evaporazione, rabbocco mancato, impianto più piccolo del previsto", "effetto": "la stessa dose sposta molto di più il pH",
     "gravita": 4, "probabilita": 3, "rilevabilita": 2,
     "protezione_sw": "dose proporzionale al volume; verifica_installazione sul volume del galleggiante di minimo",
     "protezione_hw": "galleggiante di minimo in serie all'alimentazione dei dosatori",
     "hw": True, "verifica": "F5 (galleggiante alzato a mano: i dosatori non devono partire)"},
    {"id": "G9", "tipo": "processo", "guasto": "Mancata miscelazione",
     "causa": "pompa di ricircolo ferma o guasta", "effetto": "l'acido resta concentrato vicino alle radici; la sonda legge un valore sbagliato",
     "gravita": 4, "probabilita": 3, "rilevabilita": 3,
     "protezione_sw": "dose solo con flusso confermato e attesa di miscelazione; FLUSSO_ASSENTE blocca",
     "protezione_hw": "flussostato (interruttore di flusso) in serie all'alimentazione dei dosatori: senza ricircolo niente corrente (richiesto per il modo REALE)",
     "hw": True, "verifica": "F8 (pompa di ricircolo staccata: i dosatori non devono avere tensione)"},
    {"id": "G10", "tipo": "processo", "guasto": "Concentrazione chimica sbagliata",
     "causa": "acido non diluito o di un'altra marca, errore di preparazione", "effetto": "ogni dose 5-10 volte più forte",
     "gravita": 5, "probabilita": 3, "rilevabilita": 4,
     "protezione_sw": "controllo dell'effetto della prima dose dopo ogni cambio di tanica (salto massimo)",
     "protezione_hw": "tanica piccola (non più acido di quello che il serbatoio sopporta: ml_massimi_prima_del_danno)",
     "hw": True, "verifica": "F7 (titolazione della soluzione vera con l'acido vero)"},
    {"id": "G11", "tipo": "software", "guasto": "Blackout e ripristino",
     "causa": "mancanza di corrente durante una dose", "effetto": "dose interrotta, stato non noto al riavvio",
     "gravita": 3, "probabilita": 4, "rilevabilita": 2,
     "protezione_sw": "al riavvio uscite a 0, attesa e stato DISABILITATO/ATTESA; memoria dei blocchi; nessuna dose finché le letture non sono stabili",
     "protezione_hw": "relè e MOSFET normalmente aperti senza alimentazione",
     "hw": True, "verifica": "F9 (spina staccata durante una dose ad acqua)"},
    {"id": "G12", "tipo": "software", "guasto": "Riavvio con stati non coerenti",
     "causa": "memoria salvata a metà, parametri modificati", "effetto": "il controllo riparte credendo di essere in un altro stato",
     "gravita": 3, "probabilita": 2, "rilevabilita": 3,
     "protezione_sw": "stato ricostruito dalle letture e non dalla memoria; i blocchi salvati sopravvivono; modo REALE ricontrollato a ogni passo",
     "protezione_hw": "", "hw": False, "verifica": "F9"},
    {"id": "G13", "tipo": "persona", "guasto": "Modo REALE attivato per sbaglio",
     "causa": "parametro cambiato da rete o a mano", "effetto": "dosaggio automatico senza collaudo",
     "gravita": 5, "probabilita": 2, "rilevabilita": 2,
     "protezione_sw": "REALE solo con chiave fisica chiusa, autotest del taglio recente e collaudo completo: un parametro da solo non basta",
     "protezione_hw": "chiave fisica (interruttore a chiave) letta su un pin di ingresso",
     "hw": True, "verifica": "F10 (con la chiave aperta il modo resta OMBRA qualunque sia il parametro)"},
]


def valuta_matrice(matrice=MATRICE_GUASTI):
    """Controlli di coerenza: ogni guasto grave (gravità >= 4) deve avere una protezione che non dipende dal firmware
    e una prova fisica; indice di rischio gravità x probabilità x rilevabilità quando la probabilità è stimabile."""
    righe, scoperti = [], []
    for g in matrice:
        rpn = g["gravita"] * g["probabilita"] * g["rilevabilita"] if g["probabilita"] else None
        righe.append(dict(g, rpn=rpn))
        if g["gravita"] >= 4 and not (g["hw"] and g["protezione_hw"] and g["verifica"]):
            scoperti.append(g["id"])
    return {"righe": sorted(righe, key=lambda r: -(r["rpn"] or 0)), "scoperti": scoperti}
