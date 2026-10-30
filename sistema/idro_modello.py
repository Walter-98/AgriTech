"""Serbatoio idroponico simulato per provare la logica di controllo (sistema/idro_controllo.py) senza hardware.

Modello semplice e dichiarato (affidabilità C, serve a provare il controllo, non a prevedere la chimica):
  - volume: le piante bevono di giorno (traspirazione), il rabbocco riporta al galleggiante di massimo;
  - EC: le piante assorbono meno sali che acqua (rapporto 0,7) -> l'EC sale bevendo; il rabbocco con acqua di rete la
    abbassa; una dose di A e B da x mL ciascuna in V litri alza l'EC di 0,3 x / V ... per mL/L (circa 2 mL/L di A e
    di B danno EC 1,2);
  - pH: dipende dall'alcalinità rimasta (meq/L): pH = 4 + 4 * a / (a + 0,8). Le piante, assorbendo nitrati, rilasciano
    alcalinità (+0,15 meq/L al giorno): il pH sale; il pH- commerciale (acido fosforico, circa 6 meq/mL) la consuma;
  - sonde con rumore, deriva e possibilità di bloccarsi; dosatori che possono restare a secco; pompa che può guastarsi;
    perdita; blackout (riavvio del controllo).
"""
import math
import random

from sistema.idro_controllo import ControlloIdro


class Sonda:
    def __init__(self, rumore, rnd):
        self.rumore = rumore
        self.deriva = 0.0
        self.bloccata = None
        self.staccata = False
        self.rnd = rnd

    def leggi(self, vero):
        if self.staccata:
            return None
        if self.bloccata is not None:
            return self.bloccata
        return round(vero + self.deriva + self.rnd.gauss(0, self.rumore), 3)


class Serbatoio:
    def __init__(self, volume=120.0, ec=1.2, alcalinita=0.62, acqua_ec=0.45, acqua_alc=3.6, piante=60,
                 l_pianta_giorno=0.15, temp=21.0):
        self.max = volume
        self.min = volume * 0.6
        self.v = volume
        self.sali = ec * volume          # EC × litri: si conserva mescolando
        self.alc = alcalinita * volume   # meq
        self.acqua_ec = acqua_ec
        self.acqua_alc = acqua_alc
        self.piante = piante
        self.l_pianta = l_pianta_giorno
        self.temp = temp
        self.pavimento_l = 0.0

    @property
    def ec(self):
        return self.sali / max(1.0, self.v)

    @property
    def ph(self):
        a = self.alc / max(1.0, self.v)
        if a >= 0:
            return 4.0 + 4.0 * a / (a + 0.8)
        return max(1.5, 4.0 - 1.5 * math.log10(1 + (-a) / 0.1))      # acido in eccesso (alcalinità esaurita)


