"""Mondo virtuale dell'impianto: terreno e piante per zona, meteo, serbatoio dell'acqua piovana, pompa, valvole, sensori.

Sostituisce l'hardware nelle prove: produce le stesse letture che darebbe l'ESP32 (valori ADC grezzi con rumore e
ritardo, galleggiante, litri, temperatura) e riceve gli stessi comandi (pompa, valvole). Permette di iniettare guasti.
È un modello didattico: i numeri veri si tarano poi sul banco e in campo.
"""
import math
import random

ET0_MESE = {1: 1.0, 2: 1.5, 3: 2.5, 4: 3.5, 5: 4.5, 6: 5.5, 7: 6.0, 8: 5.5, 9: 4.0, 10: 2.5, 11: 1.5, 12: 1.0}
PIOGGIA_MESE = {1: (0.35, 8), 2: (0.33, 8), 3: (0.30, 7), 4: (0.30, 7), 5: (0.22, 6), 6: (0.12, 6), 7: (0.06, 6),
                8: (0.08, 8), 9: (0.18, 9), 10: (0.28, 10), 11: (0.35, 10), 12: (0.37, 9)}
TEMP_MESE = {1: 9, 2: 10, 3: 12, 4: 15, 5: 19, 6: 23, 7: 26, 8: 26, 9: 23, 10: 18, 11: 14, 12: 10}  # media °C

STRESS = 0.30     # sotto: la pianta soffre
RISTAGNO = 0.95   # sopra: rischio marciumi


def meteo_sintetico(mese, giorni, seme):
    rnd = random.Random(seme)
    prob, mm = PIOGGIA_MESE[mese]
    return [{"et0": max(0.3, rnd.gauss(ET0_MESE[mese], ET0_MESE[mese] * 0.15)),
             "pioggia": rnd.expovariate(1 / mm) if rnd.random() < prob else 0.0,
             "t_media": TEMP_MESE[mese] + rnd.gauss(0, 2)} for _ in range(giorni)]


class Mondo:
    def __init__(self, zone, meteo, serbatoio_l=800.0, capacita_serbatoio_l=1000.0, galleggiante_l=50.0,
                 tetto_m2=10.0, portata_l_min=1.0, sensore_livello=True, escursione_c=10.0, seme=1,
                 adc_secco=3000, adc_bagnato=1300, ritardo_sensore_min=5.0, guasti=None):
        self.zone = [dict(z) for z in zone]          # area_m2, kc, capacita_mm (acqua disponibile), umidita iniziale
        for z in self.zone:
            z.setdefault("capacita_mm", 60.0)
            z["acqua"] = z["capacita_mm"] * z.get("umidita", 0.6)
            z["letta"] = z["acqua"] / z["capacita_mm"]   # ciò che "vede" il sensore (in ritardo)
        self.meteo = meteo
        self.serbatoio = serbatoio_l
        self.capacita = capacita_serbatoio_l
        self.galleggiante_l = galleggiante_l
        self.tetto = tetto_m2
        self.portata = portata_l_min
        self.sensore_livello = sensore_livello
        self.escursione = escursione_c
        self.rnd = random.Random(seme)
        self.secco, self.bagnato = adc_secco, adc_bagnato
        self.tau = ritardo_sensore_min
        # guasti: {"sensore_staccato": {zona: minuto}, "sensore_fuori_terra": {...}, "tubo_rotto": {...},
        #          "pompa_guasta": minuto}
        self.guasti = guasti or {}
        self.pompa_minuti = 0
        self.litri_usati = 0.0
        self.minuti_a_secco = 0       # pompa comandata con serbatoio vuoto: deve restare 0

    def _guasto(self, nome, zona, m):
        dal = self.guasti.get(nome, {}).get(zona)
        return dal is not None and m >= dal

    def giorno(self, m):
        return min(m // 1440, len(self.meteo) - 1)

    def temperatura(self, m):
        ora = (m % 1440) / 60.0
        return self.meteo[self.giorno(m)]["t_media"] + self.escursione / 2 * math.sin((ora - 9) / 24 * 2 * math.pi)

    def pioggia_prevista(self, m):
        """Previsione 'perfetta': pioggia di oggi fino alle 15, poi quella di domani."""
        g = self.giorno(m)
        if (m % 1440) < 15 * 60:
            return self.meteo[g]["pioggia"]
        return self.meteo[g + 1]["pioggia"] if g + 1 < len(self.meteo) else 0.0

    def letture(self, m):
        adc = []
        for i, z in enumerate(self.zone):
            if self._guasto("sensore_staccato", i, m):
                adc.append(self.rnd.randint(0, 60))
            elif self._guasto("sensore_fuori_terra", i, m):
                adc.append(int(self.secco + self.rnd.gauss(0, 15)))
            else:
                v = self.secco - z["letta"] * (self.secco - self.bagnato) + self.rnd.gauss(0, 15)
                adc.append(int(min(max(v, 0), 4095)))
        return {
            "minuto": m,
            "adc": adc,
            "serbatoio_basso": self.serbatoio < self.galleggiante_l,
            "serbatoio_l": (self.serbatoio + self.rnd.gauss(0, 0.2)) if self.sensore_livello else None,
            "temp_c": self.temperatura(m),
            "pioggia_prevista_mm": self.pioggia_prevista(m),
        }

    def avanza(self, m, comandi):
        """Applica i comandi per un minuto e fa evolvere il mondo."""
        g = self.meteo[self.giorno(m)]
        ora = (m % 1440) // 60
        pompa_ok = not (self.guasti.get("pompa_guasta") is not None and m >= self.guasti["pompa_guasta"])
        if comandi["pompa"]:
            self.pompa_minuti += 1
            if self.serbatoio <= 0:
                self.minuti_a_secco += 1
        for i, z in enumerate(self.zone):
            if 7 <= ora < 19:
                z["acqua"] -= g["et0"] * z["kc"] / (12 * 60)
            if m % 1440 == 15 * 60:
                z["acqua"] += g["pioggia"]
            if comandi["pompa"] and comandi["valvole"][i] and pompa_ok and self.serbatoio > 0:
                litri = min(self.portata, self.serbatoio)
                self.serbatoio -= litri
                self.litri_usati += litri
                if not self._guasto("tubo_rotto", i, m):
                    z["acqua"] += litri / z["area_m2"]       # 1 L su 1 m² = 1 mm
            z["acqua"] = min(max(z["acqua"], 0.0), z["capacita_mm"])   # l'eccesso drena
            vera = z["acqua"] / z["capacita_mm"]
            z["letta"] += (vera - z["letta"]) / self.tau
        if m % 1440 == 15 * 60:
            self.serbatoio = min(self.capacita, self.serbatoio + g["pioggia"] * self.tetto * 0.8)

    def umidita_vera(self):
        return [z["acqua"] / z["capacita_mm"] for z in self.zone]
