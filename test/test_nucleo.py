"""AgriTech 2.0: il nucleo fisico dell'orto è lo stesso in Python e nel browser (contratto test/contratti/)."""
import json
import os
import unittest

from sistema.nucleo import et_giorno, contratto
from sistema.modello import Mondo

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestNucleo(unittest.TestCase):
    def test_contratto_aggiornato(self):
        with open(os.path.join(RADICE, "test", "contratti", "bilancio_idrico.json")) as f:
            casi = json.load(f)["casi"]
        nuovi = contratto()
        self.assertEqual(len(casi), len(nuovi))
        for a, b in zip(casi, nuovi):
            self.assertAlmostEqual(a["u_fine"], b["u_fine"], places=12)

    def test_conservazione_e_limiti(self):
        for c in contratto():
            self.assertGreaterEqual(c["u_fine"], 0)
            self.assertLessEqual(c["u_fine"], c["u"])
            self.assertAlmostEqual(c["et_mm"], (c["u"] - c["u_fine"]) * c["capacita"], places=9)
            self.assertLessEqual(c["et_mm"], c["et0"] * c["kc"] + 1e-9)        # mai più della domanda dell'aria

    def test_il_simulatore_minuto_per_minuto_coincide_con_la_soluzione_esatta(self):
        for u0, et0, kc in ((0.9, 5.0, 1.1), (0.55, 6.0, 1.0), (0.35, 4.0, 1.15)):
            zona = {"nome": "prova", "area_m2": 1.0, "kc": kc, "capacita_mm": 60.0, "umidita": u0}
            meteo = [{"et0": et0, "pioggia": 0.0, "t_media": 20.0, "nuvoloso": False, "mese": 6}] * 2
            m = Mondo([zona], meteo)
            for minuto in range(1440):
                m.avanza(minuto, {"pompa": False, "valvole": [False]})
            atteso, _ = et_giorno(u0, et0, kc, 60.0)
            self.assertAlmostEqual(m.umidita_vera()[0], atteso, delta=0.003)


if __name__ == "__main__":
    unittest.main()
