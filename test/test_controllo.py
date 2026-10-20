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
    def avviato(self, n=1, memoria=None, **par):
        par.setdefault("filtro", 1.0)            # le prove delle regole usano letture pulite, senza media mobile
        c = Controllore(n, par, memoria)
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
        for m in range(5, 15):
            self.assertTrue(c.passo(letture(m, [0.40]))["pompa"])
        self.assertFalse(c.passo(letture(15, [0.40]))["pompa"])  # tempo massimo
        self.assertNotIn("Z1_INEFFICACE", c.passo(letture(22, [0.40]))["allarmi"])
        out = c.passo(letture(23, [0.40]))                       # 8 minuti dopo: l'umidità non è salita
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
            Controllore(1, {"verifica_pompa_min": 10, "max_min": 10})


    def test_filtro_contro_il_rumore(self):
        c = Controllore(1)                                       # filtro di default
        c.passo(letture(0, [0.47]))
        for m in range(1, 40):                                   # rumore tra 44% e 49% attorno a 46,5%
            self.assertFalse(c.passo(letture(m, [0.44 if m % 2 else 0.49]))["pompa"])

    def test_pioggia_in_corso(self):
        c = self.avviato()
        self.assertFalse(c.passo(letture(5, [0.40], pioggia_in_corso=True))["pompa"])
        self.assertTrue(c.passo(letture(6, [0.25], pioggia_in_corso=True))["pompa"])   # soglia critica

    def test_gelo_blocca_irrigazione(self):
        c = self.avviato()
        self.assertFalse(c.passo(letture(5, [0.20], temp_c=1.0))["pompa"])
        c2 = self.avviato(blocco_gelo=False)
        self.assertTrue(c2.passo(letture(5, [0.20], temp_c=1.0))["pompa"])

    def test_allagamento_quadro(self):
        c = self.avviato()
        self.assertTrue(c.passo(letture(5, [0.40]))["pompa"])
        out = c.passo(letture(6, [0.40], allagamento=True))
        self.assertFalse(out["pompa"])
        self.assertIn("ALLAGAMENTO_QUADRO", out["allarmi"])

    def test_batteria_bassa(self):
        c = self.avviato()
        out = c.passo(letture(5, [0.40], batteria=0.30))
        self.assertFalse(out["pompa"])
        self.assertIn("BATTERIA_BASSA", out["allarmi"])
        self.assertTrue(c.passo(letture(6, [0.40], batteria=0.60))["pompa"])

    def test_riserva_soglie_di_risparmio(self):
        c = self.avviato(riserva_l=300.0)
        out = c.passo(letture(5, [0.40], serbatoio_l=200.0))
        self.assertFalse(out["pompa"])                           # in riserva parte solo sotto il 35%
        self.assertIn("SERBATOIO_RISERVA", out["allarmi"])
        self.assertTrue(c.passo(letture(6, [0.34], serbatoio_l=200.0))["pompa"])
        self.assertFalse(c.passo(letture(7, [0.56], serbatoio_l=199.0))["pompa"])   # e si ferma al 55%

    def test_flussimetro(self):
        c = self.avviato()
        for m in range(5, 7):
            c.passo(letture(m, [0.40 + (m - 5) * 0.01], flusso_l_min=0.0))
        out = c.passo(letture(7, [0.42], flusso_l_min=0.0))      # 2 minuti a flusso zero
        self.assertIn("POMPA_NON_EROGA", out["allarmi"])
        c = self.avviato()
        for m in range(5, 7):
            c.passo(letture(m, [0.40], flusso_l_min=2.0))
        out = c.passo(letture(7, [0.40], flusso_l_min=2.0))      # doppio della portata: perdita
        self.assertIn("Z1_PERDITA", out["allarmi"])
        self.assertFalse(out["pompa"])

    def test_acqua_inattesa(self):
        c = self.avviato(2)
        u2 = 0.50
        for m in range(5, 15):                                   # irriga la zona 1, ma si bagna anche la 2
            out = c.passo(letture(m, [0.40, u2], pioggia_in_corso=False))
            u2 += 0.012
        self.assertIn("Z2_ACQUA_INATTESA", out["allarmi"])
        self.assertFalse(c.passo(letture(15, [0.40, u2], pioggia_in_corso=False))["pompa"])   # tempo massimo
        # la zona 1 ha ricevuto acqua (44%): si può irrigare finché la zona 2 non è troppo bagnata
        self.assertTrue(c.passo(letture(200, [0.44, 0.60], pioggia_in_corso=False))["pompa"])
        self.assertFalse(c.passo(letture(201, [0.44, 0.86], pioggia_in_corso=False))["pompa"])

    def test_acqua_inattesa_serve_sapere_se_piove(self):
        c = self.avviato(2)
        u2 = 0.50
        for m in range(5, 15):
            out = c.passo(letture(m, [0.40, u2]))                # nessuna informazione sulla pioggia
            u2 += 0.012
        self.assertNotIn("Z2_ACQUA_INATTESA", out["allarmi"])
        c = self.avviato(2)
        u2 = 0.50
        for m in range(5, 15):
            out = c.passo(letture(m, [0.40, u2], pioggia_in_corso=True))   # piove: è la pioggia
            u2 += 0.012
        self.assertNotIn("Z2_ACQUA_INATTESA", out["allarmi"])

    def test_zona_allagata(self):
        c = self.avviato()
        for m in range(60, 60 * 8, 60):
            out = c.passo(letture(m, [0.99]))
        self.assertIn("Z1_ALLAGATA", out["allarmi"])

    def test_memoria_blocchi_dopo_riavvio(self):
        c = self.avviato(memoria={})
        for m in range(60, 71):                                  # dopo la pausa di avvio: 10 minuti senza effetto
            c.passo(letture(m, [0.40]))
        c.passo(letture(78, [0.40]))
        mem = c.memoria()
        self.assertTrue(mem["bloccata"][0])
        c2 = self.avviato(memoria=mem)                           # riavvio: il blocco resta
        self.assertIn("Z1_INEFFICACE", c2.passo(letture(500, [0.10]))["allarmi"])
        self.assertFalse(c2.passo(letture(501, [0.10]))["pompa"])

    def test_memoria_pausa_dopo_riavvio(self):
        c = self.avviato(memoria={})
        self.assertFalse(c.passo(letture(5, [0.40]))["pompa"])  # dopo un riavvio tutte le zone sono in pausa
        self.assertTrue(c.passo(letture(60, [0.40]))["pompa"])

    def test_riavvii_frequenti_con_pompa(self):
        mem = {}
        for _ in range(3):                                       # si riavvia ogni volta che parte la pompa
            c = Controllore(1, {"filtro": 1.0}, mem)
            for m in range(0, 61):
                out = c.passo(letture(m, [0.40]))
                if c.memoria_cambiata:
                    mem = c.memoria()
                if out["pompa"]:
                    break
        c = Controllore(1, {"filtro": 1.0}, mem)
        out = c.passo(letture(0, [0.40]))
        self.assertIn("RIAVVII_FREQUENTI", out["allarmi"])
        self.assertFalse(c.passo(letture(100, [0.10]))["pompa"])
        c.reset()
        self.assertTrue(c.passo(letture(101, [0.10]))["pompa"])

    def test_irrigazione_regolare_azzera_riavvii(self):
        c = Controllore(1, {"filtro": 1.0}, {"pompa_in_corso": True, "riavvii_pompa": 1})
        self.assertEqual(c.riavvii_pompa, 2)
        for m in range(0, 61):
            c.passo(letture(m, [0.40]))
        c.passo(letture(61, [0.40]))
        c.passo(letture(65, [0.75]))                             # irrigazione finita regolarmente
        self.assertEqual(c.memoria()["riavvii_pompa"], 0)


if __name__ == "__main__":
    unittest.main()
