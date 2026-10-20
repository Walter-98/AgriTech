# Configurazione dell'impianto per il firmware ESP32. Si cambia solo questo file, mai controllo.py sul campo.
# I valori dei parametri si decidono PRIMA nel simulatore (python3 -m sistema.simula ... --parametri '{...}').

PIN_SENSORI = [34, 35]        # uscita analogica dei sensori di umidità capacitivi, una per zona (solo pin ADC1: 32-39)
PIN_VALVOLE = [25, 27]        # relè delle elettrovalvole, una per zona
PIN_POMPA = 26                # relè della pompa
RELE_ATTIVO_BASSO = True      # molti moduli relè si eccitano con il pin a 0
PIN_GALLEGGIANTE = 14         # galleggiante di minimo verso GND: contatto chiuso = acqua sotto il minimo
GALLEGGIANTE_CHIUSO_E_BASSO = True
PIN_PULSANTE_RESET = 13       # pulsante verso GND per il reset degli allarmi bloccanti (None se non c'è)
PIN_DHT22 = 4                 # temperatura/umidità aria (None se non c'è)

# Sensore di livello a ultrasuoni (JSN-SR04T impermeabile o HC-SR04) sopra la cisterna (None se non c'è)
PIN_TRIG = 5
PIN_ECHO = 18
CISTERNA_ALTEZZA_CM = 100.0   # distanza sensore-fondo con cisterna vuota
CISTERNA_PIENA_CM = 20.0      # distanza sensore-acqua con cisterna piena
CISTERNA_LITRI = 1000.0

SECONDI_PER_MINUTO = 60       # 60 sul campo; 1 su Wokwi per vedere un'ora in un minuto

# Parametri del controllore (vedi PARAMETRI_DEFAULT in controllo.py). Tarare adc_secco/adc_bagnato per OGNI sensore:
# lettura in aria e in un bicchiere d'acqua, con il comando "taratura" descritto in LEGGIMI.md.
PARAMETRI = {
    "adc_secco": 3000,
    "adc_bagnato": 1300,
}
