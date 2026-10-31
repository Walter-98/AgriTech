"""Mondo virtuale dell'impianto: terreno e piante per zona, meteo ora per ora, cisterna dell'acqua piovana, pompa,
valvole, sensori, quadro elettrico, alimentazione (rete o pannello solare con batteria).

Sostituisce l'hardware nelle prove: produce le stesse letture che darebbe l'ESP32 (valori ADC grezzi con rumore e
ritardo, galleggiante, litri, flusso, temperatura, acqua nel quadro, batteria) e riceve gli stessi comandi (pompa,
valvole). Permette di iniettare guasti e meteo estremo. È un modello didattico: i numeri veri si tarano poi sul banco
e in campo (COLLAUDO.md, prove C2).
"""
import csv
import math
import random

ET0_MESE = {1: 1.0, 2: 1.5, 3: 2.5, 4: 3.5, 5: 4.5, 6: 5.5, 7: 6.0, 8: 5.5, 9: 4.0, 10: 2.5, 11: 1.5, 12: 1.0}
PIOGGIA_MESE = {1: (0.35, 8), 2: (0.33, 8), 3: (0.30, 7), 4: (0.30, 7), 5: (0.22, 6), 6: (0.12, 6), 7: (0.06, 6),
                8: (0.08, 8), 9: (0.18, 9), 10: (0.28, 10), 11: (0.35, 10), 12: (0.37, 9)}
TEMP_MESE = {1: 9, 2: 10, 3: 12, 4: 15, 5: 19, 6: 23, 7: 26, 8: 26, 9: 23, 10: 18, 11: 14, 12: 10}  # media °C
ORE_SOLE_MESE = {1: 2.5, 2: 3.2, 3: 4.3, 4: 5.2, 5: 6.2, 6: 7.0, 7: 7.3, 8: 6.5, 9: 5.2, 10: 3.8, 11: 2.7, 12: 2.2}

STRESS = 0.30          # sotto: la pianta soffre
ASFISSIA_ORE = 24      # ristagno continuo oltre queste ore: radici senza ossigeno, danno alla coltura


def meteo_sintetico(mese, giorni, seme):
    rnd = random.Random(seme)
    prob, mm = PIOGGIA_MESE[mese]
    righe = []
    for _ in range(giorni):
        piove = rnd.random() < prob
        righe.append({"et0": max(0.3, rnd.gauss(ET0_MESE[mese], ET0_MESE[mese] * 0.15)),
                      "pioggia": rnd.expovariate(1 / mm) if piove else 0.0,
                      "t_media": TEMP_MESE[mese] + rnd.gauss(0, 2), "nuvoloso": piove, "mese": mese})
    return righe


