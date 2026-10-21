"""Fase 7: configurazioni di monitoraggio (ESPHome, Home Assistant) e riassunto dello storico."""
import os
import unittest

from strumenti.storico_ha import riassumi

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    import yaml
except ImportError:
    yaml = None


def carica_yaml(percorso):
    class L(yaml.SafeLoader):
        pass
    L.add_constructor("!secret", lambda l, n: "segreto")
    with open(os.path.join(RADICE, percorso)) as f:
        return yaml.load(f, Loader=L)


class TestMonitoraggio(unittest.TestCase):
    def test_riassunto_giornaliero_dello_storico(self):
        st = [[{"entity_id": "sensor.agritech_idroponica_ph", "state": "6.0", "last_changed": "2026-10-01T10:00:00"},
               {"entity_id": "sensor.agritech_idroponica_ph", "state": "6.2", "last_changed": "2026-10-01T12:00:00"},
               {"entity_id": "sensor.agritech_idroponica_ph", "state": "unavailable", "last_changed": "2026-10-02T12:00:00"}],
              [{"entity_id": "sensor.agritech_idroponica_temperatura_aria", "state": "18", "last_changed": "2026-10-01T03:00:00"},
               {"state": "24", "last_changed": "2026-10-01T15:00:00"}]]
        r = riassumi(st)
        self.assertEqual(len(r), 1)
        self.assertAlmostEqual(r[0]["ph_medio"], 6.1)
        self.assertEqual((r[0]["t_aria_min"], r[0]["t_aria_max"]), (18.0, 24.0))

    @unittest.skipIf(yaml is None, "PyYAML non installato")
    def test_esphome_sorveglianza_senza_dosaggio_e_con_interblocchi(self):
        d = carica_yaml("monitoraggio/esphome/idroponica.yaml")
        # nessuna uscita sui pin dei dosatori (16, 17, 18) e nessun interruttore di dosaggio
        for sw in d.get("switch", []):
            self.assertNotIn(str(sw.get("pin")), ("GPIO16", "GPIO17", "GPIO18", "16", "17", "18"))
            self.assertNotIn("dos", sw["name"].lower())
        pompa = [s for s in d["switch"] if s["id"] == "pompa"][0]
        self.assertIn("on_turn_on", pompa)
        perdita = [b for b in d["binary_sensor"] if b["id"] == "perdita"][0]
        self.assertEqual(perdita["on_press"]["then"][0], {"switch.turn_off": "pompa"})

    @unittest.skipIf(yaml is None, "PyYAML non installato")
    def test_pacchetto_home_assistant(self):
        d = carica_yaml("monitoraggio/homeassistant/agritech.yaml")
        ids = [a["id"] for a in d["automation"]]
        for atteso in ("agritech_perdita", "agritech_ph_fuori", "agritech_acqua_calda", "agritech_flusso", "agritech_offline"):
            self.assertIn(atteso, ids)
        self.assertEqual(len(set(ids)), len(ids))
        carica_yaml("monitoraggio/homeassistant/dashboard.yaml")


if __name__ == "__main__":
    unittest.main()
