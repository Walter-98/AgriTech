# Logica di controllo dell'impianto AgriTech.
# È la STESSA che gira sull'ESP32 (MicroPython, firmware/esp32-irrigazione) e nel simulatore (Python sul PC):
# quello che si prova in virtuale è esattamente quello che poi comanda pompa e valvole.
# Per restare compatibile con MicroPython: niente librerie, niente f-string, niente dataclass, niente typing.
#
# Impianto: 1 pompa + 1 valvola per zona, serbatoio con galleggiante di minimo (e se c'è sensore di livello in litri),
# 1 sensore di umidità capacitivo per zona; facoltativi: temperatura aria, flussimetro, sensore di allagamento nel
# quadro, tensione della batteria (impianti a pannello solare).
# Il tempo arriva da fuori in minuti (lettura "minuto"): così il simulatore può accelerarlo.
#
# Sicurezze sempre attive, anche senza rete:
#   - pompa ferma con serbatoio basso (mai a secco) e con acqua nel quadro elettrico;
#   - tempo massimo di irrigazione e pausa minima tra due irrigazioni della stessa zona;
#   - una zona alla volta (la pompa non basta per tutte);
#   - sensore fuori campo (staccato, in corto) -> zona in "emergenza": poca acqua a tempo, mai a sensore;
#   - irrigazione inefficace (l'umidità non sale: tubo rotto, valvola bloccata, sensore fuori dalla terra)
#     -> zona bloccata fino a reset manuale;
#   - pompa che non eroga (flussimetro a zero o serbatoio che non scende) -> irrigazione bloccata fino a reset;
#   - perdita (flussimetro molto sopra la portata normale: tubo scoppiato) -> zona bloccata fino a reset;
#   - acqua inattesa (una zona si bagna senza pioggia e senza la sua valvola: valvola bloccata aperta)
#     -> allarme fino a reset; le altre zone si irrigano solo finché quella zona non è troppo bagnata;
#   - niente irrigazione con il gelo (ghiaccio su foglie e tubi);
#   - cisterna in riserva -> soglie di risparmio; batteria bassa -> pompa ferma, l'ESP32 resta acceso;
#   - niente irrigazione mentre piove (salvo soglia critica), e mentre piove niente prova sulla pompa con il livello;
#   - attesa dopo l'accensione; con la memoria: pausa per tutte le zone dopo un riavvio, blocchi che sopravvivono
#     ai riavvii e blocco se l'ESP32 si riavvia più volte di fila con la pompa accesa (alimentazione che cede
#     quando parte la pompa).

PARAMETRI_DEFAULT = {
    "soglia_on": 0.45,             # inizia a irrigare sotto il 45% di umidità
    "soglia_off": 0.70,            # smette sopra il 70% (isteresi)
    "soglia_critica": 0.30,        # sotto questa irriga anche se è prevista pioggia
    "max_min": 10,                 # minuti massimi per irrigazione
    "pausa_min": 60,               # minuti minimi tra due irrigazioni della stessa zona
    "attesa_avvio_min": 2,         # dopo l'accensione aspetta prima di irrigare (letture stabili)
    "adc_secco": 3000,             # taratura sensore: lettura in aria
    "adc_bagnato": 1300,           # taratura sensore: lettura in acqua
    "adc_min_valido": 200,         # sotto: sensore staccato o in corto
    "adc_max_valido": 4000,        # sopra: sensore staccato o in corto
    "pioggia_salta_mm": 3.0,       # pioggia prevista oltre cui non si irriga (salvo soglia critica)
    "filtro": 0.3,                 # media mobile delle letture (1 = nessun filtro): il rumore non inganna le soglie
    "verifica_dopo_min": 8,        # minuti DOPO la fine di un'irrigazione arrivata al tempo massimo...
    "aumento_minimo": 0.02,        # ...in cui l'umidità deve risultare salita almeno di tanto (il sensore è lento)
    "verifica_pompa_min": 8,       # minuti di pompa dopo cui il serbatoio (se misurato) deve essere sceso...
    "calo_minimo_l": 1.0,          # ...almeno di tanto
    "conferma_pompa_min": 30,      # serbatoio che non scende: pompa ferma subito, allarme solo se in questi minuti...
    "aumento_livello_pioggia_l": 2.0,  # ...il livello non sale di tanto da solo (pioggia dalla grondaia senza sensore)
    "livello_pieno_l": None,       # litri a cisterna piena: lì la pioggia la tiene al troppo pieno e la verifica non vale
    "emergenza_ogni_min": 1440,    # zona con sensore guasto: un'irrigazione al giorno
    "emergenza_durata_min": 3,     # ...di 3 minuti (0 = nessuna irrigazione in emergenza)
    "gelo_c": 2.0,
    "caldo_c": 38.0,
    "blocco_gelo": True,           # niente irrigazione con temperatura <= gelo_c
    "portata_nominale_l_min": 1.0, # flussimetro: portata normale tarata sul banco
    "flusso_verifica_min": 2,      # flussimetro: minuti dopo l'avvio per il controllo
    "flusso_min_rel": 0.3,         # sotto il 30% della nominale: pompa che non eroga
    "flusso_max_rel": 1.6,         # sopra il 160% della nominale: perdita
    "acqua_inattesa": 0.08,        # zona che si bagna di +8% senza valvola né pioggia: allarme (0 = controllo spento)
    "inattesa_max": 0.85,          # ...e con quella zona sopra questo valore non si irriga nessuna zona
    "allagata_ore": 6,             # zona sopra soglia_allagata per tante ore: avviso di ristagno
    "soglia_allagata": 0.95,
    "riserva_l": None,             # sotto questi litri (sensore di livello) soglie di risparmio
    "soglia_on_riserva": 0.35,
    "soglia_off_riserva": 0.55,
    "batteria_min_pompa": 0.35,    # batteria sotto il 35%: niente pompa (0 = controllo spento)
    "riavvii_max": 3,              # riavvii di fila con la pompa accesa prima del blocco (serve la memoria)
}


