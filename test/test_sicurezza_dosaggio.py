"""Sicurezza del dosaggio: niente valori 'sicuri per tutti'. Stessa pompa e stesso acido possono essere sicuri su un
serbatoio e pericolosi su un altro; la titolazione misurata vince sul modello; ogni guasto grave ha una protezione
che non dipende dal firmware e una prova fisica."""
import unittest

from sistema import sicurezza_dosaggio as SD
from sistema.idro_modello import Serbatoio, simula_idro, SCENARI_IDRO


class TestSicurezzaDosaggio(unittest.TestCase):
    def test_modello_coerente_con_il_serbatoio_simulato(self):
        for a in (0.1, 0.5, 1.0, 3.0):
            t = Serbatoio(volume=100, alcalinita=a)
            self.assertAlmostEqual(SD.alcalinita_da_ph(t.ph), a, places=9)

    def test_stessa_pompa_e_stesso_acido_non_sono_sicuri_ovunque(self):
        grande = SD.verifica_installazione(volume_l=120, portata_ml_s=0.5, timer_hw_s=20, ml_per_dose=1.2, diluizione=10)
        piccolo = SD.verifica_installazione(volume_l=20, portata_ml_s=0.5, timer_hw_s=20, ml_per_dose=0.2, diluizione=1)
        self.assertEqual(grande["esito"], "sicuro")
        self.assertEqual(piccolo["esito"], "non_sicuro")
        self.assertLess(piccolo["ph_caso_peggiore"], SD.PH_DANNO)
        # i limiti proposti rendono sicuro l'impianto piccolo
        rifatto = SD.verifica_installazione(volume_l=20, portata_ml_s=0.5, timer_hw_s=piccolo["timer_hw_massimo_s"] * 0.9,
                                            ml_per_dose=0.2, diluizione=1)
        self.assertGreaterEqual(rifatto["ph_caso_peggiore"], SD.PH_DANNO)

    def test_caso_peggiore_dal_volume_minimo(self):
        pieno = SD.verifica_installazione(volume_l=60, portata_ml_s=1, timer_hw_s=20, ml_per_dose=0.5, diluizione=10)
        basso = SD.verifica_installazione(volume_l=60, volume_minimo_l=25, portata_ml_s=1, timer_hw_s=20, ml_per_dose=0.5, diluizione=10)
        self.assertLess(basso["ph_caso_peggiore"], pieno["ph_caso_peggiore"])

    def test_dose_normale_troppo_grande(self):
        r = SD.verifica_installazione(volume_l=20, portata_ml_s=0.1, timer_hw_s=5, ml_per_dose=10.0, diluizione=10)
        self.assertTrue(any("dose normale" in x for x in r["problemi"]))

    def test_titolazione_misurata_vince_sul_modello(self):
        # soluzione molto tamponata: 1 L di campione, il pH scende poco con l'acido
        tit = (1.0, [(0, 6.1), (0.5, 6.0), (1.0, 5.9), (2.0, 5.6), (3.0, 5.0), (4.0, 4.0)])
        m = SD.verifica_installazione(volume_l=30, portata_ml_s=0.5, timer_hw_s=20, ml_per_dose=0.3, diluizione=10)
        t = SD.verifica_installazione(volume_l=30, portata_ml_s=0.5, timer_hw_s=20, ml_per_dose=0.3, diluizione=10, titolazione=tit)
        self.assertEqual(t["fonte"], "titolazione misurata")
        self.assertIn("affidabilità C", m["fonte"])
        self.assertNotAlmostEqual(t["ph_caso_peggiore"], m["ph_caso_peggiore"], places=2)
        self.assertAlmostEqual(SD.ph_dopo_acido_titolazione(tit, 1.0, 1.5), 5.75, places=9)

    def test_calcolo_uguale_al_simulatore_con_dosatore_bloccato(self):
        r = simula_idro(SCENARI_IDRO["dosatore_bloccato_con_timer"], giorni=3)
        i = 288                                   # 2 giorni, una lettura ogni 10 minuti
        calcolo = SD.ph_dopo_acido(r["serbatoio"].v, r["ph"][i - 1], r["bloccato"]["ml"], SD.MEQ_PER_ML_PH_MENO)
        self.assertAlmostEqual(calcolo, min(r["ph"][i:i + 12]), delta=0.1)
        self.assertLess(calcolo, SD.PH_DANNO, "acido NON diluito a 1,5 mL/s per 20 s su 120 L: danno")

    def test_matrice_dei_guasti_completa(self):
        v = SD.valuta_matrice()
        self.assertEqual(v["scoperti"], [], "guasti gravi senza protezione indipendente dal firmware")
        nomi = " ".join(g["guasto"].lower() for g in SD.MATRICE_GUASTI)
        for parola in ("relè", "mosfet", "esp32 bloccato", "watchdog", "sonda ph", "portata eccessiva", "vuoto",
                       "serbatoio piccolo", "miscelazione", "concentrazione", "blackout", "riavvio", "reale"):
            self.assertIn(parola, nomi)
        for g in SD.MATRICE_GUASTI:
            for k in ("causa", "effetto", "gravita", "rilevabilita", "protezione_sw", "verifica"):
                self.assertTrue(g[k], g["id"] + " senza " + k)


if __name__ == "__main__":
    unittest.main()
