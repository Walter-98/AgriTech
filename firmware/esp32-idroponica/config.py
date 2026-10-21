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

# Uscite a bassa tensione (MOSFET o relè a 12 V): attive alte
PIN_POMPA = 26
PIN_DOSA_A, PIN_DOSA_B, PIN_DOSA_PH = 16, 17, 18
PIN_RABBOCCO = 25             # elettrovalvola 12 V o pompa di rabbocco
ML_AL_SECONDO = {"a": 1.5, "b": 1.5, "ph": 1.5}   # portata delle peristaltiche, misurata con un cilindro graduato
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

FILE_MEMORIA = "stato_idro.json"
FILE_PENNA = "penna.json"     # lettura della penna pH inserita a mano: main.penna(6.1)
SECONDI_PER_PASSO = 60

PARAMETRI = {
    "modo": "ombra",          # si parte in ombra: una settimana a guardare cosa farebbe, poi "reale"
    "conferma_reale": False,  # per comandare davvero servono modo "reale" E questo a True
    "volume_l": 120,
    "ph_obiettivo": 5.9,
    "ec_obiettivo": 1.2,
}
