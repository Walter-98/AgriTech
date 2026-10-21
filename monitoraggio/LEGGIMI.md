# Monitoraggio: vedere l'impianto dal telefono

Tutto gira **in casa**: niente cloud obbligatorio, nessun dispositivo esposto su Internet. Le sicurezze restano
sull'ESP32 e funzionano anche se Home Assistant, il Wi-Fi o Internet sono spenti.

```
ESP32 (firmware AgriTech o ESPHome) ──Wi-Fi──> Home Assistant (Raspberry Pi o vecchio PC) ──app──> telefono
```

## Due strade, una per scheda
| | Firmware AgriTech (`firmware/esp32-idroponica`) | ESPHome (`monitoraggio/esphome/idroponica.yaml`) |
|---|---|---|
| Cosa fa | Controllo completo: dosaggio pH/EC con tutte le sicurezze provate nei test, rabbocco, clima | Solo sorveglianza: misure, perdita e livello che spengono la pompa |
| Dosaggio | Sì (modo ombra, poi reale) | No, di proposito |
| Collegamento a HA | MQTT con auto-scoperta (broker Mosquitto) | API nativa ESPHome |
| Quando | Impianto automatico (proposta C del percorso guidato) | Impianto a mano o primo passo (proposta B) |

La configurazione ESPHome è **validata** con `esphome config` (ESPHome 2026.9). Il firmware è provato con hardware
finto (`test/test_firmware_idro.py`).

## Messa in funzione (circa 2 ore, 0 € se hai un PC o un Raspberry)
1. **Home Assistant**: installa Home Assistant OS su un Raspberry Pi 4/5 o su un vecchio PC (guida ufficiale
   home-assistant.io/installation). Apri `http://homeassistant.local:8123`.
2. **Componenti aggiuntivi**:
   - **Mosquitto broker**, se usi il firmware AgriTech: crea un utente e scrivi broker, utente e password in
     `config.py` (`MQTT_BROKER`, `MQTT_UTENTE`, `MQTT_PASSWORD`);
   - **ESPHome**, se usi la strada ESPHome: incolla `idroponica.yaml` e crea `secrets.yaml` dal file
     `secrets.yaml.example`.
3. **Pacchetto AgriTech**:
   - copia `homeassistant/agritech.yaml` in `/config/packages/`;
   - in `configuration.yaml` aggiungi `homeassistant:` → `packages: !include_dir_named packages`;
   - riavvia Home Assistant.

   Contiene 6 avvisi: perdita, nuovo allarme, pH fuori da 30 minuti, acqua sopra 26 °C da un'ora, flusso assente da 20
   minuti, centralina muta da 15 minuti.
4. **Plancia**: Impostazioni → Plance → nuova → Modifica in YAML → incolla `homeassistant/dashboard.yaml`.
5. **Telefono**: installa l'app Home Assistant e accedi. Gli avvisi arrivano con `notify.notify`.
6. **Fuori casa**: VPN (componente Tailscale o WireGuard) oppure Home Assistant Cloud. **Mai** aprire porte del
   router verso Home Assistant o verso l'ESP32.

Nomi delle entità:
- **firmware AgriTech**: `sensor.agritech_idroponica_ph`, `..._ec`, `..._temperatura_acqua`, `..._allarmi`,
  `binary_sensor.agritech_idroponica_perdita`;
- **ESPHome**: gli stessi più `..._perdita_a_pavimento` e `..._flusso_ritorno`, già previsti negli avvisi.

Se Home Assistant dà nomi diversi, cambiali in Impostazioni → Entità.

## Dalla rete arrivano solo due comandi
Sul topic `agritech/idro/comando` il firmware accetta solo:
- `{"reset": true}`: azzera gli allarmi bloccanti dopo che hai controllato;
- `{"penna": 6.1}`: la lettura della penna pH, per il controllo incrociato con la sonda.

Pompe, dosatori e acido **non si comandano dalla rete**: lo decide solo la logica locale con i suoi limiti.

## Storico e confronto con il gemello
Home Assistant conserva lo storico (per default 10 giorni; aumentalo con `recorder: purge_keep_days: 365`).
`strumenti/storico_ha.py` scarica le medie giornaliere in un CSV. Il CSV si carica nella scheda **Registro** del
gemello, per confrontare le misure vere con quelle simulate.