def simula_idro(scenario=None, giorni=7, passo_s=60, parametri=None, seme=7):
    """Esegue controllo + serbatoio per N giorni. scenario: dict di guasti (vedi SCENARI_IDRO)."""
    sc = scenario or {}
    rnd = random.Random(seme)
    t = Serbatoio(**sc.get("serbatoio", {}))
    par = {"volume_l": t.max}
    par.update(parametri or {})
    ctl = ControlloIdro(par, s_avvio=0)
    sph, sec = Sonda(0.02, rnd), Sonda(0.01, rnd)
    flaconi = {"a": sc.get("flacone_a_l", 1.0) * 1000, "b": 1000.0, "ph": sc.get("flacone_ph_l", 1.0) * 1000}
    reg = {"ph": [], "ec": [], "ph_letto": [], "allarmi": {}, "dosi_ml": {"a": 0.0, "b": 0.0, "ph": 0.0}, "pompa_s": 0,
           "pompa_secca_s": 0, "acceso_con_perdita_s": 0, "azioni_in_ombra": 0, "proposti_in_ombra": 0, "primo_allarme": {}}
    for i in range(int(giorni * 86400 / passo_s)):
        s = i * passo_s
        g = s / 86400.0
        # --- guasti programmati ---
        if "deriva_ph" in sc and g >= sc["deriva_ph"][0]:
            sph.deriva = sc["deriva_ph"][1]
        if "ph_bloccata" in sc and g >= sc["ph_bloccata"]:
            if sph.bloccata is None:
                sph.bloccata = sph.leggi(t.ph)
        if "ec_staccata" in sc and g >= sc["ec_staccata"]:
            sec.staccata = True
        if "blackout" in sc and sc["blackout"][0] <= g < sc["blackout"][0] + sc["blackout"][1] / 24.0:
            continue                                        # niente corrente: niente controllo né pompa
        if "blackout" in sc and abs(g - (sc["blackout"][0] + sc["blackout"][1] / 24.0)) < passo_s / 86400.0:
            ctl = ControlloIdro(par, s_avvio=s, memoria=ctl.memoria())   # riavvio con la memoria su file
        perdita = "perdita" in sc and g >= sc["perdita"]
        pompa_rotta = "pompa_guasta" in sc and g >= sc["pompa_guasta"]
        # --- letture ---
        penna = round(t.ph + rnd.gauss(0, 0.03), 2) if "penna_ogni" in sc and i % int(sc["penna_ogni"] * 86400 / passo_s) == 0 and i > 0 else None
        l = {"s": s, "ph": sph.leggi(t.ph), "ph_penna": penna, "ec": sec.leggi(t.ec), "t_acqua": t.temp + (sc.get("acqua_calda", 0) if g >= 1 else 0),
             "t_aria": 22.0, "ur": 60.0, "livello_min": t.v > t.min, "livello_max": t.v >= t.max - 0.5,
             "perdita": perdita and sc.get("sensore_perdita", True) and t.pavimento_l > 0.2,
             "flusso_l_min": 0.0 if (pompa_rotta or t.v <= t.min * 0.5) else 6.0,
             "rabbocco_serve": not sc.get("rete_chiusa", False)}
        c = ctl.passo(l)
        reg["ph_letto"].append(l["ph"])
        for a in c["allarmi"]:
            reg["allarmi"][a] = reg["allarmi"].get(a, 0) + 1
            reg["primo_allarme"].setdefault(a, s)
        if c["modo"] == "ombra":
            if any(c[k] for k in ("pompa", "luci", "rabbocco", "estrattore", "stufetta", "dose_a_ml", "dose_b_ml", "dose_ph_ml")):
                reg["azioni_in_ombra"] += 1
            if any(c["proposti"].values()):
                reg["proposti_in_ombra"] += 1
        # --- fisica del serbatoio ---
        luce = c["luci"]
        bevuta = t.piante * t.l_pianta * (1.6 if luce else 0.3) / 24.0 * passo_s / 3600.0
        bevuta = min(bevuta, t.v - 1)
        t.sali -= bevuta * t.ec * 0.7
        t.v -= bevuta
        t.alc += 0.15 * t.v * passo_s / 86400.0                # nitrati assorbiti -> pH che sale
        if perdita:
            uscita = min(t.v - 1, 0.5 * passo_s / 60.0)        # 0,5 L/min
            t.v -= uscita
            t.sali -= uscita * t.ec
            t.alc -= uscita * t.alc / max(1.0, t.v + uscita)
            t.pavimento_l += uscita
        if c["rabbocco"]:
            add = min(2.0 * passo_s / 60.0, t.max - t.v)       # 2 L/min
            t.v += add
            t.sali += add * t.acqua_ec
            t.alc += add * t.acqua_alc
        # dosatore del pH- con il MOSFET o il relè incollato: eroga 1,5 mL/s finché qualcosa non toglie la corrente.
        # Con il relè temporizzato hardware (indipendente dall'ESP32) si ferma dopo 20 s; senza, solo quando il
        # controllo apre il relè di taglio dei dosatori.
        if "dosatore_bloccato" in sc and g >= sc["dosatore_bloccato"]:
            bl = reg.setdefault("bloccato", {"s": 0, "ml": 0.0})
            if not c.get("taglio_dosatori") and (not sc.get("timer_hw", True) or bl["s"] < 20):
                durata = passo_s if not sc.get("timer_hw", True) else min(passo_s, 20 - bl["s"])
                ml = min(1.5 * durata, flaconi["ph"]); flaconi["ph"] -= ml; bl["s"] += durata; bl["ml"] += ml
                t.alc -= ml * 6.0
        for k, chiave in (("a", "dose_a_ml"), ("b", "dose_b_ml"), ("ph", "dose_ph_ml")):
            if c[chiave]:
                reg.setdefault("dosi_t", []).append((s, k, c[chiave]))
            ml = min(c[chiave], flaconi[k])
            flaconi[k] -= ml
            reg["dosi_ml"][k] += ml
            if k in ("a", "b"):
                t.sali += ml * 0.3                                  # 1 mL/L di A (o di B): +0,3 EC
            else:
                t.alc -= ml * 6.0
        if c["pompa"]:
            reg["pompa_s"] += passo_s
            if l["flusso_l_min"] < 0.3:
                reg["pompa_secca_s"] += passo_s
            if perdita and t.pavimento_l > 0.2:
                reg["acceso_con_perdita_s"] += passo_s
        if i % int(600 / passo_s) == 0:
            reg["ph"].append(t.ph)
            reg["ec"].append(t.ec)
    reg["riavvio_s"] = int((sc["blackout"][0] + sc["blackout"][1] / 24.0) * 86400) if "blackout" in sc else None
    reg["serbatoio"] = t
    reg["controllo"] = ctl
    reg["flaconi"] = flaconi
    return reg


SCENARI_IDRO = {
    "normale": {},
    "sonda_ph_deriva": {"deriva_ph": [2, 0.5]},
    "sonda_ph_deriva_con_penna": {"deriva_ph": [2, 0.5], "penna_ogni": 3},
    "sonda_ph_bloccata": {"ph_bloccata": 1.5},
    "sonda_ec_staccata": {"ec_staccata": 1.0},
    "flacone_ph_vuoto": {"flacone_ph_l": 0.0},
    "flacone_a_vuoto": {"flacone_a_l": 0.0, "serbatoio": {"ec": 0.9}},
    "perdita": {"perdita": 2.0},
    "pompa_guasta": {"pompa_guasta": 1.0},
    "blackout": {"blackout": [2.0, 3.0]},
    "acqua_calda": {"acqua_calda": 7.0},
    "rete_chiusa": {"rete_chiusa": True},
    "dosatore_bloccato_con_timer": {"dosatore_bloccato": 2.0, "timer_hw": True},
    "dosatore_bloccato_senza_timer": {"dosatore_bloccato": 2.0, "timer_hw": False},
}
