"""Fase 6: logica di controllo dell'idroponica provata sul serbatoio simulato, guasto per guasto."""
import unittest

from sistema.idro_controllo import ControlloIdro, COLLAUDO_RICHIESTO
from sistema.idro_modello import simula_idro, SCENARI_IDRO


def prova(nome, **kw):
    return simula_idro(SCENARI_IDRO[nome], **kw)


class TestControlloIdro(unittest.TestCase):
    def test_normale_tiene_ph_ed_ec(self):
        r = prova("normale")
        self.assertTrue(all(5.5 <= v <= 6.3 for v in r["ph"]), (min(r["ph"]), max(r["ph"])))
        self.assertTrue(all(1.0 <= v <= 1.3 for v in r["ec"]), (min(r["ec"]), max(r["ec"])))
        self.assertEqual(r["controllo"].fissi, [])

    def test_mai_nutrienti_e_ph_insieme_e_attesa_di_miscelazione(self):
        r = prova("normale")
        t = r["dosi_t"]
        ab = [s for s, k, ml in t if k == "a"]
        ph = [s for s, k, ml in t if k == "ph"]
        self.assertFalse(set(ab) & set(ph))
        for s in ph:   # niente pH- nei 15 minuti dopo i nutrienti
            self.assertFalse(any(0 <= s - x < 900 for x in ab))
        for serie in (ab, ph):
            for x, y in zip(serie, serie[1:]):
                self.assertGreaterEqual(y - x, 600)

    def test_limite_giornaliero_dosatori(self):
        r = prova("normale")
        per_giorno = {}
        for s, k, ml in r["dosi_t"]:
            per_giorno[(s // 86400, k)] = per_giorno.get((s // 86400, k), 0) + ml
        for (g, k), ml in per_giorno.items():
            limite = (0.15 if k == "ph" else 0.25) * 120
            self.assertLessEqual(ml, limite + 1e-9)

    def test_sonda_ph_che_deriva_senza_penna_il_limite_salva_le_piante(self):
        r = prova("sonda_ph_deriva")
        self.assertGreater(min(r["ph"]), 5.0)       # scende, ma non crolla grazie al limite giornaliero

    def test_sonda_ph_che_deriva_la_penna_la_scopre(self):
        r = prova("sonda_ph_deriva_con_penna")
        self.assertIn("SONDA_PH_DA_TARARE", r["controllo"].fissi)
        dopo = [s for s, k, ml in r["dosi_t"] if k == "ph" and s > 3 * 86400 + 60]
        self.assertEqual(dopo, [])

    def test_sonda_bloccata_ferma_il_dosaggio(self):
        r = prova("sonda_ph_bloccata")
        self.assertIn("SONDA_PH_BLOCCATA", r["allarmi"])
        dopo = [s for s, k, ml in r["dosi_t"] if k == "ph" and s > 1.5 * 86400 + 3700]
        self.assertEqual(dopo, [])

    def test_sonda_ec_staccata_niente_nutrienti(self):
        r = prova("sonda_ec_staccata")
        self.assertIn("SONDA_EC_FUORI_CAMPO", r["allarmi"])
        self.assertFalse([s for s, k, ml in r["dosi_t"] if k == "a" and s > 86400])

    def test_flacone_vuoto_dosaggio_inefficace(self):
        self.assertIn("DOSAGGIO_INEFFICACE_PH", prova("flacone_ph_vuoto")["controllo"].fissi)
        self.assertIn("DOSAGGIO_INEFFICACE_EC", prova("flacone_a_vuoto")["controllo"].fissi)

    def test_perdita_spegne_tutto_subito(self):
        r = prova("perdita")
        self.assertIn("PERDITA", r["controllo"].fissi)
        self.assertLessEqual(r["acceso_con_perdita_s"], 60)
        self.assertFalse([s for s, k, ml in r["dosi_t"] if s > 2 * 86400 + 120])

    def test_pompa_guasta_non_gira_a_secco(self):
        r = prova("pompa_guasta")
        self.assertIn("FLUSSO_ASSENTE", r["controllo"].fissi)
        self.assertLessEqual(r["pompa_secca_s"], 3 * 120)

    def test_dopo_il_blackout_niente_dosi_per_15_minuti(self):
        r = prova("blackout")
        ripresa = r["riavvio_s"]
        self.assertFalse([s for s, k, ml in r["dosi_t"] if ripresa <= s < ripresa + 900])

    def test_acqua_calda_allarme(self):
        self.assertIn("ACQUA_CALDA", prova("acqua_calda")["allarmi"])

    def test_rete_chiusa_rabbocco_limitato_e_livello_basso(self):
        r = prova("rete_chiusa")
        self.assertIn("LIVELLO_BASSO", r["allarmi"])

    def test_modalita_ombra_non_comanda_niente(self):
        r = simula_idro(SCENARI_IDRO["normale"], giorni=2, parametri={"modo": "ombra"})
        self.assertEqual(r["azioni_in_ombra"], 0)
        self.assertGreater(r["proposti_in_ombra"], 0)
        self.assertEqual(sum(r["dosi_ml"].values()), 0)

    def test_reale_senza_conferma_resta_in_ombra(self):
        self.assertEqual(ControlloIdro({"modo": "reale"}).modo_effettivo(), "ombra")
        # la sola conferma non basta: servono collaudo documentato e taratura recente
        self.assertEqual(ControlloIdro({"modo": "reale", "conferma_reale": True}).modo_effettivo(), "ombra")
        tutto = {k: True for k in COLLAUDO_RICHIESTO}
        sicuro = {"esito": "sicuro"}
        par = {"modo": "reale", "conferma_reale": True, "collaudo": tutto, "taratura_ph_giorno": 0, "verifica_installazione": sicuro}
        c = ControlloIdro(par)
        # tutti i parametri a posto ma nessuna prova fisica: resta in ombra
        self.assertEqual(c.modo_effettivo(0), "ombra")
        self.assertEqual(set(c.prerequisiti_mancanti(0)), {"chiave_fisica", "autotest_taglio"})
        c.passo({"s": 0, "livello_min": True, "chiave_reale": True, "autotest_taglio_s": 0})
        self.assertEqual(c.modo_effettivo(0), "reale")
        self.assertEqual(c.modo_effettivo(40 * 86400), "ombra")            # taratura scaduta dopo 30 giorni
        c.passo({"s": 2 * 86400, "livello_min": True, "chiave_reale": True, "autotest_taglio_s": 0})
        self.assertIn("autotest_taglio", c.prerequisiti_mancanti(2 * 86400))   # autotest più vecchio di 24 ore
        c.passo({"s": 2 * 86400 + 60, "livello_min": True, "chiave_reale": False, "autotest_taglio_s": 2 * 86400})
        self.assertEqual(c.prerequisiti_mancanti(2 * 86400 + 60), ["chiave_fisica"])   # chiave girata: subito ombra
        nv = ControlloIdro(dict(par, verifica_installazione={"esito": "non_sicuro"}))
        nv.passo({"s": 0, "livello_min": True, "chiave_reale": True, "autotest_taglio_s": 0})
        self.assertEqual(nv.prerequisiti_mancanti(0), ["verifica_installazione"])
        manca = dict(tutto, prova_blackout=False)
        r = ControlloIdro({"modo": "reale", "conferma_reale": True, "collaudo": manca, "taratura_ph_giorno": 0})
        self.assertIn("collaudo:prova_blackout", r.prerequisiti_mancanti(0))
        out = r.passo({"s": 0, "livello_min": True})
        self.assertEqual(out["modo"], "ombra")
        self.assertTrue(any(n.startswith("REALE_NON_ATTIVO") for n in out["note"]))

    def test_reale_mai_con_un_parametro_solo(self):
        """Qualunque combinazione di soli parametri lascia il modo in OMBRA: servono gli ingressi fisici."""
        tutto = {k: True for k in COLLAUDO_RICHIESTO}
        for extra in ({}, {"chiave_reale": True}, {"autotest_taglio_s": 0}, {"dosaggio_abilitato": True}):
            par = dict({"modo": "reale", "conferma_reale": True, "collaudo": tutto, "taratura_ph_giorno": 0,
                        "verifica_installazione": {"esito": "sicuro"}}, **extra)
            c = ControlloIdro(par)
            out = c.passo({"s": 0, "livello_min": True, "ph": 7.5, "ec": 0.5})
            self.assertEqual(out["modo"], "ombra", extra)
            self.assertEqual(out["dose_ph_ml"] + out["dose_a_ml"], 0)

    def test_arresto_di_emergenza_prima_di_tutto(self):
        c = ControlloIdro()
        out = c.passo({"s": 2000, "arresto": True, "livello_min": True, "ph": 6.0, "ec": 1.2})
        self.assertFalse(out["pompa"] or out["luci"] or out["rabbocco"] or out["dose_ph_ml"])
        self.assertTrue(out["taglio_dosatori"])
        out = c.passo({"s": 2060, "reset": True, "arresto": True, "livello_min": True})   # reset ignorato col fungo premuto
        self.assertIn("ARRESTO_EMERGENZA", out["allarmi"])

    def test_dati_vecchi_valgono_come_mancanti(self):
        c = ControlloIdro()
        for i in range(20):
            out = c.passo({"s": 1000 + i * 60, "livello_min": True, "flusso_l_min": 6, "ph": 6.8, "ph_eta_s": 900, "ec": 1.2})
        self.assertIn("SONDA_PH_DATI_VECCHI", out["allarmi"])
        self.assertEqual(out["dose_ph_ml"], 0)

    def test_macchina_a_stati_del_dosaggio(self):
        r = simula_idro(SCENARI_IDRO["normale"], giorni=1)
        self.assertIn(r["controllo"].stato_dosaggio, ("PRONTO", "MISCELAZIONE", "VERIFICA_RISULTATO", "DOSAGGIO"))
        c = ControlloIdro({"dosaggio_abilitato": False})
        out = c.passo({"s": 5000, "livello_min": True, "ph": 7.0, "ec": 0.5})
        self.assertEqual(out["stato_dosaggio"], "DISABILITATO")
        self.assertEqual(out["dose_ph_ml"] + out["dose_a_ml"], 0)
        self.assertEqual(ControlloIdro().passo({"s": 10, "livello_min": True})["stato_dosaggio"], "ATTESA")

    def test_dosatore_bloccato_doppia_difesa(self):
        con = prova("dosatore_bloccato_con_timer")
        senza = prova("dosatore_bloccato_senza_timer")
        self.assertIn("DOSATORE_BLOCCATO", con["controllo"].fissi)
        self.assertIn("DOSATORE_BLOCCATO", senza["controllo"].fissi)
        self.assertLessEqual(con["bloccato"]["ml"], 30.0 + 1e-9)          # il relè temporizzato hardware ferma a 20 s
        self.assertLessEqual(senza["bloccato"]["s"], 3 * 60)             # senza timer: il taglio del controllo entro 3 minuti
        self.assertGreater(senza["bloccato"]["ml"], con["bloccato"]["ml"])

    def test_allarmi_fissi_sopravvivono_al_riavvio(self):
        c = ControlloIdro()
        c.passo({"s": 0, "perdita": True})
        c2 = ControlloIdro(s_avvio=100, memoria=c.memoria())
        r = c2.passo({"s": 100, "livello_min": True, "ph": 6.0, "ec": 1.2})
        self.assertIn("PERDITA", r["allarmi"])
        self.assertFalse(r["pompa"])
        c2.passo({"s": 160, "reset": True})
        self.assertNotIn("PERDITA", c2.fissi)


if __name__ == "__main__":
    unittest.main()
