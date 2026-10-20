"""Collaudo virtuale: ogni scenario di sistema/scenari.py deve dare il risultato atteso, e ogni soluzione di
sistema/soluzioni.py deve davvero migliorare le cose. Sono le stesse prove che si rifanno con l'hardware vero
(COLLAUDO.md)."""
import csv
import os
import tempfile
import unittest

from sistema.scenari import G
from sistema.simula import esegui
from sistema.soluzioni import RIALZATE, PACCIAMATE

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def primo(r, allarme):
    for m, a, cosa in r["eventi"]:
        if a == allarme and cosa == "comparso":
            return m
    return None


class Base(unittest.TestCase):
    def comuni(self, r):
        self.assertEqual(r["minuti_a_secco"], 0, "la pompa non deve mai girare a serbatoio vuoto")
        self.assertEqual(r["pompa_dopo_riavvio"], 0, "alla riaccensione la pompa deve essere ferma")

    def senza_ristagno(self, r):
        self.assertEqual(sum(r["ore_ristagno"]), 0, "l'irrigazione non deve mai allagare")


class TestGuasti(Base):
    def test_normale(self):
        r = esegui("normale")
        self.comuni(r)
        self.senza_ristagno(r)
        self.assertEqual(sum(r["ore_stress"]), 0)
        self.assertEqual(r["allarmi_visti"], [])

    def test_pioggia(self):
        r = esegui("pioggia")
        senza_irrigare = esegui("pioggia", {"soglia_on": 0.0, "soglia_critica": 0.0})
        self.comuni(r)
        # l'unico ristagno è quello della pioggia: irrigando non si aggiunge nemmeno un'ora
        self.assertEqual(r["ore_ristagno"], senza_irrigare["ore_ristagno"])
        self.assertEqual(sum(r["ore_stress"]), 0)
        self.assertEqual(r["allarmi_visti"], [])

    def test_sensore_staccato(self):
        r = esegui("sensore_staccato")
        self.comuni(r)
        self.senza_ristagno(r)
        m = primo(r, "Z1_SENSORE")
        self.assertIsNotNone(m)
        self.assertLessEqual(m - 3 * G, 1)
        self.assertNotIn("Z1_INEFFICACE", r["allarmi_visti"])
        self.assertEqual(r["ore_stress"][1], 0, "l'altra zona continua a funzionare")

    def test_sensore_fuori_terra(self):
        r = esegui("sensore_fuori_terra")
        self.comuni(r)
        self.senza_ristagno(r)
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
        self.assertLessEqual(r["litri_persi"], 12, "una sola irrigazione persa, poi la zona si blocca")

    def test_tubo_scoppiato(self):
        r = esegui("tubo_scoppiato")
        self.comuni(r)
        self.assertIn("Z1_INEFFICACE", r["allarmi_visti"])
        self.assertLessEqual(r["litri_persi"], 25)
        f = esegui("tubo_scoppiato", modifiche={"flussimetro": True})
        self.assertIn("Z1_PERDITA", f["allarmi_visti"])
        self.assertLessEqual(f["litri_persi"], 6, "con il flussimetro la perdita si vede in 2 minuti")

    def test_valvola_bloccata_aperta(self):
        r = esegui("valvola_bloccata_aperta")
        self.comuni(r)
        self.senza_ristagno(r)
        self.assertIn("Z2_ACQUA_INATTESA", r["allarmi_visti"])
        self.assertEqual(sum(r["ore_stress"]), 0, "le altre zone continuano a ricevere acqua")
        senza = esegui("valvola_bloccata_aperta", modifiche={"sensore_pioggia": False})
        self.assertNotIn("Z2_ACQUA_INATTESA", senza["allarmi_visti"], "senza sapere se piove il controllo è spento")

    def test_pompa_guasta(self):
        r = esegui("pompa_guasta")
        self.comuni(r)
        m = primo(r, "POMPA_NON_EROGA")
        self.assertIsNotNone(m)
        self.assertLess(m - 5 * G, G)
        self.assertNotIn("Z1_INEFFICACE", r["allarmi_visti"])
        self.assertNotIn("Z2_INEFFICACE", r["allarmi_visti"])
        f = esegui("pompa_guasta", modifiche={"flussimetro": True, "sensore_livello": False})
        self.assertIn("POMPA_NON_EROGA", f["allarmi_visti"])

    def test_pompa_guasta_senza_sensore_livello(self):
        r = esegui("pompa_guasta_senza_livello")
        self.comuni(r)
        self.assertTrue({"Z1_INEFFICACE", "Z2_INEFFICACE"} & set(r["allarmi_visti"]))

    def test_serbatoio_vuoto(self):
        r = esegui("serbatoio_vuoto")
        self.comuni(r)
        self.assertIn("SERBATOIO_BASSO", r["allarmi_visti"])
        self.assertGreater(r["serbatoio_finale"], 0)


