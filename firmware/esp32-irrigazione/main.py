# Irrigazione automatica per ESP32 in MicroPython – fase 3 del percorso (vedi README.md).
# Stessa logica di strumenti/orto_sim.py (classe Controllo): prima prova lì, poi su Wokwi (gratis, online), poi sul banco.
#
# Collegamenti (ESP32 DevKit):
#   sensore di umidità CAPACITIVO v1.2/v2.0: VCC -> 3V3, GND -> GND, AOUT -> GPIO34
#   modulo relè 1 canale (o MOSFET) per la pompa 5 V: IN -> GPIO26; la pompa ha la SUA alimentazione, mai dal pin
# Taratura: leggi il valore con il sensore in aria (ADC_SECCO) e immerso in un bicchiere d'acqua (ADC_BAGNATO).
# Sicurezza: solo bassa tensione (5-12 V). Niente 230 V senza un elettricista e un quadro a norma.

from machine import ADC, Pin, WDT
import time

ADC_SECCO = 3000        # DA TARARE: lettura con il sensore in aria
ADC_BAGNATO = 1300      # DA TARARE: lettura con il sensore in acqua
SOGLIA_ON = 0.45        # accende sotto il 45% di umidità
SOGLIA_OFF = 0.70       # spegne sopra il 70% (isteresi: niente accendi/spegni continuo)
MAX_MIN = 10            # tempo massimo di pompa per ciclo (protegge da sensore staccato o tubo rotto)
PAUSA_MIN = 60          # minuti minimi tra due irrigazioni (l'acqua deve scendere fino al sensore)
RELE_ATTIVO_BASSO = True  # molti moduli relè si attivano con il pin a 0

sensore = ADC(Pin(34))
sensore.atten(ADC.ATTN_11DB)
rele = Pin(26, Pin.OUT)


def pompa(accesa):
    rele.value((not accesa) if RELE_ATTIVO_BASSO else accesa)


def umidita():
    # media di 10 letture per ridurre il rumore; 0 = secco, 1 = bagnato
    v = sum(sensore.read() for _ in range(10)) / 10
    u = (ADC_SECCO - v) / (ADC_SECCO - ADC_BAGNATO)
    return min(max(u, 0.0), 1.0), v


pompa(False)            # all'accensione la pompa è sempre spenta
wdt = WDT(timeout=120000)   # se il programma si blocca l'ESP32 riparte (e la pompa si spegne)
acceso, min_acceso, min_da_ultimo = False, 0, PAUSA_MIN

while True:
    u, grezzo = umidita()
    guasto = grezzo < 200 or grezzo > 4000          # sensore staccato o in corto: non irrigare
    min_da_ultimo += 1
    if acceso:
        min_acceso += 1
        if guasto or u >= SOGLIA_OFF or min_acceso >= MAX_MIN:
            acceso, min_da_ultimo = False, 0
    elif not guasto and u < SOGLIA_ON and min_da_ultimo >= PAUSA_MIN:
        acceso, min_acceso = True, 0
    pompa(acceso)
    print("umidita %.0f%%  adc %d  pompa %s%s" % (u * 100, grezzo, "ON" if acceso else "off", "  GUASTO SENSORE" if guasto else ""))
    wdt.feed()
    time.sleep(60)
