"""Prova del firmware idroponico sul PC: i moduli MicroPython (machine, onewire, ds18x20, urequests) sono finti.
Verifica: uscite spente all'accensione, conversioni pH/EC con la taratura, ADS1115, ombra che non comanda niente,
dose limitata dal tempo massimo hardware, prese smart solo quando cambiano, memoria su file."""
import os
import sys
import tempfile
import types
import unittest

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class PinFinto:
    OUT, IN, PULL_UP, IRQ_RISING = "out", "in", "pull_up", "rising"
    stati, gestori, storia = {}, {}, []

    def __init__(self, n, modo=None, pull=None, value=None):
        self.n = n
        if value is not None:
            PinFinto.stati[n] = value
        PinFinto.stati.setdefault(n, 1 if pull == PinFinto.PULL_UP else 0)

    def irq(self, trigger=None, handler=None):
        PinFinto.gestori[self.n] = handler

    def value(self, v=None):
        if v is None:
            return PinFinto.stati[self.n]
        PinFinto.stati[self.n] = v
        PinFinto.storia.append((self.n, v))


class I2CFinto:
    volt = {0: 1.50, 1: 1.10}                        # canale -> volt

    def __init__(self, *a, **k):
        self.canale = 0

    def writeto_mem(self, ind, reg, dati):
        conf = (dati[0] << 8) | dati[1]
        self.canale = ((conf >> 12) & 0x7) - 4

    def readfrom_mem(self, ind, reg, n):
        v = int(I2CFinto.volt[self.canale] / 4.096 * 32768)
        return bytes([(v >> 8) & 0xFF, v & 0xFF])

    def writeto(self, ind, dati):
        pass

    def readfrom(self, ind, n):                       # SHT31: 22 °C, 60%
        t = int((22 + 45) / 175 * 65535)
        u = int(60 / 100 * 65535)
        return bytes([t >> 8, t & 0xFF, 0, u >> 8, u & 0xFF, 0])


def carica_firmware():
    machine = types.ModuleType("machine")
    machine.Pin, machine.I2C = PinFinto, I2CFinto
    machine.ADC = lambda pin: types.SimpleNamespace(atten=lambda a: None, read=lambda: 2048)
    machine.ADC.ATTN_11DB = 3
    machine.WDT = lambda timeout: types.SimpleNamespace(feed=lambda: None)
    onewire = types.ModuleType("onewire")
    onewire.OneWire = lambda pin: None
    ds = types.ModuleType("ds18x20")
    ds.DS18X20 = lambda ow: types.SimpleNamespace(scan=lambda: [b"x"], convert_temp=lambda: None, read_temp=lambda i: 21.0)
    ureq = types.ModuleType("urequests")
    ureq.chiamate = []
    ureq.get = lambda url: (ureq.chiamate.append(url), types.SimpleNamespace(close=lambda: None))[1]
    for nome, m in (("machine", machine), ("onewire", onewire), ("ds18x20", ds), ("urequests", ureq)):
        sys.modules[nome] = m
    import time
    time.sleep_ms = lambda ms: None
    for p in (os.path.join(RADICE, "firmware", "esp32-idroponica"), os.path.join(RADICE, "sistema")):
        if p in sys.path:
            sys.path.remove(p)
        sys.path.insert(0, p)
    for m in ("main", "config", "idro_controllo"):
        sys.modules.pop(m, None)
    import main
    return main, ureq


