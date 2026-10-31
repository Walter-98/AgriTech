"""Il contratto test/contratti/irrigazione.json deve corrispondere al motore Python di oggi: se si cambia la logica in
sistema/ senza rigenerarlo (python3 -m sistema.differenziale > test/contratti/irrigazione.json), il test fallisce.
Il browser verifica lo stesso file in test/js/test_orto_differenziale.js."""
import json
import os
import unittest

from sistema import differenziale
from sistema.controllo import ControlloreTimer

FILE = os.path.join(os.path.dirname(__file__), "contratti", "irrigazione.json")


class TestContrattoIrrigazione(unittest.TestCase):
    def test_contratto_aggiornato(self):
        with open(FILE, encoding="utf-8") as f:
            salvato = json.load(f)
        attuale = json.loads(json.dumps(differenziale.contratto()))
        self.assertEqual([c["nome"] for c in salvato["casi"]], [c["nome"] for c in attuale["casi"]])
        for a, b in zip(salvato["casi"], attuale["casi"]):
            self.assertEqual(a, b, "caso %s: rigenera il contratto" % a["nome"])
        self.assertEqual(salvato["replay"], attuale["replay"])

    def test_casi_richiesti_presenti(self):
        nomi = {c["nome"] for c in differenziale.casi()}
        for n in ("giornata_asciutta", "giornata_piovosa", "settimana_estiva", "mese_invernale", "anno_completo",
                  "blackout", "sensore_guasto", "serbatoio_vuoto", "manuale_timer"):
            self.assertIn(n, nomi)

    def test_casi_significativi(self):
        """Ogni caso deve mettere alla prova quello che dice il suo nome."""
        r = {c["nome"]: differenziale.esegui(c) for c in differenziale.casi() if c["nome"] not in ("anno_completo", "gemello_orto")}
        allarmi = lambda n: {a[1] for a in r[n]["allarmi"]}
        self.assertGreater(r["giornata_asciutta"]["totali"]["litri"], 0)
        self.assertEqual(r["giornata_piovosa"]["totali"]["litri"], 0)
        self.assertIn("GELO", allarmi("mese_invernale"))
        self.assertIn("Z1_SENSORE", allarmi("sensore_guasto"))
        self.assertIn("SERBATOIO_BASSO", allarmi("serbatoio_vuoto"))
        self.assertIn("POMPA_NON_EROGA", allarmi("pompa_guasta_flussimetro"))
        self.assertIn("Z2_INEFFICACE", allarmi("tubo_rotto"))
        self.assertIn("Z2_ACQUA_INATTESA", allarmi("valvola_bloccata_aperta"))
        self.assertEqual(r["aiuola_vuota_portate_diverse"]["giorni"][-1]["zone"][1][0], 0.0)
        # blackout di 30 ore: nessuna pompa accesa mentre manca la corrente
        a, d = 2 * 1440 + 600, 30 * 60
        for m, z in r["blackout"]["eventi_pompa"]:
            if a <= m < a + d:
                self.assertEqual(z, -1)

    def test_timer(self):
        t = ControlloreTimer(2, 420, 10)
        self.assertEqual([t.passo({"minuto": m})["valvole"] for m in (419, 420, 430, 440)],
                         [[False, False], [True, False], [False, True], [False, False]])
        self.assertFalse(t.passo({"minuto": 425, "serbatoio_basso": True})["pompa"])


if __name__ == "__main__":
    unittest.main()