class Controllore:
    def __init__(self, n_zone, parametri=None, memoria=None):
        """memoria: dizionario salvato dall'avvio precedente (o {} al primo avvio) per riprendere blocchi e
        conteggio dei riavvii; None = nessuna memoria (comportamento della prima versione)."""
        p = dict(PARAMETRI_DEFAULT)
        if parametri:
            p.update(parametri)
        if p["verifica_pompa_min"] >= p["max_min"]:
            raise ValueError("verifica_pompa_min deve essere minore di max_min")
        self.p = p
        self.n = n_zone
        self.avvio = None
        self.zona = None               # zona che sta irrigando (indice) o None
        self.inizio = 0
        self.emergenza = False         # l'irrigazione in corso è a tempo (sensore guasto)
        self.verificato = False
        self.flusso_verificato = False
        self.u_inizio = 0.0
        self.l_inizio = None
        self.ultima_fine = [None] * n_zone
        self.ultimo_emergenza = [None] * n_zone
        self.u_rif = [None] * n_zone   # umidità di riferimento per il controllo "acqua inattesa"
        self.uf = [None] * n_zone      # umidità filtrata
        self.da_verificare = None      # (zona, umidità all'inizio, minuto di fine) di un'irrigazione da controllare
        self.ore_bagnata = [0] * n_zone
        self.bloccata = [False] * n_zone
        self.perdita = [False] * n_zone
        self.pompa_bloccata = False
        self.acqua_inattesa = None     # zona che riceve acqua con la sua valvola chiusa (indice) o None
        self.fermo_riavvii = False
        self.ultima_pioggia = None
        self.campioni_livello = []     # livello ogni 10 minuti (ultimi 40): se sale da solo, piove nella cisterna
        self.ultima_grondaia = None
        self.pompa_sospetta = None     # (minuto della verifica, inizio dell'irrigazione) in attesa di conferma
        self.con_memoria = memoria is not None
        self.pompa_in_corso = False    # salvato PRIMA di accendere la pompa: se al riavvio è True, si è spento pompando
        self.riavvii_pompa = 0
        self.memoria_cambiata = False
        if memoria is not None:
            self.bloccata = list(memoria.get("bloccata", self.bloccata))[:n_zone]
            self.bloccata += [False] * (n_zone - len(self.bloccata))
            self.perdita = list(memoria.get("perdita", self.perdita))[:n_zone]
            self.perdita += [False] * (n_zone - len(self.perdita))
            self.pompa_bloccata = memoria.get("pompa_bloccata", False)
            self.acqua_inattesa = memoria.get("acqua_inattesa")
            self.riavvii_pompa = memoria.get("riavvii_pompa", 0) + (1 if memoria.get("pompa_in_corso") else 0)
            self.fermo_riavvii = memoria.get("fermo_riavvii", False) or self.riavvii_pompa >= p["riavvii_max"]
            self.memoria_cambiata = True

    def memoria(self):
        """Stato da salvare (file sull'ESP32) quando memoria_cambiata è True."""
        self.memoria_cambiata = False
        return {"bloccata": list(self.bloccata), "perdita": list(self.perdita), "pompa_bloccata": self.pompa_bloccata,
                "acqua_inattesa": self.acqua_inattesa, "pompa_in_corso": self.pompa_in_corso,
                "riavvii_pompa": self.riavvii_pompa, "fermo_riavvii": self.fermo_riavvii}

    def umidita(self, adc):
        """Lettura grezza -> umidità 0..1, oppure None se il sensore è fuori campo."""
        p = self.p
        if adc is None or adc < p["adc_min_valido"] or adc > p["adc_max_valido"]:
            return None
        u = (p["adc_secco"] - adc) / (p["adc_secco"] - p["adc_bagnato"])
        return min(max(u, 0.0), 1.0)

    def reset(self):
        """Reset manuale degli allarmi che bloccano (dopo aver riparato)."""
        self.bloccata = [False] * self.n
        self.perdita = [False] * self.n
        self.pompa_bloccata = False
        self.acqua_inattesa = None
        self.fermo_riavvii = False
        self.riavvii_pompa = 0
        self.pompa_sospetta = None
        self.u_rif = [None] * self.n
        self.memoria_cambiata = True

    def _ferma(self, minuto):
        self.ultima_fine[self.zona] = minuto
        self.zona = None
        self.pompa_in_corso = False
        if minuto - self.inizio >= 2:
            self.riavvii_pompa = 0     # un'irrigazione finita regolarmente: l'alimentazione regge
        self.memoria_cambiata = True

    def _in_pausa(self, i, minuto):
        f = self.ultima_fine[i]
        return f is not None and minuto - f < self.p["pausa_min"]

    def passo(self, letture):
        """Da chiamare ogni minuto. letture: minuto, adc (lista per zona), serbatoio_basso, e facoltativi
        serbatoio_l, temp_c, pioggia_prevista_mm, pioggia_in_corso, flusso_l_min, allagamento, batteria (0..1).
        Restituisce pompa, valvole, umidita, allarmi, stato."""
        p = self.p
        m = letture["minuto"]
        if self.avvio is None:
            self.avvio = m
            if self.con_memoria:
                self.ultima_fine = [m] * self.n          # dopo un riavvio tutte le zone ripartono dalla pausa
        u = []
        for i, a in enumerate(letture["adc"]):
            grezza = self.umidita(a)
            if grezza is None:
                self.uf[i] = None
            elif self.uf[i] is None:
                self.uf[i] = grezza
            else:
                self.uf[i] += (grezza - self.uf[i]) * p["filtro"]
            u.append(self.uf[i])
        basso = letture.get("serbatoio_basso", False)
        litri = letture.get("serbatoio_l")
        flusso = letture.get("flusso_l_min")
        allagamento = letture.get("allagamento", False)
        batteria = letture.get("batteria")
        attive = letture.get("zone_attive") or [True] * self.n   # aiuola vuota: niente acqua
        t = letture.get("temp_c")
        gelo = t is not None and t <= p["gelo_c"]
        pioggia = letture.get("pioggia_prevista_mm", 0.0) >= p["pioggia_salta_mm"]
        piove_ora = bool(letture.get("pioggia_in_corso"))
        if piove_ora:
            self.ultima_pioggia = m
        pioggia = pioggia or piove_ora
        if litri is not None:
            if m % 10 == 0:
                self.campioni_livello = (self.campioni_livello + [litri])[-4:]
            if self.campioni_livello and litri - min(self.campioni_livello) >= p["aumento_livello_pioggia_l"]:
                self.ultima_grondaia = m
        if self.pompa_sospetta is not None and m - self.pompa_sospetta[0] >= p["conferma_pompa_min"]:
            inizio = self.pompa_sospetta[1]
            self.pompa_sospetta = None
            entrata = [x for x in (self.ultima_grondaia, self.ultima_pioggia)
                       if x is not None and x >= inizio - p["conferma_pompa_min"]]
            if not entrata:                  # nessuna pioggia: la pompa davvero non eroga
                self.pompa_bloccata = True
                self.memoria_cambiata = True
        batteria_bassa = batteria is not None and batteria < p["batteria_min_pompa"]
        riserva = p["riserva_l"] is not None and litri is not None and litri < p["riserva_l"]
        soglia_on = p["soglia_on_riserva"] if riserva else p["soglia_on"]
        soglia_off = p["soglia_off_riserva"] if riserva else p["soglia_off"]

        for i in range(self.n):
            if u[i] is None:
                if self.ultimo_emergenza[i] is None:
                    self.ultimo_emergenza[i] = m       # la prima dose arriva dopo emergenza_ogni_min
            else:
                self.ultimo_emergenza[i] = None

        # 0. acqua inattesa: una zona si bagna mentre la sua valvola è chiusa e non piove (da 3 ore).
        # Serve sapere se piove (sensore di pioggia o centrale): senza quell'informazione il controllo è spento.
        pioggia_nota = letture.get("pioggia_in_corso") is not None
        pioggia_recente = self.ultima_pioggia is not None and m - self.ultima_pioggia < 180
        for i in range(self.n):
            if (not pioggia_nota or pioggia_recente or u[i] is None or i == self.zona
                    or self._in_pausa(i, m)):           # in pausa il sensore sale ancora per il ritardo
                self.u_rif[i] = None
                continue
            if self.u_rif[i] is None or u[i] < self.u_rif[i]:
                self.u_rif[i] = u[i]
            elif (p["acqua_inattesa"] > 0 and u[i] - self.u_rif[i] >= p["acqua_inattesa"]
                  and self.acqua_inattesa is None):
                self.acqua_inattesa = i
                self.memoria_cambiata = True
        # con una valvola bloccata aperta ogni irrigazione bagna anche quella zona: stop se è già troppo bagnata
        k = self.acqua_inattesa
        troppo_bagnata = k is not None and (u[k] is None or u[k] >= p["inattesa_max"])

        # 1. irrigazione in corso: condizioni di arresto
        z = self.zona
        if z is not None:
            durata = m - self.inizio
            if (basso or self.pompa_bloccata or allagamento or batteria_bassa or troppo_bagnata
                    or self.fermo_riavvii or (gelo and p["blocco_gelo"])):
                self._ferma(m)
            elif self.emergenza:
                if durata >= p["emergenza_durata_min"] or u[z] is not None:
                    self._ferma(m)
            elif u[z] is None or not attive[z]:
                self._ferma(m)
            elif u[z] >= soglia_off:
                self._ferma(m)
            elif durata >= p["max_min"]:
                self.da_verificare = (z, self.u_inizio, m)   # arrivata al tempo massimo: l'acqua è arrivata?
                self._ferma(m)
            if self.zona is not None and flusso is not None and not self.flusso_verificato \
                    and durata >= p["flusso_verifica_min"]:
                self.flusso_verificato = True
                if flusso < p["flusso_min_rel"] * p["portata_nominale_l_min"]:
                    self.pompa_bloccata = True
                    self.memoria_cambiata = True
                    self._ferma(m)
                elif flusso > p["flusso_max_rel"] * p["portata_nominale_l_min"]:
                    self.perdita[z] = True
                    self.memoria_cambiata = True
                    self._ferma(m)
            if self.zona is not None and not self.verificato and durata >= p["verifica_pompa_min"]:
                self.verificato = True
                # se nel frattempo il serbatoio è salito (pioggia dalla grondaia) la prova sulla pompa non vale
                misura_valida = (litri is not None and self.l_inizio is not None and litri <= self.l_inizio + 0.5
                                 and not (self.ultima_pioggia is not None and self.ultima_pioggia >= self.inizio)
                                 and not (p["livello_pieno_l"] is not None and litri >= p["livello_pieno_l"]))
                if flusso is None and misura_valida and self.l_inizio - litri < p["calo_minimo_l"]:
                    self.pompa_sospetta = (m, self.inizio)   # si ferma subito, l'allarme dopo la conferma
                    self._ferma(m)
                    self.da_verificare = None

        # 1b. verifica di efficacia a sensore "arrivato": umidità salita dopo l'irrigazione?
        if self.da_verificare is not None and m - self.da_verificare[2] >= p["verifica_dopo_min"]:
            zv, u0, _ = self.da_verificare
            self.da_verificare = None
            if u[zv] is not None and u[zv] - u0 < p["aumento_minimo"]:
                self.bloccata[zv] = True
                self.memoria_cambiata = True

        # 2. avvio di una nuova irrigazione: la zona più secca tra quelle che ne hanno bisogno
        if (self.zona is None and not basso and not self.pompa_bloccata and self.pompa_sospetta is None
                and not allagamento and not batteria_bassa
                and not troppo_bagnata and not self.fermo_riavvii and not (gelo and p["blocco_gelo"])
                and m - self.avvio >= p["attesa_avvio_min"]):
            scelta = None
            for i in range(self.n):
                if self.bloccata[i] or self.perdita[i] or self._in_pausa(i, m) or not attive[i]:
                    continue
                if u[i] is None:
                    if (p["emergenza_durata_min"] > 0 and not pioggia
                            and m - self.ultimo_emergenza[i] >= p["emergenza_ogni_min"]):
                        candidato = (2.0, i, True)     # dopo le zone con sensore buono
                    else:
                        continue
                elif u[i] < (p["soglia_critica"] if pioggia else soglia_on):
                    candidato = (u[i], i, False)
                else:
                    continue
                if scelta is None or candidato < scelta:
                    scelta = candidato
            if scelta is not None:
                self.zona, self.emergenza = scelta[1], scelta[2]
                self.inizio, self.verificato, self.flusso_verificato = m, False, False
                self.u_inizio, self.l_inizio = (u[self.zona] or 0.0), litri
                self.pompa_in_corso = True
                self.memoria_cambiata = True
                if self.emergenza:
                    self.ultimo_emergenza[self.zona] = m

        for i in range(self.n):
            if u[i] is not None and u[i] >= p["soglia_allagata"]:
                if m % 60 == 0:
                    self.ore_bagnata[i] += 1
            else:
                self.ore_bagnata[i] = 0

        allarmi = []
        for i in range(self.n):
            if u[i] is None:
                allarmi.append("Z%d_SENSORE" % (i + 1))
            if self.bloccata[i]:
                allarmi.append("Z%d_INEFFICACE" % (i + 1))
            if self.perdita[i]:
                allarmi.append("Z%d_PERDITA" % (i + 1))
            if self.ore_bagnata[i] >= p["allagata_ore"]:
                allarmi.append("Z%d_ALLAGATA" % (i + 1))
        if basso:
            allarmi.append("SERBATOIO_BASSO")
        elif riserva:
            allarmi.append("SERBATOIO_RISERVA")
        if self.pompa_bloccata:
            allarmi.append("POMPA_NON_EROGA")
        if self.acqua_inattesa is not None:
            allarmi.append("Z%d_ACQUA_INATTESA" % (self.acqua_inattesa + 1))
        if allagamento:
            allarmi.append("ALLAGAMENTO_QUADRO")
        if batteria_bassa:
            allarmi.append("BATTERIA_BASSA")
        if self.fermo_riavvii:
            allarmi.append("RIAVVII_FREQUENTI")
        if gelo:
            allarmi.append("GELO")
        if t is not None and t >= p["caldo_c"]:
            allarmi.append("CALDO")

        stato = []
        for i in range(self.n):
            if i == self.zona:
                stato.append("emergenza" if self.emergenza else "irriga")
            elif self.bloccata[i] or self.perdita[i]:
                stato.append("bloccata")
            elif u[i] is None:
                stato.append("sensore_guasto")
            elif self._in_pausa(i, m):
                stato.append("pausa")
            else:
                stato.append("attesa")
        return {
            "pompa": self.zona is not None,
            "valvole": [i == self.zona for i in range(self.n)],
            "umidita": u,
            "allarmi": allarmi,
            "stato": stato,
        }