class TestFirmwareIdro(unittest.TestCase):
    def setUp(self):
        PinFinto.stati, PinFinto.gestori, PinFinto.storia = {}, {}, []
        I2CFinto.volt = {0: 1.50, 1: 1.10}
        self.fw, self.ureq = carica_firmware()
        self.cfg = self.fw.config
        self.tmp = tempfile.TemporaryDirectory()
        self.cfg.FILE_MEMORIA = os.path.join(self.tmp.name, "m.json")
        self.cfg.FILE_PENNA = os.path.join(self.tmp.name, "p.json")
        self.dormito = []
        self._sleep = self.fw.time.sleep
        self.fw.time.sleep = lambda s: self.dormito.append(s)
        self.hw = self.fw.crea_hw()

    def tearDown(self):
        self.fw.time.sleep = self._sleep
        self.tmp.cleanup()
        for p in (os.path.join(RADICE, "firmware", "esp32-idroponica"),):
            if p in sys.path:
                sys.path.remove(p)
        for m in ("main", "config"):
            sys.modules.pop(m, None)

    def test_uscite_spente_all_accensione(self):
        for n in (self.cfg.PIN_POMPA, self.cfg.PIN_DOSA_A, self.cfg.PIN_DOSA_B, self.cfg.PIN_DOSA_PH, self.cfg.PIN_RABBOCCO):
            self.assertEqual(PinFinto.stati[n], 0)

    def test_conversioni_con_la_taratura(self):
        self.assertAlmostEqual(self.fw.ph_da_volt(self.cfg.PH_V7), 7.0)
        self.assertAlmostEqual(self.fw.ph_da_volt(self.cfg.PH_V4), 4.0)
        self.assertAlmostEqual(self.fw.ec_da_volt(self.cfg.EC_V_1413, 25.0), 1.413)
        self.assertAlmostEqual(self.fw.ec_da_volt(self.cfg.EC_V_1413, 20.0), 1.413 / 0.9)    # compensazione 2%/°C

    def test_letture_da_ads_ds18b20_sht31(self):
        l = self.fw.leggi(self.hw, 0)
        self.assertAlmostEqual(l["ph"], 7.0, places=2)
        self.assertAlmostEqual(l["ec"], 1.413 / (1 + 0.02 * (21 - 25)), places=2)
        self.assertEqual(l["t_acqua"], 21.0)
        self.assertAlmostEqual(l["t_aria"], 22.0, places=1)
        self.assertFalse(l["perdita"])

    def test_ombra_non_comanda_niente(self):
        ctrl = self.fw.ControlloIdro(self.cfg.PARAMETRI)
        self.assertEqual(ctrl.modo_effettivo(), "ombra")
        PinFinto.stati[self.cfg.PIN_LIVELLO_MIN] = 0                 # acqua sopra il minimo
        c = ctrl.passo(self.fw.leggi(self.hw, 3600))
        self.fw.scrivi(self.hw, c)
        self.assertTrue(all(v == 0 for (n, v) in PinFinto.storia))
        self.assertEqual(self.ureq.chiamate, [])
        self.assertIn("proposti", c)

    def test_dose_limitata_dal_tempo_massimo_hardware(self):
        fatto = self.fw.dosa(self.hw, "ph", 1000.0)
        self.assertEqual(self.dormito[-1], self.cfg.MAX_SECONDI_DOSE)
        self.assertEqual(PinFinto.stati[self.cfg.PIN_DOSA_PH], 0)
        self.assertAlmostEqual(fatto, self.cfg.MAX_SECONDI_DOSE * self.cfg.ML_AL_SECONDO["ph"])

    def test_reale_dosa_e_prese_solo_al_cambio(self):
        self.cfg.PRESE["luci"] = "http://presa/relay/0?turn="
        c = {"modo": "reale", "pompa": True, "rabbocco": False, "dose_a_ml": 3.0, "dose_b_ml": 3.0, "dose_ph_ml": 0.0,
             "luci": True, "estrattore": False, "stufetta": False}
        fatti = self.fw.scrivi(self.hw, c)
        self.assertAlmostEqual(fatti["a"], 3.0)
        self.assertEqual(PinFinto.stati[self.cfg.PIN_POMPA], 1)
        self.fw.scrivi(self.hw, dict(c, dose_a_ml=0, dose_b_ml=0))
        self.assertEqual(self.ureq.chiamate, ["http://presa/relay/0?turn=on"])

    def test_perdita_spegne_tutto(self):
        ctrl = self.fw.ControlloIdro(dict(self.cfg.PARAMETRI, modo="reale", conferma_reale=True))
        PinFinto.stati[self.cfg.PIN_LIVELLO_MIN] = 0
        PinFinto.stati[self.cfg.PIN_ARRESTO] = 0                     # fungo collegato e non premuto
        PinFinto.stati[self.cfg.PIN_PERDITA] = 0                     # acqua sul pavimento
        c = ctrl.passo(self.fw.leggi(self.hw, 1000))
        self.fw.scrivi(self.hw, c)
        self.assertIn("PERDITA", c["allarmi"])
        self.assertEqual(PinFinto.stati[self.cfg.PIN_POMPA], 0)

    def test_penna_e_memoria(self):
        self.fw.penna(6.4)
        self.assertEqual(self.fw.leggi(self.hw, 0)["ph_penna"], 6.4)
        self.assertIsNone(self.fw.leggi(self.hw, 60)["ph_penna"])     # vale una volta
        self.fw.salva_memoria({"fissi": ["PERDITA"], "giorno": 0, "dosato": {"a": 1, "b": 1, "ph": 0}})
        self.assertEqual(self.fw.carica_memoria()["fissi"], ["PERDITA"])

    def test_scheda_ads_staccata_sonda_fuori_campo(self):
        def guasta(*a):
            raise OSError("I2C")
        self.hw["i2c"].readfrom_mem = guasta
        self.assertIsNone(self.fw.leggi(self.hw, 0)["ph"])

    def test_mqtt_scoperta_stato_e_comandi_limitati(self):
        msg = dict(self.fw.scoperta_ha("agritech/idro"))
        import json
        ph = json.loads(msg["homeassistant/sensor/agritech_idro_ph/config"])
        self.assertEqual(ph["state_topic"], "agritech/idro/stato")
        self.assertIn("value_json.ph", ph["value_template"])
        c = {"pompa": True, "luci": False, "rabbocco": False, "dose_a_ml": 0, "dose_b_ml": 0, "dose_ph_ml": 0, "modo": "ombra", "allarmi": []}
        st = json.loads(self.fw.stato_json(self.fw.leggi(self.hw, 0), c))
        self.assertAlmostEqual(st["ph"], 7.0, places=2)
        rete = {"reset": False}
        self.fw.comando_da_rete(b'{"reset": true}', rete)
        self.assertTrue(rete["reset"])
        self.fw.comando_da_rete(b'{"pompa": true, "dose_ph_ml": 50}', rete)     # ignorato: niente comandi agli attuatori
        self.fw.comando_da_rete(b'{"penna": 6.2}', rete)
        self.assertEqual(self.fw.leggi(self.hw, 0)["ph_penna"], 6.2)
        self.fw.comando_da_rete(b'{"penna": 99}', rete)                        # fuori campo: ignorato
        self.assertIsNone(self.fw.leggi(self.hw, 60)["ph_penna"])
        self.fw.comando_da_rete(b'non json', rete)

    def test_relè_di_abilitazione_dei_dosatori(self):
        self.assertEqual(PinFinto.stati[self.cfg.PIN_ABILITA_DOSATORI], 0)            # spento all'accensione
        PinFinto.storia = []
        self.fw.dosa(self.hw, "a", 3.0)
        mosse = [v for (n, v) in PinFinto.storia if n == self.cfg.PIN_ABILITA_DOSATORI]
        self.assertEqual(mosse, [1, 0])                                             # chiuso solo durante la dose
        c = {"modo": "reale", "pompa": True, "rabbocco": False, "dose_a_ml": 3.0, "dose_b_ml": 3.0, "dose_ph_ml": 1.0,
             "luci": False, "estrattore": False, "stufetta": False, "taglio_dosatori": True}
        PinFinto.storia = []
        fatti = self.fw.scrivi(self.hw, c)
        self.assertEqual(sum(fatti.values()), 0)                                    # taglio: nessuna dose
        self.assertNotIn((self.cfg.PIN_ABILITA_DOSATORI, 1), PinFinto.storia)

    def test_arresto_a_fungo_sicuro_per_guasto(self):
        PinFinto.stati[self.cfg.PIN_ARRESTO] = 0                                     # contatto chiuso: tutto normale
        self.assertFalse(self.fw.leggi(self.hw, 0)["arresto"])
        PinFinto.stati[self.cfg.PIN_ARRESTO] = 1                                     # premuto o filo tagliato
        self.assertTrue(self.fw.leggi(self.hw, 0)["arresto"])

    def test_parametri_di_partenza_prudenti_e_taratura(self):
        self.assertFalse(self.cfg.PARAMETRI["dosaggio_abilitato"])
        self.assertEqual(self.cfg.PARAMETRI["modo"], "ombra")
        self.assertFalse(any(self.cfg.PARAMETRI["collaudo"].values()))
        vecchia = os.getcwd()
        os.chdir(self.tmp.name)
        try:
            self.fw.tarato(20000)
            self.assertEqual(self.fw.parametri_con_taratura()["taratura_ph_giorno"], 20000)
        finally:
            os.chdir(vecchia)


if __name__ == "__main__":
    unittest.main()
