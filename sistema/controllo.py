# Logica di controllo dell'impianto AgriTech.
# È la STESSA che gira sull'ESP32 (MicroPython, firmware/esp32-irrigazione) e nel simulatore (Python sul PC):
# quello che si prova in virtuale è esattamente quello che poi comanda pompa e valvole.
# Per restare compatibile con MicroPython: niente librerie, niente f-string, niente dataclass, niente typing.
#
# Impianto: 1 pompa + 1 valvola per zona, serbatoio con galleggiante di minimo (e se c'è sensore di livello in litri),
# 1 sensore di umidità capacitivo per zona, sensore di temperatura aria facoltativo.
# Il tempo arriva da fuori in minuti (lettura "minuto"): così il simulatore può accelerarlo.
#
# Sicurezze sempre attive, anche senza rete:
#   - pompa ferma con serbatoio basso (mai a secco);
#   - tempo massimo di irrigazione e pausa minima tra due irrigazioni della stessa zona;
#   - una zona alla volta (la pompa non basta per tutte);
#   - sensore fuori campo (staccato, in corto) -> zona in "emergenza": poca acqua a tempo, mai a sensore;
#   - irrigazione inefficace (l'umidità non sale: tubo rotto, valvola bloccata, sensore fuori dalla terra)
#     -> zona bloccata fino a reset manuale;
#   - pompa che non eroga (il serbatoio non scende) -> irrigazione bloccata fino a reset manuale;
#   - attesa dopo l'accensione prima della prima irrigazione.

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
    "verifica_dopo_min": 8,        # dopo questi minuti di acqua si controlla che funzioni
    "aumento_minimo": 0.01,        # ...l'umidità deve essere salita almeno di tanto
    "calo_minimo_l": 1.0,          # ...e il serbatoio (se misurato) deve essere sceso almeno di tanto
    "emergenza_ogni_min": 1440,    # zona con sensore guasto: un'irrigazione al giorno
    "emergenza_durata_min": 3,     # ...di 3 minuti (0 = nessuna irrigazione in emergenza)
    "gelo_c": 2.0,
    "caldo_c": 38.0,
}


class Controllore:
    def __init__(self, n_zone, parametri=None):
        p = dict(PARAMETRI_DEFAULT)
        if parametri:
            p.update(parametri)
        if p["verifica_dopo_min"] >= p["max_min"]:
            raise ValueError("verifica_dopo_min deve essere minore di max_min")
        self.p = p
        self.n = n_zone
        self.avvio = None
        self.zona = None               # zona che sta irrigando (indice) o None
        self.inizio = 0
        self.emergenza = False         # l'irrigazione in corso è a tempo (sensore guasto)
        self.verificato = False
        self.u_inizio = 0.0
        self.l_inizio = None
        self.ultima_fine = [None] * n_zone
        self.ultimo_emergenza = [None] * n_zone
        self.bloccata = [False] * n_zone
        self.pompa_bloccata = False

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
        self.pompa_bloccata = False

    def _ferma(self, minuto):
        self.ultima_fine[self.zona] = minuto
        self.zona = None

    def _in_pausa(self, i, minuto):
        f = self.ultima_fine[i]
        return f is not None and minuto - f < self.p["pausa_min"]

    def passo(self, letture):
        """Da chiamare ogni minuto. letture: minuto, adc (lista per zona), serbatoio_basso, serbatoio_l (o None),
        temp_c (o None), pioggia_prevista_mm. Restituisce pompa, valvole, umidita, allarmi, stato."""
        p = self.p
        m = letture["minuto"]
        if self.avvio is None:
            self.avvio = m
        u = [self.umidita(a) for a in letture["adc"]]
        basso = letture.get("serbatoio_basso", False)
        litri = letture.get("serbatoio_l")
        pioggia = letture.get("pioggia_prevista_mm", 0.0) >= p["pioggia_salta_mm"]

        for i in range(self.n):
            if u[i] is None:
                if self.ultimo_emergenza[i] is None:
                    self.ultimo_emergenza[i] = m       # la prima dose arriva dopo emergenza_ogni_min
            else:
                self.ultimo_emergenza[i] = None

        # 1. irrigazione in corso: condizioni di arresto
        z = self.zona
        if z is not None:
            durata = m - self.inizio
            if basso or self.pompa_bloccata:
                self._ferma(m)
            elif self.emergenza:
                if durata >= p["emergenza_durata_min"] or u[z] is not None:
                    self._ferma(m)
            elif u[z] is None:
                self._ferma(m)
            elif u[z] >= p["soglia_off"] or durata >= p["max_min"]:
                self._ferma(m)
            if self.zona is not None and not self.verificato and durata >= p["verifica_dopo_min"]:
                self.verificato = True
                # se nel frattempo il serbatoio è salito (pioggia dalla grondaia) la prova sulla pompa non vale
                misura_valida = litri is not None and self.l_inizio is not None and litri <= self.l_inizio + 0.5
                if misura_valida and self.l_inizio - litri < p["calo_minimo_l"]:
                    self.pompa_bloccata = True
                    self._ferma(m)
                elif not self.emergenza and u[z] - self.u_inizio < p["aumento_minimo"]:
                    self.bloccata[z] = True
                    self._ferma(m)

        # 2. avvio di una nuova irrigazione: la zona più secca tra quelle che ne hanno bisogno
        if (self.zona is None and not basso and not self.pompa_bloccata
                and m - self.avvio >= p["attesa_avvio_min"]):
            scelta = None
            for i in range(self.n):
                if self.bloccata[i] or self._in_pausa(i, m):
                    continue
                if u[i] is None:
                    if (p["emergenza_durata_min"] > 0 and not pioggia
                            and m - self.ultimo_emergenza[i] >= p["emergenza_ogni_min"]):
                        candidato = (2.0, i, True)     # dopo le zone con sensore buono
                    else:
                        continue
                elif u[i] < (p["soglia_critica"] if pioggia else p["soglia_on"]):
                    candidato = (u[i], i, False)
                else:
                    continue
                if scelta is None or candidato < scelta:
                    scelta = candidato
            if scelta is not None:
                self.zona, self.emergenza = scelta[1], scelta[2]
                self.inizio, self.verificato = m, False
                self.u_inizio, self.l_inizio = (u[self.zona] or 0.0), litri
                if self.emergenza:
                    self.ultimo_emergenza[self.zona] = m

        allarmi = []
        for i in range(self.n):
            if u[i] is None:
                allarmi.append("Z%d_SENSORE" % (i + 1))
            if self.bloccata[i]:
                allarmi.append("Z%d_INEFFICACE" % (i + 1))
        if basso:
            allarmi.append("SERBATOIO_BASSO")
        if self.pompa_bloccata:
            allarmi.append("POMPA_NON_EROGA")
        t = letture.get("temp_c")
        if t is not None and t <= p["gelo_c"]:
            allarmi.append("GELO")
        if t is not None and t >= p["caldo_c"]:
            allarmi.append("CALDO")

        stato = []
        for i in range(self.n):
            if i == self.zona:
                stato.append("emergenza" if self.emergenza else "irriga")
            elif self.bloccata[i]:
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