def leggi_meteo_csv(percorso):
    """CSV con colonne et0_mm, pioggia_mm e facoltative t_media, t_min, t_max, data (es. da strumenti/scarica_meteo.py)."""
    righe = []
    with open(percorso, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            g = {"et0": float(r["et0_mm"]), "pioggia": float(r["pioggia_mm"])}
            if r.get("t_min") and r.get("t_max"):
                g["t_media"] = (float(r["t_min"]) + float(r["t_max"])) / 2
                g["escursione"] = float(r["t_max"]) - float(r["t_min"])
            elif r.get("t_media"):
                g["t_media"] = float(r["t_media"])
            else:
                g["t_media"] = 18.0
            g["nuvoloso"] = g["pioggia"] > 1
            if r.get("data"):
                g["data"] = r["data"]
                g["mese"] = int(r["data"][5:7])
            righe.append(g)
    return righe


def ore_pioggia(g):
    """mm di pioggia per ora del giorno: quelli indicati o, di default, distribuiti tra le 14 e le 17."""
    if "ore_pioggia" in g:
        return g["ore_pioggia"]
    return {14: g["pioggia"] / 3, 15: g["pioggia"] / 3, 16: g["pioggia"] / 3} if g["pioggia"] > 0 else {}


class Mondo:
    def __init__(self, zone, meteo, serbatoio_l=800.0, capacita_serbatoio_l=1000.0, galleggiante_l=50.0,
                 tetto_m2=10.0, portata_l_min=1.0, sensore_livello=True, flussimetro=False, sensore_pioggia=True,
                 escursione_c=10.0, seme=1, adc_secco=3000, adc_bagnato=1300, ritardo_sensore_min=5.0,
                 quadro_altezza_mm=300.0, sensore_allagamento_mm=None, energia=None, guasti=None, rumore=1.0,
                 pioggia_zone=True, rumore_sensore=None):
        self.zone = [dict(z) for z in zone]
        for z in self.zone:
            z.setdefault("capacita_mm", 60.0)     # acqua disponibile massima nello strato delle radici
            z.setdefault("drenaggio_mm_h", 8.0)   # quanto in fretta se ne va l'acqua in superficie
            z["acqua"] = z["capacita_mm"] * z.get("umidita", 0.6)
            z["superficie"] = 0.0                 # mm d'acqua ferma sopra il terreno saturo
            z["letta"] = 0.92 * z["acqua"] / z["capacita_mm"]
            z.setdefault("efficienza", 1.0)       # quota dell'acqua erogata che arriva alle radici (goccia 0,9)
            z.setdefault("bias", 0.0)             # errore del sensore (deriva), in frazione di umidità
            z.setdefault("attiva", True)          # False = aiuola vuota: il controllore non la irriga
            z.setdefault("portata_l_min", portata_l_min)
            z["litri"] = z["persi"] = z["sprecati"] = 0.0   # per zona: arrivati, persi dai tubi, finiti in ristagno
        self.meteo = meteo
        self.serbatoio = serbatoio_l
        self.capacita = capacita_serbatoio_l
        self.galleggiante_l = galleggiante_l
        self.tetto = tetto_m2
        self.portata = portata_l_min
        self.sensore_livello = sensore_livello
        self.flussimetro = flussimetro
        self.sensore_pioggia = sensore_pioggia
        self.escursione = escursione_c
        self.rnd = random.Random(seme)
        self.rumore = rumore            # 0 = letture senza rumore (confronti esatti con il motore del browser)
        self.rumore_sensore = rumore if rumore_sensore is None else rumore_sensore   # solo sensori di umidità
        self.pioggia_zone = pioggia_zone  # False = serra o garage: la pioggia va solo nella cisterna
        self.secco, self.bagnato = adc_secco, adc_bagnato
        self.tau = ritardo_sensore_min
        self.quadro_altezza = quadro_altezza_mm
        self.sensore_allagamento = sensore_allagamento_mm   # altezza del sensore da terra (None = non c'è)
        # energia: None = rete elettrica; altrimenti pannello_w, batteria_wh, carica (0..1), consumo_w, pompa_w
        self.energia = dict(energia) if energia else None
        if self.energia:
            self.energia.setdefault("carica", 0.8)
            self.energia.setdefault("consumo_w", 0.6)
            self.energia.setdefault("pompa_w", 24.0)
            self.energia["spento"] = False
        # guasti: {"sensore_staccato"|"sensore_fuori_terra"|"tubo_rotto"|"tubo_scoppiato"|"valvola_bloccata_aperta":
        #          {zona: minuto}, "pompa_guasta": minuto}
        self.guasti = guasti or {}
        self.flusso = 0.0
        self.pompa_minuti = 0
        self.litri_usati = 0.0          # usciti dalla cisterna
        self.litri_persi = 0.0          # usciti ma non arrivati alle piante (tubi rotti o scoppiati)
        self.litri_dispersi = 0.0       # arrivati alla zona ma non alle radici (efficienza degli erogatori)
        self.troppo_pieno_l = 0.0       # pioggia che la cisterna non ha potuto tenere
        self.minuti_a_secco = 0         # pompa comandata con serbatoio vuoto: deve restare 0
        self.quadro_sommerso_min = 0    # acqua oltre il fondo del quadro: elettronica da buttare
        self.ore_spento = 0

    def _guasto(self, nome, zona, m):
        dal = self.guasti.get(nome, {}).get(zona)
        return dal is not None and m >= dal

    def giorno(self, m):
        return min(m // 1440, len(self.meteo) - 1)

    def temperatura(self, m):
        g = self.meteo[self.giorno(m)]
        ora = (m % 1440) / 60.0
        return g["t_media"] + g.get("escursione", self.escursione) / 2 * math.sin((ora - 9) / 24 * 2 * math.pi)

    def pioggia_prevista(self, m):
        """Previsione della centrale: pioggia di oggi fino alle 14, poi quella di domani ("prevista" se diversa
        dalla pioggia vera, per provare le previsioni sbagliate)."""
        g = self.giorno(m)
        if (m % 1440) < 14 * 60:
            d = self.meteo[g]
        elif g + 1 < len(self.meteo):
            d = self.meteo[g + 1]
        else:
            return 0.0
        return d.get("prevista", d["pioggia"])

    def piove(self, m):
        return ore_pioggia(self.meteo[self.giorno(m)]).get((m % 1440) // 60, 0) > 0

    def livello_acqua_a_terra(self):
        return max(z["superficie"] for z in self.zone)

    def batteria(self):
        return self.energia["carica"] if self.energia else None

    def alimentato(self):
        return not (self.energia and self.energia["spento"])

    def _gauss(self, sigma):
        return self.rnd.gauss(0, sigma) if self.rumore else 0.0

    def letture(self, m):
        adc = []
        for i, z in enumerate(self.zone):
            if self._guasto("sensore_staccato", i, m):
                adc.append(self.rnd.randint(0, 60) if self.rumore else 30)
            elif self._guasto("sensore_fuori_terra", i, m):
                adc.append(int(self.secco + self._gauss(15 * self.rumore_sensore)))
            else:
                v = self.secco - (z["letta"] + z["bias"]) * (self.secco - self.bagnato) + self._gauss(15 * self.rumore_sensore)
                adc.append(int(min(max(v, 0), 4095)))
        return {
            "minuto": m,
            "adc": adc,
            "serbatoio_basso": self.serbatoio < self.galleggiante_l,
            "serbatoio_l": (self.serbatoio + self._gauss(0.2 * self.rumore)) if self.sensore_livello else None,
            "temp_c": self.temperatura(m),
            "pioggia_prevista_mm": self.pioggia_prevista(m),
            "pioggia_in_corso": self.piove(m) if self.sensore_pioggia else None,
            "flusso_l_min": max(0.0, self.flusso + self._gauss(0.03 * self.rumore)) if self.flussimetro else None,
            "allagamento": (self.sensore_allagamento is not None
                            and self.livello_acqua_a_terra() >= self.sensore_allagamento),
            "batteria": self.batteria(),
            "zone_attive": [z["attiva"] for z in self.zone],
        }

    def _energia(self, m, pompa):
        e = self.energia
        g = self.meteo[self.giorno(m)]
        ora = (m % 1440) / 60.0
        sole = math.sin(math.pi * (ora - 6) / 14) if 6 <= ora <= 20 else 0.0
        ore_sole = ORE_SOLE_MESE[g.get("mese", 7)]
        produzione = e["pannello_w"] * 0.75 * (0.2 if g.get("nuvoloso") else 1.0) * sole * ore_sole / (28 / math.pi)
        consumo = 0.0 if e["spento"] else e["consumo_w"] + (e["pompa_w"] if pompa else 0.0)
        e["carica"] += (produzione * 0.9 - consumo) / 60.0 / e["batteria_wh"]
        e["carica"] = min(max(e["carica"], 0.0), 1.0)
        if e["carica"] <= 0.0:
            e["spento"] = True          # batteria a zero: l'ESP32 si spegne
        elif e["spento"] and e["carica"] >= 0.15:
            e["spento"] = False         # la protezione della batteria riaccende sopra il 15%

    def avanza(self, m, comandi, alimentato=True):
        """Applica i comandi per un minuto e fa evolvere il mondo. alimentato=False: niente corrente."""
        g = self.meteo[self.giorno(m)]
        ora = (m % 1440) // 60
        alimentato = alimentato and self.alimentato()
        pompa = comandi["pompa"] and alimentato
        pompa_ok = not (self.guasti.get("pompa_guasta") is not None and m >= self.guasti["pompa_guasta"])
        if self.energia:
            self._energia(m, pompa)
        if pompa:
            self.pompa_minuti += 1
            if self.serbatoio <= 0:
                self.minuti_a_secco += 1
        # acqua dalla pompa: valvole comandate + valvole bloccate aperte; un tubo scoppiato raddoppia il flusso
        aperte = [i for i in range(len(self.zone))
                  if (pompa and comandi["valvole"][i]) or (pompa and self._guasto("valvola_bloccata_aperta", i, m))]
        self.flusso = 0.0
        if pompa and pompa_ok and aperte and self.serbatoio > 0:
            scoppiato = any(self._guasto("tubo_scoppiato", i, m) for i in aperte)
            base = max(self.zone[i]["portata_l_min"] for i in aperte)
            totale = base * (2.0 if scoppiato else 1.0 + 0.5 * (len(aperte) - 1))
            totale = min(totale, self.serbatoio)
            self.flusso = totale
            self.serbatoio -= totale
            self.litri_usati += totale
            for i in aperte:
                parte = totale / len(aperte)
                z = self.zone[i]
                if self._guasto("tubo_rotto", i, m) or self._guasto("tubo_scoppiato", i, m):
                    self.litri_persi += parte
                    z["persi"] += parte
                else:
                    eff = z["efficienza"]
                    self.litri_dispersi += parte * (1 - eff)
                    z["litri"] += parte
                    z["acqua"] += parte * eff / z["area_m2"]     # 1 L su 1 m² = 1 mm
                    if z["acqua"] > z["capacita_mm"]:
                        z["sprecati"] += min(parte * eff, (z["acqua"] - z["capacita_mm"]) * z["area_m2"])
        mm_pioggia = ore_pioggia(g).get(ora, 0.0) / 60.0
        for z in self.zone:
            u = z["acqua"] / z["capacita_mm"]
            if 7 <= ora < 19:
                kc = z["kc"] * (0.8 if z.get("pacciamatura") else 1.0)
                z["acqua"] -= g["et0"] * kc * min(1.0, u / 0.5) / (12 * 60)   # terreno secco: la pianta beve meno
            if self.pioggia_zone:
                z["acqua"] += mm_pioggia
            if z["acqua"] > z["capacita_mm"]:
                z["superficie"] += z["acqua"] - z["capacita_mm"]
                z["acqua"] = z["capacita_mm"]
            z["superficie"] = max(0.0, z["superficie"] - z["drenaggio_mm_h"] / 60.0)
            if z["superficie"] > 0:
                z["acqua"] = z["capacita_mm"]
            z["acqua"] = max(z["acqua"], 0.0)
            # il sensore tarato "in acqua" legge 100% solo a terreno saturo: a capacità di campo legge ~92%
            vista = 0.92 * z["acqua"] / z["capacita_mm"] + (0.08 if z["superficie"] > 0 else 0.0)
            z["letta"] += (vista - z["letta"]) / self.tau
        entrata = mm_pioggia * self.tetto * 0.8
        self.serbatoio += entrata
        if self.serbatoio > self.capacita:
            self.troppo_pieno_l += self.serbatoio - self.capacita
            self.serbatoio = self.capacita
        if self.livello_acqua_a_terra() > self.quadro_altezza:
            self.quadro_sommerso_min += 1

    def umidita_vera(self):
        return [z["acqua"] / z["capacita_mm"] for z in self.zone]

    def in_ristagno(self):
        """Acqua ferma oltre la saturazione (il terreno "pieno" a capacità di campo non è ristagno)."""
        return [z["superficie"] > 0 for z in self.zone]
