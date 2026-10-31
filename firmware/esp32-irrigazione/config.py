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

# Facoltativi (None se non ci sono). Vedi SOLUZIONI.md per a cosa servono.
PIN_FLUSSIMETRO = None        # es. 19: flussimetro a turbina YF-S201 dopo la pompa (perdite, pompa che non eroga)
IMPULSI_PER_LITRO = 450       # YF-S201: circa 450 impulsi per litro; tarare con un secchio (prova B12)
PIN_PIOGGIA = None            # es. 23: modulo sensore di pioggia (uscita digitale). Serve al controllo "acqua inattesa"
PIOGGIA_ATTIVO_BASSO = True   # il modulo porta l'uscita a 0 quando è bagnato
PIN_ALLAGAMENTO = 33          # sonda d'acqua sul fondo del quadro verso GND (non collegata = nessun allarme)
PIN_BATTERIA = None           # es. 39: tensione batteria con partitore (solo impianti a pannello solare)
PARTITORE_BATTERIA = 5.0      # rapporto del partitore (es. 40 kΩ + 10 kΩ = 5)
BATTERIA_V_VUOTA = 11.8       # piombo 12 V: 11,8 V circa scarica...
BATTERIA_V_PIENA = 12.7       # ...12,7 V carica
FILE_MEMORIA = "stato.json"   # blocchi e riavvii salvati nella memoria dell'ESP32

SECONDI_PER_MINUTO = 60       # 60 sul campo; 1 su Wokwi per vedere un'ora in un minuto

# Parametri del controllore (vedi PARAMETRI_DEFAULT in controllo.py). Tarare adc_secco/adc_bagnato per OGNI sensore:
# lettura in aria e in un bicchiere d'acqua, con il comando "taratura" descritto in LEGGIMI.md.
PARAMETRI = {
    "adc_secco": 3000,
    "adc_bagnato": 1300,
    "portata_nominale_l_min": 1.0,   # con il flussimetro: L/min misurati sul banco (prova B12)
    "riserva_l": 300.0,              # con il sensore di livello: sotto questi litri soglie di risparmio
    "livello_pieno_l": 998.0,        # con il sensore di livello: litri a cisterna piena meno 2 (al troppo pieno la
                                     # pioggia rimpiazza quello che la pompa toglie e la verifica della pompa non vale)
    # Con portate basse (goccia) tarare al collaudo: dopo 10 minuti di irrigazione l'umidità sale di X e la cisterna
    # scende di Y litri in 8 minuti; mettere circa il 40% di questi valori (il gemello li calcola da solo).
    # "aumento_minimo": 0.01,
    # "calo_minimo_l": 0.6,
}
