"""Prova del firmware ESP32 sul PC: i moduli MicroPython (machine, dht) sono sostituiti da finti pin.
Verifica il collegamento tra pin e logica: uscite spente all'accensione, relè attivi bassi, galleggiante, taratura."""
import os
import sys
import tempfile
import types
import unittest

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class PinFinto:
    OUT, IN, PULL_UP, IRQ_RISING = "out", "in", "pull_up", "rising"
    gestori = {}
    stati = {}

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


class ADCFinto:
    ATTN_11DB = 3
    valori = {}

    def __init__(self, pin):
        self.n = pin.n

    def atten(self, a):
        pass

    def read(self):
        return ADCFinto.valori.get(self.n, 2000)


def carica_firmware():
    machine = types.ModuleType("machine")
    machine.Pin, machine.ADC = PinFinto, ADCFinto
    machine.WDT = lambda timeout: types.SimpleNamespace(feed=lambda: None)
    machine.time_pulse_us = lambda pin, livello, timeout: 58 * 60          # 60 cm dal sensore
    dht = types.ModuleType("dht")
    dht.DHT22 = lambda pin: types.SimpleNamespace(measure=lambda: None, temperature=lambda: 21.5)
    sys.modules["machine"], sys.modules["dht"] = machine, dht
    import time
    if not hasattr(time, "sleep_us"):
        time.sleep_us = lambda us: None
    for p in (os.path.join(RADICE, "firmware", "esp32-irrigazione"), os.path.join(RADICE, "sistema")):
        if p not in sys.path:
            sys.path.insert(0, p)
    for m in ("main", "config", "controllo"):
        sys.modules.pop(m, None)
    import main
    return main


class TestFirmware(unittest.TestCase):
    def setUp(self):
        PinFinto.stati, PinFinto.gestori, ADCFinto.valori = {}, {}, {}
        self.fw = carica_firmware()
        self.cfg = self.fw.config
        self.tmp = tempfile.TemporaryDirectory()
        self.cfg.FILE_MEMORIA = os.path.join(self.tmp.name, "stato.json")
        self.hw = self.fw.crea_hw()

    def tearDown(self):
        self.tmp.cleanup()

    def pompa_accesa(self):
        return PinFinto.stati[self.cfg.PIN_POMPA] == 0         # relè attivo basso

    def test_uscite_spente_all_accensione(self):
        self.assertFalse(self.pompa_accesa())
        for p in self.cfg.PIN_VALVOLE:
            self.assertEqual(PinFinto.stati[p], 1)

    def test_letture(self):
        ADCFinto.valori = {34: 2150, 35: 2500}
        l = self.fw.leggi(self.hw, 0)
        self.assertEqual(l["adc"], [2150, 2500])
        self.assertFalse(l["serbatoio_basso"])                 # pull-up, contatto aperto
        self.assertAlmostEqual(l["serbatoio_l"], 500.0)        # 60 cm su 20..100 cm -> metà cisterna
        self.assertEqual(l["temp_c"], 21.5)

    def test_ciclo_completo(self):
        ctrl = self.fw.Controllore(len(self.cfg.PIN_SENSORI), self.cfg.PARAMETRI)
        ADCFinto.valori = {34: 2400, 35: 1700}                 # zona 1 secca (35%), zona 2 bagnata
        for m in range(3):
            uscite = ctrl.passo(self.fw.leggi(self.hw, m))
            self.fw.scrivi(self.hw, uscite)
            self.assertIn("min %d" % m, self.fw.riga(m, self.fw.leggi(self.hw, m), uscite))
        self.assertTrue(self.pompa_accesa())
        self.assertEqual(PinFinto.stati[25], 0)                # valvola zona 1 aperta
        self.assertEqual(PinFinto.stati[27], 1)
        PinFinto.stati[self.cfg.PIN_GALLEGGIANTE] = 0          # galleggiante chiuso: cisterna al minimo
        uscite = ctrl.passo(self.fw.leggi(self.hw, 3))
        self.fw.scrivi(self.hw, uscite)
        self.assertFalse(self.pompa_accesa())
        self.assertIn("SERBATOIO_BASSO", uscite["allarmi"])

    def test_sensore_staccato(self):
        ctrl = self.fw.Controllore(len(self.cfg.PIN_SENSORI), self.cfg.PARAMETRI)
        ADCFinto.valori = {34: 0, 35: 1700}
        for m in range(5):
            uscite = ctrl.passo(self.fw.leggi(self.hw, m))
        self.assertIn("Z1_SENSORE", uscite["allarmi"])
        self.assertFalse(uscite["pompa"])

    def test_memoria_su_file(self):
        self.assertEqual(self.fw.carica_memoria(), {})          # primo avvio
        self.fw.salva_memoria({"bloccata": [True, False], "pompa_in_corso": True, "riavvii_pompa": 2})
        ctrl = self.fw.Controllore(2, self.cfg.PARAMETRI, self.fw.carica_memoria())
        self.assertEqual(ctrl.bloccata, [True, False])
        out = ctrl.passo(self.fw.leggi(self.hw, 0))
        self.assertIn("Z1_INEFFICACE", out["allarmi"])
        self.assertIn("RIAVVII_FREQUENTI", out["allarmi"])       # terzo riavvio di fila con la pompa accesa
        with open(self.cfg.FILE_MEMORIA, "w") as f:
            f.write("{rovinato")
        self.assertEqual(self.fw.carica_memoria(), {})

    def test_allagamento_e_ingressi_facoltativi(self):
        l = self.fw.leggi(self.hw, 0)
        self.assertFalse(l["allagamento"])                     # sonda asciutta (pull-up)
        self.assertIsNone(l["pioggia_in_corso"])               # sensore di pioggia non configurato
        self.assertIsNone(l["flusso_l_min"])
        self.assertIsNone(l["batteria"])
        PinFinto.stati[self.cfg.PIN_ALLAGAMENTO] = 0
        self.assertTrue(self.fw.leggi(self.hw, 1)["allagamento"])

    def test_flussimetro_pioggia_batteria(self):
        self.cfg.PIN_FLUSSIMETRO, self.cfg.PIN_PIOGGIA, self.cfg.PIN_BATTERIA = 19, 23, 39
        hw = self.fw.crea_hw()
        for _ in range(450):                                   # 450 impulsi in un minuto = 1 L/min
            PinFinto.gestori[19](None)
        ADCFinto.valori[39] = int(12.25 / 5.0 / 3.3 * 4095)   # 12,25 V: metà tra vuota e piena
        PinFinto.stati[23] = 0                                 # sensore di pioggia bagnato
        l = self.fw.leggi(hw, 0)
        self.assertAlmostEqual(l["flusso_l_min"], 1.0)
        self.assertTrue(l["pioggia_in_corso"])
        self.assertAlmostEqual(l["batteria"], 0.5, places=1)
        self.assertEqual(self.fw.leggi(hw, 1)["flusso_l_min"], 0.0)   # impulsi azzerati a ogni minuto


if __name__ == "__main__":
    unittest.main()