class ControlloreTimer:
    """Programmatore a tempo (modo "manuale": nessun sensore di umidità). Ogni giorno alle ora_min irriga le zone
    una dopo l'altra per durata_min ciascuna. Sicurezze rimaste: serbatoio basso e acqua nel quadro fermano la pompa.
    Stessa interfaccia di Controllore.passo, così simulatore e firmware lo usano allo stesso modo."""

    def __init__(self, n_zone, ora_min=420, durata_min=15):
        self.n = n_zone
        self.ora = ora_min
        self.durata = durata_min

    def passo(self, letture):
        m = letture["minuto"]
        dal = m % 1440 - self.ora
        zona = None
        if self.durata > 0 and 0 <= dal < self.durata * self.n:
            zona = dal // self.durata
            attive = letture.get("zone_attive")
            if attive and not attive[zona]:
                zona = None                    # aiuola vuota: il rubinetto della zona resta chiuso
        basso = letture.get("serbatoio_basso", False)
        allagamento = letture.get("allagamento", False)
        if basso or allagamento:
            zona = None
        allarmi = []
        if basso:
            allarmi.append("SERBATOIO_BASSO")
        if allagamento:
            allarmi.append("ALLAGAMENTO_QUADRO")
        return {"pompa": zona is not None, "valvole": [i == zona for i in range(self.n)],
                "umidita": [None] * self.n, "allarmi": allarmi,
                "stato": ["irriga" if i == zona else "attesa" for i in range(self.n)]}
