"""Collaudo virtuale: ogni scenario di sistema/scenari.py deve dare il risultato atteso.
Sono le stesse prove che si rifanno a mano con l'hardware vero (COLLAUDO.md)."""
import unittest

from sistema.scenari import G
from sistema.simula import esegui


def primo(r, allarme):
    for m, a, cosa in r["eventi"]:
        if a == allarme and cosa == "comparso":
            return m
    return None


class TestScenari(unittest.TestCase):
    def comuni(self, r):
        self.assertEqual(r["minuti_a_secco"], 0, "la pompa non deve mai girare a serbatoio vuoto")
        self.assertEqual(sum(r["ore_ristagno"]), 0, "l'irrigazione non deve mai allagare")

    def test_normale(self):
        r = esegui("normale")
        self.comuni(r)
        self.assertEqual(sum(r["ore_stress"]), 0)
        self.assertEqual(r["allarmi_visti"], [])

    def test_pioggia(self):
        r = esegui("pioggia")
        senza_irrigare = esegui("pioggia", {"soglia_on": 0.0, "soglia_critica": 0.0})
        self.assertEqual(r["minuti_a_secco"], 0)
        # l'unico ristagno è quello della pioggia: irrigando non si aggiunge nemmeno un'ora
        self.assertEqual(r["ore_ristagno"], senza_irrigare["ore_ristagno"])
        self.assertEqual(sum(r["ore_stress"]), 0)
        self.assertEqual(r["allarmi_visti"], [])

    def test_sensore_staccato(self):
        r = esegui("sensore_staccato")
        self.comuni(r)
        m = primo(r, "Z1_SENSORE")
        self.assertIsNotNone(m)
        self.assertLessEqual(m - 3 * G, 1)
        self.assertNotIn("Z1_INEFFICACE", r["allarmi_visti"])
        self.assertEqual(r["ore_stress"][1], 0, "l'altra zona continua a funzionare")

    def test_sensore_fuori_terra(self):
        r = esegui("sensore_fuori_terra")
        self.comuni(r)
        m = primo(r, "Z2_INEFFICACE")
        self.assertIsNotNone(m)
        self.assertLess(m - 3 * G, G)
        self.assertEqual(r["ore_stress"][0], 0)

    def test_tubo_rotto(self):
        r = esegui("tubo_rotto")
        self.comuni(r)
        m = primo(r, "Z1_INEFFICACE")
        self.assertIsNotNone(m)
        self.assertLess(m - 5 * G, G)
        self.assertEqual(r["ore_stress"][1], 0)
        self.assertNotIn("POMPA_NON_EROGA", r["allarmi_visti"])

    def test_pompa_guasta(self):
        r = esegui("pompa_guasta")
        self.comuni(r)
        m = primo(r, "POMPA_NON_EROGA")
        self.assertIsNotNone(m)
        self.assertLess(m - 5 * G, G)
        self.assertNotIn("Z1_INEFFICACE", r["allarmi_visti"])
        self.assertNotIn("Z2_INEFFICACE", r["allarmi_visti"])

    def test_pompa_guasta_senza_sensore_livello(self):
        r = esegui("pompa_guasta_senza_livello")
        self.comuni(r)
        self.assertTrue({"Z1_INEFFICACE", "Z2_INEFFICACE"} & set(r["allarmi_visti"]))

    def test_serbatoio_vuoto(self):
        r = esegui("serbatoio_vuoto")
        self.comuni(r)
        self.assertIn("SERBATOIO_BASSO", r["allarmi_visti"])
        self.assertGreater(r["serbatoio_finale"], 0)

    def test_gelo(self):
        self.assertIn("GELO", esegui("gelo")["allarmi_visti"])

    def test_riavvio(self):
        r = esegui("riavvio")
        self.comuni(r)
        self.assertIn("RIAVVIO", [e[1] for e in r["eventi"]])
        self.assertEqual(r["pompa_dopo_riavvio"], 0, "alla riaccensione la pompa deve essere ferma")
        self.assertEqual(sum(r["ore_stress"]), 0)


if __name__ == "__main__":
    unittest.main()
