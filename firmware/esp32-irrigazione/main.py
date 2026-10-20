# Firmware AgriTech per ESP32 (MicroPython): legge i sensori, chiama la logica di controllo, comanda pompa e valvole.
# Sull'ESP32 vanno copiati 3 file: questo main.py, config.py e sistema/controllo.py (vedi LEGGIMI.md).
# La logica NON è qui: è in controllo.py, la stessa provata nel simulatore e nei test. Qui c'è solo l'hardware.
# Sicurezza: solo bassa tensione (5-12 V). Pompe e valvole a 230 V solo con un elettricista e un quadro a norma.

import time
from machine import ADC, Pin, WDT, time_pulse_us

import config
from controllo import Controllore


def crea_hw():
    hw = {}
    # prima di tutto le uscite, spente: all'accensione pompa e valvole devono restare chiuse
    spento = 1 if config.RELE_ATTIVO_BASSO else 0
    hw["pompa"] = Pin(config.PIN_POMPA, Pin.OUT, value=spento)
    hw["valvole"] = [Pin(p, Pin.OUT, value=spento) for p in config.PIN_VALVOLE]
    hw["sensori"] = []
    for p in config.PIN_SENSORI:
        a = ADC(Pin(p))
        a.atten(ADC.ATTN_11DB)          # campo 0-3,3 V
        hw["sensori"].append(a)
    hw["galleggiante"] = Pin(config.PIN_GALLEGGIANTE, Pin.IN, Pin.PULL_UP)
    hw["reset"] = Pin(config.PIN_PULSANTE_RESET, Pin.IN, Pin.PULL_UP) if config.PIN_PULSANTE_RESET is not None else None
    hw["dht"] = None
    if config.PIN_DHT22 is not None:
        import dht
        hw["dht"] = dht.DHT22(Pin(config.PIN_DHT22))
    hw["trig"] = Pin(config.PIN_TRIG, Pin.OUT, value=0) if config.PIN_TRIG is not None else None
    hw["echo"] = Pin(config.PIN_ECHO, Pin.IN) if config.PIN_ECHO is not None else None
    return hw


def leggi_adc(sensore):
    return sum(sensore.read() for _ in range(10)) // 10     # media di 10 letture contro il rumore


def leggi_litri(hw):
    if hw["trig"] is None:
        return None
    hw["trig"].value(1)
    time.sleep_us(10)
    hw["trig"].value(0)
    t = time_pulse_us(hw["echo"], 1, 30000)
    if t < 0:
        return None                                       # nessuna eco: sensore guasto o fuori portata
    cm = t / 58.0
    pieno = (config.CISTERNA_ALTEZZA_CM - cm) / (config.CISTERNA_ALTEZZA_CM - config.CISTERNA_PIENA_CM)
    return min(max(pieno, 0.0), 1.0) * config.CISTERNA_LITRI


def leggi_temp(hw):
    if hw["dht"] is None:
        return None
    try:
        hw["dht"].measure()
        return hw["dht"].temperature()
    except OSError:
        return None


def leggi(hw, minuto):
    chiuso = hw["galleggiante"].value() == 0
    return {
        "minuto": minuto,
        "adc": [leggi_adc(s) for s in hw["sensori"]],
        "serbatoio_basso": chiuso if config.GALLEGGIANTE_CHIUSO_E_BASSO else not chiuso,
        "serbatoio_l": leggi_litri(hw),
        "temp_c": leggi_temp(hw),
        "pioggia_prevista_mm": 0.0,      # arriverà dalla centrale (fase 6 del piano)
    }


def scrivi(hw, uscite):
    def rele(pin, acceso):
        pin.value((0 if acceso else 1) if config.RELE_ATTIVO_BASSO else (1 if acceso else 0))
    # prima la valvola, poi la pompa: la pompa non spinge mai contro valvole chiuse
    for pin, aperta in zip(hw["valvole"], uscite["valvole"]):
        rele(pin, aperta)
    rele(hw["pompa"], uscite["pompa"])


def riga(minuto, letture, uscite):
    u = " ".join("--" if x is None else "%d%%" % (x * 100) for x in uscite["umidita"])
    litri = letture["serbatoio_l"]
    return "min %d  umidita %s  adc %s  cisterna %s  temp %s  pompa %s  stato %s  allarmi %s" % (
        minuto, u, letture["adc"], "--" if litri is None else "%dL" % litri,
        "--" if letture["temp_c"] is None else "%.1fC" % letture["temp_c"],
        "ON" if uscite["pompa"] else "off", ",".join(uscite["stato"]), ",".join(uscite["allarmi"]) or "-")


def taratura(secondi=10):
    """Da REPL: import main; main.taratura() -> stampa le letture grezze per adc_secco/adc_bagnato."""
    hw = crea_hw()
    for _ in range(secondi):
        print([leggi_adc(s) for s in hw["sensori"]])
        time.sleep(1)


def avvia():
    hw = crea_hw()
    ctrl = Controllore(len(config.PIN_SENSORI), config.PARAMETRI)
    wdt = WDT(timeout=max(120000, config.SECONDI_PER_MINUTO * 3000))   # se il programma si blocca l'ESP32 riparte
    minuto = 0
    while True:
        if hw["reset"] is not None and hw["reset"].value() == 0:
            ctrl.reset()
        letture = leggi(hw, minuto)
        uscite = ctrl.passo(letture)
        scrivi(hw, uscite)
        print(riga(minuto, letture, uscite))
        wdt.feed()
        time.sleep(config.SECONDI_PER_MINUTO)
        minuto += 1


if __name__ == "__main__":
    avvia()
