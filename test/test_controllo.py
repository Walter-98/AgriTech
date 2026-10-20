"""Prove della logica di controllo, una regola alla volta (senza simulare il terreno)."""
import unittest

from sistema.controllo import Controllore

SECCO, BAGNATO = 3000, 1300


def adc(u):
    """Umidità 0..1 -> lettura grezza del sensore con la taratura di default."""
    return int(SECCO - u * (SECCO - BAGNATO))


def letture(m, umidita, **altro):
    l = {"minuto": m, "adc": [adc(u) if u is not None else 0 for u in umidita], "serbatoio_basso": False,
         "serbatoio_l": None, "temp_c": 20.0, "pioggia_prevista_mm": 0.0}
    l.update(altro)
    return l


class TestControllo(unittest.TestCase):
    def avviato(self, n=1, **par):
        c = Controllore(n, par or None)
        c.passo(letture(0, [0.6] * n))           # prima lettura: parte il conteggio dell'attesa dopo l'accensione
        return c

    def test_pompa_ferma_all_accensione(self):
        c = Controllore(1)
        self.assertFalse(c.passo(letture(0, [0.1]))["pompa"])
        self.assertFalse(c.passo(letture(1, [0.1]))["pompa"])
        self.assertTrue(c.passo(letture(2, [0.1]))["pompa"])

    def test_isteresi(self):
        c = self.avviato()
        self.assertFalse(c.passo(letture(5, [0.50]))["pompa"])   # tra le soglie: non parte
        self.assertTrue(c.passo(letture(6, [0.40]))["pompa"])
        self.assertTrue(c.passo(letture(7, [0.55]))["pompa"])    # tra le soglie: continua
        self.assertFalse(c.passo(letture(8, [0.71]))["pompa"])

    def test_tempo_massimo_e_pausa(self):
        c = self.avviato(aumento_minimo=0.0)
        accesa = [c.passo(letture(m, [0.40]))["pompa"] for m in range(10, 100)]
        self.assertEqual(accesa[:10], [True] * 10)
        self.assertFalse(any(accesa[10:70]))                     # 60 minuti di pausa
        self.assertTrue(accesa[70])

    def test_una_zona_alla_volta_la_piu_secca(self):
        c = self.avviato(2)
        out = c.passo(letture(5, [0.40, 0.35]))
        self.assertEqual(out["valvole"], [False, True])

    def test_serbatoio_basso_ferma_subito(self):
        c = self.avviato()
        self.assertTrue(c.passo(letture(5, [0.40]))["pompa"])
        out = c.passo(letture(6, [0.40], serbatoio_basso=True))
        self.assertFalse(out["pompa"])
        self.assertIn("SERBATOIO_BASSO", out["allarmi"])

    def test_sensore_fuori_campo(self):
        c = self.avviato()
        out = c.passo(letture(5, [None]))
        self.assertFalse(out["pompa"])
        self.assertIn("Z1_SENSORE", out["allarmi"])
        self.assertEqual(out["stato"], ["sensore_guasto"])

    def test_emergenza_a_tempo_con_sensore_guasto(self):
        c = self.avviato(emergenza_ogni_min=100, emergenza_durata_min=3)
        accesa = [c.passo(letture(m, [None]))["pompa"] for m in range(5, 210)]
        self.assertFalse(any(accesa[:100]))
        self.assertEqual(accesa[100:104], [True, True, True, False])

    def test_irrigazione_inefficace_blocca_zona(self):
        c = self.avviato()
        for m in range(5, 13):
            self.assertTrue(c.passo(letture(m, [0.40]))["pompa"])
        out = c.passo(letture(13, [0.40]))                       # 8 minuti e l'umidità non è salita
        self.assertFalse(out["pompa"])
        self.assertIn("Z1_INEFFICACE", out["allarmi"])
        self.assertFalse(c.passo(letture(500, [0.10]))["pompa"])  # resta bloccata
        c.reset()
        self.assertTrue(c.passo(letture(501, [0.10]))["pompa"])

    def test_pompa_non_eroga(self):
        c = self.avviato()
        for m in range(5, 13):
            c.passo(letture(m, [0.40 + (m - 5) * 0.01], serbatoio_l=500.0))
        out = c.passo(letture(13, [0.50], serbatoio_l=500.0))
        self.assertIn("POMPA_NON_EROGA", out["allarmi"])
        self.assertFalse(out["pompa"])

    def test_pioggia_nel_serbatoio_non_e_guasto_pompa(self):
        c = self.avviato()
        for m in range(5, 13):
            c.passo(letture(m, [0.40 + (m - 5) * 0.01], serbatoio_l=500.0 + (30 if m > 7 else 0)))
        out = c.passo(letture(13, [0.50], serbatoio_l=530.0))
        self.assertNotIn("POMPA_NON_EROGA", out["allarmi"])

    def test_pioggia_prevista(self):
        c = self.avviato()
        self.assertFalse(c.passo(letture(5, [0.40], pioggia_prevista_mm=5))["pompa"])
        self.assertTrue(c.passo(letture(6, [0.25], pioggia_prevista_mm=5))["pompa"])   # sotto soglia critica

    def test_gelo_e_caldo(self):
        c = self.avviato()
        self.assertIn("GELO", c.passo(letture(5, [0.6], temp_c=1.0))["allarmi"])
        self.assertIn("CALDO", c.passo(letture(6, [0.6], temp_c=40.0))["allarmi"])

    def test_parametri_incoerenti(self):
        with self.assertRaises(ValueError):
            Controllore(1, {"verifica_dopo_min": 10, "max_min": 10})


if __name__ == "__main__":
    unittest.main()
