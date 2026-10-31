# Logica di controllo dell'impianto idroponico AgriTech.
# È la STESSA che gira sull'ESP32 (MicroPython, firmware/esp32-idroponica) e nel simulatore (sistema/idro_modello.py):
# quello che si prova in virtuale è esattamente quello che poi comanda pompe, dosatori e prese.
# Compatibile MicroPython: niente librerie, niente f-string, niente dataclass, niente typing.
#
# Tre modalità:
#   "simulazione"  nessun hardware: comanda il serbatoio simulato;
#   "ombra"        legge i sensori veri ma NON comanda niente: dice cosa farebbe (per provare la logica sull'impianto
#                  vero senza rischi, per esempio una settimana prima di lasciarla fare);
#   "reale"        comanda davvero; si attiva SOLO con "conferma_reale": True nei parametri, altrimenti resta in ombra.
#
# Sicurezze sempre attive, anche senza rete né server (nessuna previsione o AI può scavalcarle):
#   - perdita d'acqua sul pavimento -> tutto spento (pompa, dosatori, rabbocco, luci) fino a reset manuale;
#   - serbatoio sotto il minimo -> pompa e dosatori fermi (mai a secco, mai dosi in poca acqua);
#   - rabbocco solo fino al galleggiante di massimo, con tempo massimo;
#   - pompa accesa ma flusso assente -> allarme; dopo 3 tentativi pompa ferma fino a reset (si brucia a secco);
#   - dosaggio solo con letture valide e stabili, a piccole dosi, con attesa di miscelazione tra una dose e l'altra,
#     prima i nutrienti e poi il pH (mai insieme), limite giornaliero per ogni dosatore;
#   - dosi che non spostano la lettura (flacone vuoto, tubo tappato, sonda sbagliata) -> dosaggio bloccato fino a reset;
#   - sonda fuori campo, bloccata (stesso valore per un'ora) o che salta -> dosaggio di quella grandezza bloccato;
#   - dopo un'accensione o un blackout: niente dosi per 15 minuti e finché le letture non sono stabili;
#   - penna di controllo (inserita a mano ogni settimana) diversa dalla sonda di più di 0,3 -> niente pH- fino a
#     taratura: è l'unico modo di scoprire una sonda che deriva piano;
#   - acqua troppo calda, aria fuori campo: allarme e estrattore/stufetta con isteresi;
#   - pulsante di arresto: tutto spento subito, prima di qualsiasi altra regola;
#   - letture vecchie (sonda che non manda dati da più di 5 minuti) trattate come mancanti;
#   - dosatore bloccato acceso (EC che sale o pH che crolla senza dosi né rabbocchi) -> taglio dell'alimentazione dei
#     dosatori, un'uscita separata che nel quadro apre un relè in serie a tutti i dosatori.
#
# Macchina a stati del dosaggio (c["stato_dosaggio"]): DISABILITATO, ATTESA, VERIFICA_PREREQUISITI, PRONTO, DOSAGGIO,
# MISCELAZIONE, VERIFICA_RISULTATO, BLOCCO_SICUREZZA, INTERVENTO_MANUALE.
# Il modo "reale" richiede anche il collaudo documentato (parametro "collaudo", tutte le voci a True) e una taratura
# del pH recente: altrimenti resta in ombra e dice cosa manca. Le sicurezze hardware indipendenti dal firmware sono
# descritte in firmware/esp32-idroponica/LEGGIMI.md: nessuna di queste regole software le sostituisce.