class TestMeteo(Base):
    def test_ondata_calore(self):
        r = esegui("ondata_calore")
        self.comuni(r)
        self.senza_ristagno(r)
        self.assertEqual(sum(r["ore_stress"]), 0)
        self.assertIn("CALDO", r["allarmi_visti"])
        p = esegui("ondata_calore", modifiche={"zone": PACCIAMATE})
        self.assertLess(p["litri"], r["litri"] * 0.9, "la pacciamatura deve far risparmiare almeno il 10%")

    def test_siccita(self):
        r = esegui("siccita")
        self.comuni(r)
        self.assertIn("SERBATOIO_BASSO", r["allarmi_visti"])
        p = esegui("siccita", modifiche={"zone": PACCIAMATE, "parametri": {"riserva_l": 300.0}})
        self.assertIsNone(p["giorno_cisterna_bassa"])
        self.assertEqual(sum(p["ore_stress"]), 0)
        self.assertIn("SERBATOIO_RISERVA", p["allarmi_visti"])

    def test_nubifragio(self):
        r = esegui("nubifragio")
        self.comuni(r)
        self.assertIn("Z1_ALLAGATA", r["allarmi_visti"])
        self.assertGreater(sum(r["ore_asfissia"]), 0)
        dopo = [m for m, z in r["avvii_pompa"] if m >= 2 * G + 15 * 60]
        self.assertEqual(dopo, [], "dopo il nubifragio non si irriga")
        a = esegui("nubifragio", modifiche={"zone": RIALZATE})
        self.assertEqual(sum(a["ore_asfissia"]), 0)
        self.assertLess(sum(a["ore_ristagno"]), sum(r["ore_ristagno"]) / 2)

    def test_pioggia_persistente(self):
        r = esegui("pioggia_persistente")
        self.assertEqual(r["litri"], 0, "con la pioggia non si irriga mai")
        self.assertIn("Z1_ALLAGATA", r["allarmi_visti"])
        a = esegui("pioggia_persistente", modifiche={"zone": RIALZATE})
        self.assertEqual(sum(a["ore_ristagno"]), 0)

    def test_previsione_sbagliata(self):
        r = esegui("previsione_sbagliata")
        self.comuni(r)
        self.assertEqual(sum(r["ore_stress"]), 0, "sotto la soglia critica si irriga anche con pioggia prevista")
        cieco = esegui("previsione_sbagliata", {"soglia_critica": 0.0})
        self.assertGreater(sum(cieco["ore_stress"]), 0)

    def test_gelata_tardiva(self):
        r = esegui("gelata_tardiva")
        self.comuni(r)
        self.assertEqual(r["gelo_irriga_min"], 0)
        self.assertIn("GELO", r["allarmi_visti"])
        self.assertEqual(sum(r["ore_stress"]), 0)

    def test_gelo(self):
        self.assertIn("GELO", esegui("gelo")["allarmi_visti"])

    def test_meteo_da_csv(self):
        with tempfile.TemporaryDirectory() as d:
            percorso = os.path.join(d, "meteo.csv")
            with open(percorso, "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(["data", "et0_mm", "pioggia_mm", "t_min", "t_max"])
                for g in range(10):
                    w.writerow(["2024-07-%02d" % (g + 1), 6.5, 25.0 if g == 4 else 0.0, 19, 34])
            r = esegui("normale", meteo_csv=percorso)
        self.comuni(r)
        self.assertEqual(r["righe"][-1]["giorno"], 10)
        self.assertEqual(sum(r["ore_stress"]), 0)


class TestCorrente(Base):
    def test_riavvio(self):
        r = esegui("riavvio")
        self.comuni(r)
        self.senza_ristagno(r)
        self.assertIn("SPENTO", [e[1] for e in r["eventi"]])
        self.assertEqual(r["riavvii"], 1)
        self.assertEqual(sum(r["ore_stress"]), 0)

    def test_blackout_lungo(self):
        r = esegui("blackout_lungo")
        self.comuni(r)
        self.assertEqual(r["minuti_spento"], 72 * 60)
        corto = esegui("blackout_lungo", modifiche={"interruzioni": [(5 * G + 480, 24 * 60)]})
        self.assertEqual(sum(corto["ore_stress"]), 0, "il terreno umido regge un giorno anche col caldo")

    def test_brownout_pompa(self):
        r = esegui("brownout_pompa")
        self.comuni(r)
        self.senza_ristagno(r)
        self.assertIn("RIAVVII_FREQUENTI", r["allarmi_visti"])
        self.assertLessEqual(r["litri"], 10)
        vecchio = esegui("brownout_pompa", modifiche={"memoria": False})
        self.assertGreater(sum(vecchio["ore_ristagno"]), 0, "senza memoria i riavvii allagano (rischio documentato)")

    def test_solare(self):
        r = esegui("solare_nuvoloso")
        self.comuni(r)
        self.assertIn("BATTERIA_BASSA", r["allarmi_visti"])
        d = esegui("solare_nuvoloso", modifiche={"energia": {"pannello_w": 20.0, "batteria_wh": 144.0, "carica": 0.8}})
        self.assertEqual(d["minuti_spento"], 0)
        self.assertEqual(sum(d["ore_stress"]), 0)


class TestAllagamento(Base):
    def test_quadro_allagato(self):
        r = esegui("quadro_allagato")
        self.assertTrue(r["quadro_distrutto"])
        m_allarme = primo(r, "ALLAGAMENTO_QUADRO")
        m_danno = next(m for m, a, c in r["eventi"] if a == "QUADRO_SOMMERSO")
        self.assertLess(m_allarme, m_danno, "il sensore deve avvisare prima che l'acqua arrivi all'elettronica")
        alto = esegui("quadro_allagato", modifiche={"quadro_altezza_mm": 500.0})
        self.assertFalse(alto["quadro_distrutto"])
        self.assertEqual(alto["minuti_spento"], 0)


class TestScaricaMeteo(unittest.TestCase):
    def test_converti(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("scarica_meteo",
                                                      os.path.join(RADICE, "strumenti", "scarica_meteo.py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        risposta = {"daily": {"time": ["2024-07-01", "2024-07-02"], "et0_fao_evapotranspiration": [6.12, None],
                              "precipitation_sum": [0.0, 3.2], "temperature_2m_min": [19.4, 20.1],
                              "temperature_2m_max": [33.0, 31.2]}}
        righe = mod.converti(risposta)
        self.assertEqual(righe, [{"data": "2024-07-01", "et0_mm": 6.12, "pioggia_mm": 0.0, "t_min": 19.4,
                                  "t_max": 33.0}])


if __name__ == "__main__":
    unittest.main()
