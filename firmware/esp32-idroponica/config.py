# Configurazione del firmware idroponico per ESP32. Si cambia solo questo file, mai idro_controllo.py sul campo.
# I parametri si provano PRIMA nel simulatore: python3 -m unittest test.test_idro_controllo (e sistema/idro_modello.py).

# Sonde pH ed EC: meglio tramite ADS1115 (I2C, 16 bit, ingressi isolati dal rumore dell'ESP32) -> ("ads", canale).
# In alternativa un pin ADC1 dell'ESP32 (32-39) -> ("pin", 34): meno preciso, va bene per provare.
SONDA_PH = ("ads", 0)
SONDA_EC = ("ads", 1)
I2C_SDA, I2C_SCL = 21, 22
ADS_INDIRIZZO = 0x48
# Taratura (vedi LEGGIMI.md): tensioni lette nelle soluzioni di taratura
PH_V7 = 1.50                  # volt nella soluzione pH 7,00
PH_V4 = 2.03                  # volt nella soluzione pH 4,00
EC_V_1413 = 1.10              # volt nella soluzione 1413 µS/cm (1,413 mS/cm) a 25 °C
EC_COEFF_T = 0.02             # compensazione 2% per °C verso 25 °C

PIN_DS18B20 = 4               # temperatura dell'acqua (1-Wire, resistenza 4,7 kΩ verso 3,3 V); None se non c'è
PIN_SHT31 = True              # temperatura e umidità dell'aria sullo stesso I2C (indirizzo 0x44); False se non c'è
PIN_LIVELLO_MIN = 14          # galleggiante di minimo verso GND
LIVELLO_MIN_CHIUSO_E_ACQUA = True    # contatto chiuso = acqua sopra il minimo
PIN_LIVELLO_MAX = 27          # galleggiante di massimo verso GND
LIVELLO_MAX_CHIUSO_E_PIENO = True
PIN_PERDITA = 33              # sensore di perdita a pavimento verso GND (bagnato = 0)
PIN_FLUSSIMETRO = 19          # flussimetro sul ritorno (None se non c'è)
IMPULSI_PER_LITRO = 450
PIN_PULSANTE_RESET = 13
# Pulsante di arresto a fungo, contatto NORMALMENTE CHIUSO verso GND: premuto o filo tagliato = arresto (sicuro per
# guasto). Lo stesso fungo, con un secondo contatto, apre fisicamente i 12 V dei dosatori (vedi LEGGIMI.md).
PIN_ARRESTO = 32

# Uscite a bassa tensione (MOSFET o relè a 12 V): attive alte
PIN_POMPA = 26
PIN_DOSA_A, PIN_DOSA_B, PIN_DOSA_PH = 16, 17, 18
PIN_RABBOCCO = 25             # elettrovalvola 12 V o pompa di rabbocco
PIN_ABILITA_DOSATORI = 23     # relè in serie all'alimentazione di TUTTI i dosatori: chiuso solo durante una dosa
ML_AL_SECONDO = {"a": 1.5, "b": 1.5, "ph": 0.5}   # portata delle peristaltiche, misurata con un cilindro graduato
                              # (pH-: pompa piccola e acido diluito 1:10, così un guasto fa pochi danni)
MAX_SECONDI_DOSE = 20         # limite hardware indipendente dalla logica: nessuna dose dura di più

# Carichi a 230 V SOLO tramite prese smart certificate (es. Shelly, API locale), mai relè fai da te.
# Imposta anche nella presa un orario di riserva per le luci: se l'ESP32 si ferma, le luci continuano a orario.
PRESE = {
    "luci": None,             # es. "http://192.168.1.50/relay/0?turn="
    "estrattore": None,
    "stufetta": None,
}
WIFI_SSID = None              # None = niente rete: il controllo lavora uguale, solo senza prese smart e avvisi
WIFI_PASSWORD = ""

# MQTT verso Home Assistant (broker Mosquitto in casa). None = niente MQTT. Dalla rete arrivano SOLO due comandi:
# reset degli allarmi e lettura della penna; pompe e dosatori non si comandano da fuori.
MQTT_BROKER = None            # es. "192.168.1.10"
MQTT_UTENTE = ""
MQTT_PASSWORD = ""
MQTT_BASE = "agritech/idro"

FILE_MEMORIA = "stato_idro.json"
FILE_PENNA = "penna.json"     # lettura della penna pH inserita a mano: main.penna(6.1)
SECONDI_PER_PASSO = 60
FUSO_ORARIO_H = 1             # Italia: 1 d'inverno, 2 con l'ora legale (l'orario delle luci è in ora locale)

PARAMETRI = {
    "modo": "ombra",          # si parte in ombra: una settimana a guardare cosa farebbe, poi "reale"
    "conferma_reale": False,  # per comandare davvero servono modo "reale", questo a True, collaudo e taratura
    "dosaggio_abilitato": False,   # primo impianto: dosi a mano, il controllo propone; True solo dopo il collaudo
    "taratura_ph_giorno": None,    # giorno della taratura (secondi da quando l'ESP32 conta ÷ 86400): main.tarato()
    "collaudo": {                  # mettere True solo dopo aver FATTO la prova (COLLAUDO_DOSAGGIO.md)
        "portata_dosatori_misurata": False, "settimana_in_ombra": False, "prova_perdita": False, "prova_galleggianti": False,
        "prova_flusso": False, "prova_blackout": False, "taglio_hardware_provato": False, "arresto_emergenza_provato": False,
    },
    "volume_l": 120,
    "ph_obiettivo": 5.9,
    "ec_obiettivo": 1.2,
}