PARAMETRI_IDRO = {
    "modo": "simulazione",          # "simulazione", "ombra", "reale"
    "conferma_reale": False,        # per "reale" serve anche questo a True (scelta esplicita)
    "volume_l": 120,
    "ph_obiettivo": 5.9, "ph_banda": 0.25,        # dosa pH- sopra 6,15
    "ec_obiettivo": 1.2, "ec_banda": 0.1,         # dosa A+B sotto 1,1
    "ml_ab_per_l": 0.03,            # mL di A (e di B) per litro a ogni dose: 120 L -> 3,6 mL
    "ml_ph_per_l": 0.01,            # mL di pH- per litro a ogni dose: 120 L -> 1,2 mL
    "max_ab_giorno_ml_per_l": 0.25, # al giorno, per ciascun dosatore A e B
    "max_ph_giorno_ml_per_l": 0.15, # l'acqua di rete che rabbocca porta bicarbonati: è lei che fa salire il pH
    "scarto_penna_ph": 0.3,         # sonda e penna di controllo diverse di più: sonda da tarare, niente dosi di pH-
    "attesa_miscela_s": 600,        # tra due dosi della stessa grandezza
    "attesa_ph_dopo_ab_s": 900,     # il pH si corregge solo dopo che i nutrienti si sono mescolati
    "attesa_avvio_s": 900,
    "letture_stabili": 5, "stabile_ph": 0.08, "stabile_ec": 0.05,
    "ph_valido": (3.0, 10.0), "ec_valido": (0.05, 5.0), "t_acqua_valida": (1.0, 45.0),
    "bloccato_s": 3600,             # stesso valore identico per un'ora: sonda bloccata
    "salto_ph": 1.0, "salto_ec": 0.6,             # salti tra due letture non spiegati da una dose
    "dosi_senza_effetto": 3,
    "effetto_ec_min": 0.02, "effetto_ph_min": 0.03,
    "flusso_verifica_s": 90, "flusso_min_l_min": 0.3, "tentativi_pompa": 3, "pausa_pompa_s": 300,
    "pompa_on_s": None, "pompa_off_s": None,     # None = sempre accesa (NFT); torri: 900 / 900
    "rabbocco_max_s": 600,
    "luce_inizio_h": 20, "luce_ore": 16,
    "t_acqua_max": 26.0,
    "t_aria_max": 26.0, "t_aria_min": 16.0, "isteresi": 1.0,
    "ur_max": 75.0,
    "dosaggio_abilitato": True,     # False = nessuna dose automatica: il controllo propone, tu dosi a mano
    "eta_max_s": 300,               # letture più vecchie di 5 minuti valgono come mancanti
    "salto_bloccato_ec": 0.3, "salto_bloccato_ph": 0.5,   # in 10 minuti senza dosi né rabbocchi: dosatore bloccato
    "taratura_ph_giorno": None,     # giorno (s // 86400) dell'ultima taratura del pH, per il modo reale
    "autotest_max_s": 86400,        # modo reale: autotest del taglio hardware riuscito da non più di tanto
    "verifica_installazione": None, # modo reale: risultato di sistema/sicurezza_dosaggio.verifica_installazione (esito "sicuro")
    "taratura_max_giorni": 30,
    "collaudo": {},                 # per il modo reale: tutte le voci di COLLAUDO_RICHIESTO a True
}
COLLAUDO_RICHIESTO = ("portata_dosatori_misurata", "settimana_in_ombra", "prova_perdita", "prova_galleggianti",
                      "prova_flusso", "prova_blackout", "taglio_hardware_provato", "arresto_emergenza_provato",
                      "titolazione_fatta", "flussostato_provato", "timer_hardware_provato")

ALLARMI_FISSI = ("PERDITA", "FLUSSO_ASSENTE", "DOSAGGIO_INEFFICACE_EC", "DOSAGGIO_INEFFICACE_PH", "SONDA_PH_DA_TARARE",
                 "ARRESTO_EMERGENZA", "DOSATORE_BLOCCATO")


