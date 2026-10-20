"""Prova del firmware ESP32 sul PC: i moduli MicroPython (machine, dht) sono sostituiti da finti pin.
Verifica il collegamento tra pin e logica: uscite spente all'accensione, relè attivi bassi, galleggiante, taratura."""
import os
import sys
import types
import unittest

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class PinFinto:
    OUT, IN, PULL_UP = "out", "in", "pull_up"
    stati = {}

    def __init__(self, n, modo=None, pull=None, value=None):
        self.n = n
        if value is not None:
            PinFinto.stati[n] = value
        PinFinto.stati.setdefault(n, 1 if pull == PinFinto.PULL_UP else 0)

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
        PinFinto.stati, ADCFinto.valori = {}, {}
        self.fw = carica_firmware()
        self.cfg = self.fw.config
        self.hw = self.fw.crea_hw()

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


if __name__ == "__main__":
    unittest.main()