class ControlloIdro:
    def __init__(self, parametri=None, s_avvio=0, memoria=None):
        p = {}
        for k in PARAMETRI_IDRO:
            p[k] = PARAMETRI_IDRO[k]
        if parametri:
            for k in parametri:
                p[k] = parametri[k]
        self.p = p
        self.s_avvio = s_avvio
        self.chiave_fisica = False      # ingressi fisici per il modo reale (aggiornati da passo)
        self.ultimo_autotest = None
        # memoria che sopravvive ai riavvii (il firmware la salva su file): allarmi fissi e dosi del giorno
        m = memoria or {}
        self.fissi = list(m.get("fissi", []))
        self.giorno = m.get("giorno", -1)
        self.dosato = dict(m.get("dosato", {"a": 0.0, "b": 0.0, "ph": 0.0}))
        self.storico = {"ph": [], "ec": []}
        self.ultimo = {"ph": None, "ec": None}
        self.uguale_da = {"ph": None, "ec": None}
        self.dose_s = {"ec": -10 ** 9, "ph": -10 ** 9}
        self.attesa_verifica = {"ec": None, "ph": None}     # (valore prima della dose, s)
        self.senza_effetto = {"ec": 0, "ph": 0}
        self.pompa_da = None
        self.tentativi = 0
        self.pompa_ferma_fino = -1
        self.rabbocco_da = None
        self.estrattore = False
        self.stufetta = False
        self.stato_dosaggio = "ATTESA"
        self.rif = None                 # (s, ec, ph) di 10 minuti fa per scoprire un dosatore bloccato
        self.ultima_azione = -10 ** 9   # ultima dose o rabbocco

    def memoria(self):
        return {"fissi": list(self.fissi), "giorno": self.giorno, "dosato": dict(self.dosato)}

    def prerequisiti_mancanti(self, s=None):
        """Il modo reale non si accende con un parametro: servono anche due prove FISICHE lette dagli ingressi
        (chiave a interruttore chiusa e autotest recente del taglio dell'alimentazione dei dosatori) e la verifica
        della dose massima sull'impianto vero (sicurezza_dosaggio.py)."""
        p, manca = self.p, []
        if not self.chiave_fisica:
            manca.append("chiave_fisica")
        if self.ultimo_autotest is None or (s is not None and s - self.ultimo_autotest > p["autotest_max_s"]):
            manca.append("autotest_taglio")
        vi = p.get("verifica_installazione")
        if not (isinstance(vi, dict) and vi.get("esito") == "sicuro"):
            manca.append("verifica_installazione")
        if not p["conferma_reale"]:
            manca.append("conferma_reale")
        coll = p.get("collaudo") or {}
        for k in COLLAUDO_RICHIESTO:
            if not coll.get(k):
                manca.append("collaudo:" + k)
        if p.get("taratura_ph_giorno") is None:
            manca.append("taratura_ph")
        elif s is not None and s // 86400 - p["taratura_ph_giorno"] > p["taratura_max_giorni"]:
            manca.append("taratura_ph_scaduta")
        return manca

    def modo_effettivo(self, s=None):
        m = self.p["modo"]
        if m == "reale" and self.prerequisiti_mancanti(s):
            return "ombra"
        return m

    def _fisso(self, nome):
        if nome not in self.fissi:
            self.fissi.append(nome)

    def reset(self):
        self.fissi = []
        self.tentativi = 0
        self.pompa_ferma_fino = -1
        self.senza_effetto = {"ec": 0, "ph": 0}

    # ---- sonde: valida, stabile, bloccata, salti ----
    def _sonda(self, nome, v, s, campo, salto, stabile, note):
        if v is None or v != v or v < campo[0] or v > campo[1]:
            note.append(nome.upper() + "_FUORI_CAMPO")
            self.storico[nome] = []
            return None
        prec = self.ultimo[nome]
        if prec is not None and v == prec:
            if self.uguale_da[nome] is None:
                self.uguale_da[nome] = s
            elif s - self.uguale_da[nome] >= self.p["bloccato_s"]:
                note.append(nome.upper() + "_BLOCCATA")
                return None
        else:
            self.uguale_da[nome] = None
        dosato_da_poco = s - self.dose_s[nome] < self.p["attesa_miscela_s"]
        if prec is not None and abs(v - prec) > salto and not dosato_da_poco:
            note.append(nome.upper() + "_SALTO")
            self.storico[nome] = []
        self.ultimo[nome] = v
        st = self.storico[nome]
        st.append(v)
        if len(st) > self.p["letture_stabili"]:
            st.pop(0)
        if len(st) < self.p["letture_stabili"] or max(st) - min(st) > stabile:
            return "instabile"
        return sum(st) / len(st)

    def passo(self, l):
        p = self.p
        s = l["s"]
        # prove fisiche per il modo reale: vengono dagli ingressi a ogni passo, non dai parametri
        self.chiave_fisica = l.get("chiave_reale") is True
        self.ultimo_autotest = l.get("autotest_taglio_s")
        if l.get("reset") and not l.get("arresto"):
            self.reset()
        allarmi = []
        note = []
        c = {"pompa": False, "luci": False, "dose_a_ml": 0.0, "dose_b_ml": 0.0, "dose_ph_ml": 0.0, "rabbocco": False,
             "estrattore": False, "stufetta": False}
        giorno = s // 86400
        if giorno != self.giorno:
            self.giorno = giorno
            self.dosato = {"a": 0.0, "b": 0.0, "ph": 0.0}
        c["taglio_dosatori"] = False
        # 0. arresto di emergenza: prima di tutto
        if l.get("arresto"):
            self._fisso("ARRESTO_EMERGENZA")
        if "ARRESTO_EMERGENZA" in self.fissi:
            c["taglio_dosatori"] = True
            self.stato_dosaggio = "INTERVENTO_MANUALE"
            return self._fine(c, allarmi, note, "arresto di emergenza: tutto spento", s)
        # 1. perdita: tutto spento, allarme fisso
        if l.get("perdita"):
            self._fisso("PERDITA")
        if "PERDITA" in self.fissi:
            c["taglio_dosatori"] = True
            self.stato_dosaggio = "INTERVENTO_MANUALE"
            return self._fine(c, allarmi, note, "perdita: tutto spento", s)
        livello_ok = l.get("livello_min", True)
        if not livello_ok:
            allarmi.append("LIVELLO_BASSO")
        # 2. luci a orario (ora del giorno in secondi)
        ora = (s % 86400) / 3600.0
        fine = (p["luce_inizio_h"] + p["luce_ore"]) % 24
        if p["luce_inizio_h"] < fine:
            c["luci"] = p["luce_inizio_h"] <= ora < fine
        else:
            c["luci"] = ora >= p["luce_inizio_h"] or ora < fine
        # 3. pompa con verifica del flusso
        pompa_voluta = livello_ok and "FLUSSO_ASSENTE" not in self.fissi and s >= self.pompa_ferma_fino
        if pompa_voluta and p["pompa_on_s"]:
            ciclo = p["pompa_on_s"] + p["pompa_off_s"]
            pompa_voluta = (s % ciclo) < p["pompa_on_s"]
        if pompa_voluta:
            if self.pompa_da is None:
                self.pompa_da = s
            f = l.get("flusso_l_min")
            if f is not None and s - self.pompa_da >= p["flusso_verifica_s"] and f < p["flusso_min_l_min"]:
                self.tentativi += 1
                allarmi.append("FLUSSO_ASSENTE")
                self.pompa_da = None
                if self.tentativi >= p["tentativi_pompa"]:
                    self._fisso("FLUSSO_ASSENTE")
                else:
                    self.pompa_ferma_fino = s + p["pausa_pompa_s"]
                pompa_voluta = False
            elif f is not None and f >= p["flusso_min_l_min"]:
                self.tentativi = 0
        else:
            self.pompa_da = None
        c["pompa"] = pompa_voluta
        # 4. rabbocco fino al massimo, con tempo massimo
        # (anche sotto il minimo: se è una perdita, il sensore a pavimento spegne tutto)
        if not l.get("livello_max", False) and l.get("rabbocco_serve", True):
            if self.rabbocco_da is None:
                self.rabbocco_da = s
            if s - self.rabbocco_da <= p["rabbocco_max_s"]:
                c["rabbocco"] = True
                # acqua nuova durante l'attesa: la verifica dell'effetto della dose non vale
                self.attesa_verifica = {"ec": None, "ph": None}
                self.ultima_azione = s
            else:
                allarmi.append("RABBOCCO_TROPPO_LUNGO")
        else:
            self.rabbocco_da = None
        # 5. clima con isteresi
        ta = l.get("t_aria")
        if ta is not None:
            if ta > p["t_aria_max"]:
                self.estrattore = True
            elif ta < p["t_aria_max"] - p["isteresi"]:
                self.estrattore = False
            if ta < p["t_aria_min"]:
                self.stufetta = True
            elif ta > p["t_aria_min"] + p["isteresi"]:
                self.stufetta = False
            if ta > p["t_aria_max"] + 3:
                allarmi.append("CALDO")
            if ta < p["t_aria_min"] - 3:
                allarmi.append("FREDDO")
        if l.get("ur") is not None and l["ur"] > p["ur_max"]:
            self.estrattore = True
            allarmi.append("UMIDITA_ALTA")
        c["estrattore"] = self.estrattore
        c["stufetta"] = self.stufetta and not self.estrattore
        tw = l.get("t_acqua")
        if tw is not None and p["t_acqua_valida"][0] <= tw <= p["t_acqua_valida"][1] and tw > p["t_acqua_max"]:
            allarmi.append("ACQUA_CALDA")
        # 6. dosaggio
        for nome in ("ph", "ec"):                       # dati vecchi = mancanti
            if l.get(nome + "_eta_s") is not None and l[nome + "_eta_s"] > p["eta_max_s"]:
                note.append(nome.upper() + "_DATI_VECCHI")
                l = dict(l)
                l[nome] = None
        # dosatore bloccato acceso: EC che sale di 0,3 o pH che scende di 0,5 rispetto a 10 minuti prima. Una dose
        # permessa sposta molto meno (EC +0,02, pH -0,1) e il rabbocco va nel verso opposto (EC giù, pH su): nessuno
        # dei due copre il controllo. Durante la manutenzione a mano (l["manutenzione"]) il controllo è sospeso.
        ec_g, ph_g = l.get("ec"), l.get("ph")
        if self.rif is not None and not l.get("manutenzione") and ec_g is not None and ph_g is not None and self.rif[1] is not None and self.rif[2] is not None:
            if ec_g - self.rif[1] > p["salto_bloccato_ec"] or self.rif[2] - ph_g > p["salto_bloccato_ph"]:
                self._fisso("DOSATORE_BLOCCATO")
        if self.rif is None or s - self.rif[0] >= 600:
            self.rif = (s, ec_g, ph_g)
        if "DOSATORE_BLOCCATO" in self.fissi:
            c["taglio_dosatori"] = True
        ph = self._sonda("ph", l.get("ph"), s, p["ph_valido"], p["salto_ph"], p["stabile_ph"], note)
        # controllo incrociato con la penna (lettura a mano inserita dall'utente): unica difesa contro la deriva lenta
        if l.get("ph_penna") is not None and self.ultimo["ph"] is not None and abs(self.ultimo["ph"] - l["ph_penna"]) > p["scarto_penna_ph"]:
            self._fisso("SONDA_PH_DA_TARARE")
        ec = self._sonda("ec", l.get("ec"), s, p["ec_valido"], p["salto_ec"], p["stabile_ec"], note)
        self._verifica_effetto("ec", ec, s, +1)
        self._verifica_effetto("ph", ph, s, -1)
        avviato = s - self.s_avvio >= p["attesa_avvio_s"]
        bloccanti = [a for a in self.fissi if a in ("FLUSSO_ASSENTE", "DOSAGGIO_INEFFICACE_EC", "DOSAGGIO_INEFFICACE_PH", "SONDA_PH_DA_TARARE", "DOSATORE_BLOCCATO")]
        puo = livello_ok and c["pompa"] and avviato and p["dosaggio_abilitato"] and not c["taglio_dosatori"]
        if not puo:
            note.append("DOSAGGIO_IN_ATTESA")
        V = p["volume_l"]
        if puo and isinstance(ec, float) and "DOSAGGIO_INEFFICACE_EC" not in self.fissi:
            if ec < p["ec_obiettivo"] - p["ec_banda"] and s - self.dose_s["ec"] >= p["attesa_miscela_s"]:
                ml = p["ml_ab_per_l"] * V
                if self.dosato["a"] + ml <= p["max_ab_giorno_ml_per_l"] * V:
                    c["dose_a_ml"] = ml
                    c["dose_b_ml"] = ml
                    self.dosato["a"] += ml
                    self.dosato["b"] += ml
                    self.dose_s["ec"] = s
                    self.attesa_verifica["ec"] = (ec, s)
                    self.ultima_azione = s
                else:
                    allarmi.append("LIMITE_GIORNALIERO_NUTRIENTI")
        nutrienti_recenti = s - self.dose_s["ec"] < p["attesa_ph_dopo_ab_s"]
        if puo and isinstance(ph, float) and not nutrienti_recenti and c["dose_a_ml"] == 0 and "DOSAGGIO_INEFFICACE_PH" not in self.fissi and "SONDA_PH_DA_TARARE" not in self.fissi:
            if ph > p["ph_obiettivo"] + p["ph_banda"] and s - self.dose_s["ph"] >= p["attesa_miscela_s"]:
                ml = p["ml_ph_per_l"] * V
                if self.dosato["ph"] + ml <= p["max_ph_giorno_ml_per_l"] * V:
                    c["dose_ph_ml"] = ml
                    self.dosato["ph"] += ml
                    self.dose_s["ph"] = s
                    self.attesa_verifica["ph"] = (ph, s)
                    self.ultima_azione = s
                else:
                    allarmi.append("LIMITE_GIORNALIERO_PH")
        if isinstance(ph, float) and (ph < 5.0 or ph > 7.0):
            allarmi.append("PH_FUORI")
        if isinstance(ec, float) and (ec < p["ec_obiettivo"] - 0.4 or ec > p["ec_obiettivo"] + 0.6):
            allarmi.append("EC_FUORI")
        for n in note:
            if n.endswith("_BLOCCATA") or n.endswith("_FUORI_CAMPO") or n.endswith("_DATI_VECCHI"):
                allarmi.append("SONDA_" + n)
        # macchina a stati: dice in che fase è il dosaggio (e perché non dosa)
        if not p["dosaggio_abilitato"]:
            self.stato_dosaggio = "DISABILITATO"
        elif bloccanti or c["taglio_dosatori"]:
            self.stato_dosaggio = "INTERVENTO_MANUALE"
        elif not avviato:
            self.stato_dosaggio = "ATTESA"
        elif not livello_ok or not c["pompa"] or (ph is None and ec is None):
            self.stato_dosaggio = "BLOCCO_SICUREZZA"
        elif c["dose_a_ml"] or c["dose_ph_ml"]:
            self.stato_dosaggio = "DOSAGGIO"
        elif s - max(self.dose_s["ec"], self.dose_s["ph"]) < p["attesa_miscela_s"]:
            self.stato_dosaggio = "MISCELAZIONE"
        elif self.attesa_verifica["ec"] is not None or self.attesa_verifica["ph"] is not None:
            self.stato_dosaggio = "VERIFICA_RISULTATO"
        elif not isinstance(ph, float) or not isinstance(ec, float):
            self.stato_dosaggio = "VERIFICA_PREREQUISITI"
        else:
            self.stato_dosaggio = "PRONTO"
        return self._fine(c, allarmi, note, None, s)

    def _verifica_effetto(self, nome, v, s, verso):
        # dopo l'attesa di miscelazione la lettura deve essersi spostata nel verso giusto
        av = self.attesa_verifica[nome]
        if av is None or not isinstance(v, float) or s - av[1] < self.p["attesa_miscela_s"]:
            return
        minimo = self.p["effetto_ec_min"] if nome == "ec" else self.p["effetto_ph_min"]
        if (v - av[0]) * verso >= minimo:
            self.senza_effetto[nome] = 0
        else:
            self.senza_effetto[nome] += 1
            if self.senza_effetto[nome] >= self.p["dosi_senza_effetto"]:
                self._fisso("DOSAGGIO_INEFFICACE_" + nome.upper())
        self.attesa_verifica[nome] = None

    def _fine(self, c, allarmi, note, motivo, s=None):
        for a in self.fissi:
            if a not in allarmi:
                allarmi.append(a)
        c["allarmi"] = allarmi
        c["note"] = note
        modo = self.modo_effettivo(s)
        c["modo"] = modo
        c["stato_dosaggio"] = self.stato_dosaggio
        if self.p["modo"] == "reale" and modo == "ombra":
            c["note"].append("REALE_NON_ATTIVO: " + ", ".join(self.prerequisiti_mancanti(s)))
        if modo == "ombra":
            # niente esce davvero: si riporta cosa si farebbe
            proposti = {}
            for k in ("pompa", "luci", "dose_a_ml", "dose_b_ml", "dose_ph_ml", "rabbocco", "estrattore", "stufetta", "taglio_dosatori"):
                proposti[k] = c[k]
                c[k] = 0.0 if k.startswith("dose") else False
            c["proposti"] = proposti
        if motivo:
            c["note"].append(motivo)
        return c
