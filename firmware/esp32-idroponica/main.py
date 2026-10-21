# Firmware idroponico AgriTech per ESP32 (MicroPython): legge sonde e sensori, chiama la logica di controllo
# (sistema/idro_controllo.py, la stessa provata nel simulatore), comanda pompa, dosatori, rabbocco e prese smart.
# Sull'ESP32 vanno copiati 3 file: questo main.py, config.py e sistema/idro_controllo.py (vedi LEGGIMI.md).
# Sicurezza: qui solo bassa tensione (12 V). I carichi a 230 V passano da prese smart certificate.

import json
import os
import time
from machine import ADC, I2C, Pin, WDT

import config
from idro_controllo import ControlloIdro


def crea_hw():
    hw = {}
    # le uscite per prime, spente: all'accensione nessuna pompa e nessun dosatore
    for nome in ("pompa", "dosa_a", "dosa_b", "dosa_ph", "rabbocco"):
        hw[nome] = Pin(getattr(config, "PIN_" + nome.upper()), Pin.OUT, value=0)
    hw["i2c"] = I2C(0, sda=Pin(config.I2C_SDA), scl=Pin(config.I2C_SCL)) if (config.SONDA_PH[0] == "ads" or config.PIN_SHT31) else None
    hw["adc"] = {}
    for nome, sonda in (("ph", config.SONDA_PH), ("ec", config.SONDA_EC)):
        if sonda[0] == "pin":
            a = ADC(Pin(sonda[1]))
            a.atten(ADC.ATTN_11DB)
            hw["adc"][nome] = a
    hw["ds"] = None
    if config.PIN_DS18B20 is not None:
        import onewire
        import ds18x20
        hw["ds"] = ds18x20.DS18X20(onewire.OneWire(Pin(config.PIN_DS18B20)))
        hw["ds_id"] = hw["ds"].scan()
    hw["min"] = Pin(config.PIN_LIVELLO_MIN, Pin.IN, Pin.PULL_UP)
    hw["max"] = Pin(config.PIN_LIVELLO_MAX, Pin.IN, Pin.PULL_UP)
    hw["perdita"] = Pin(config.PIN_PERDITA, Pin.IN, Pin.PULL_UP)
    hw["reset"] = Pin(config.PIN_PULSANTE_RESET, Pin.IN, Pin.PULL_UP) if config.PIN_PULSANTE_RESET is not None else None
    hw["impulsi"] = [0]
    hw["flussimetro"] = None
    if config.PIN_FLUSSIMETRO is not None:
        def conta(_pin):
            hw["impulsi"][0] += 1
        hw["flussimetro"] = Pin(config.PIN_FLUSSIMETRO, Pin.IN, Pin.PULL_UP)
        hw["flussimetro"].irq(trigger=Pin.IRQ_RISING, handler=conta)
    hw["prese"] = {}
    return hw


# ---- ADS1115: conversione singola, ±4,096 V, 128 campioni/s ----
def leggi_ads(i2c, canale):
    mux = 0x4000 + canale * 0x1000
    conf = 0x8000 | mux | 0x0200 | 0x0100 | 0x0080 | 0x0003
    i2c.writeto_mem(config.ADS_INDIRIZZO, 0x01, bytes([conf >> 8, conf & 0xFF]))
    time.sleep_ms(10)
    d = i2c.readfrom_mem(config.ADS_INDIRIZZO, 0x00, 2)
    v = (d[0] << 8) | d[1]
    if v > 32767:
        v -= 65536
    return v * 4.096 / 32768


def volt(hw, nome):
    sonda = config.SONDA_PH if nome == "ph" else config.SONDA_EC
    try:
        if sonda[0] == "ads":
            return sum(leggi_ads(hw["i2c"], sonda[1]) for _ in range(5)) / 5
        return sum(hw["adc"][nome].read() for _ in range(10)) / 10 / 4095 * 3.3
    except OSError:
        return None                                   # scheda staccata: il controllo lo vede come sonda fuori campo


def ph_da_volt(v):
    if v is None:
        return None
    return 7.0 + (v - config.PH_V7) * (4.0 - 7.0) / (config.PH_V4 - config.PH_V7)


def ec_da_volt(v, t_acqua):
    if v is None:
        return None
    ec = v * 1.413 / config.EC_V_1413
    if t_acqua is not None:
        ec = ec / (1 + config.EC_COEFF_T * (t_acqua - 25.0))
    return ec


def leggi_t_acqua(hw):
    if hw["ds"] is None or not hw["ds_id"]:
        return None
    try:
        hw["ds"].convert_temp()
        time.sleep_ms(750)
        return hw["ds"].read_temp(hw["ds_id"][0])
    except Exception:
        return None


def leggi_aria(hw):
    if not config.PIN_SHT31 or hw["i2c"] is None:
        return None, None
    try:
        hw["i2c"].writeto(0x44, bytes([0x24, 0x00]))
        time.sleep_ms(20)
        d = hw["i2c"].readfrom(0x44, 6)
        t = -45 + 175 * ((d[0] << 8) | d[1]) / 65535
        ur = 100 * ((d[3] << 8) | d[4]) / 65535
        return t, ur
    except OSError:
        return None, None


def leggi_flusso(hw):
    if hw["flussimetro"] is None:
        return None
    n, hw["impulsi"][0] = hw["impulsi"][0], 0
    return n / config.IMPULSI_PER_LITRO * 60.0 / config.SECONDI_PER_PASSO


def leggi_penna():
    try:
        with open(config.FILE_PENNA) as f:
            v = json.load(f)
        os.remove(config.FILE_PENNA)                  # una lettura vale una volta
        return v
    except (OSError, ValueError):
        return None


def penna(valore):
    """Da REPL o dall'app: main.penna(6.1) dopo aver misurato con la penna pH tarata."""
    with open(config.FILE_PENNA, "w") as f:
        json.dump(valore, f)


def leggi(hw, s):
    t_acqua = leggi_t_acqua(hw)
    t_aria, ur = leggi_aria(hw)
    chiuso_min, chiuso_max = hw["min"].value() == 0, hw["max"].value() == 0
    return {
        "s": s,
        "ph": ph_da_volt(volt(hw, "ph")),
        "ec": ec_da_volt(volt(hw, "ec"), t_acqua),
        "t_acqua": t_acqua, "t_aria": t_aria, "ur": ur,
        "livello_min": chiuso_min if config.LIVELLO_MIN_CHIUSO_E_ACQUA else not chiuso_min,
        "livello_max": chiuso_max if config.LIVELLO_MAX_CHIUSO_E_PIENO else not chiuso_max,
        "perdita": hw["perdita"].value() == 0,
        "flusso_l_min": leggi_flusso(hw),
        "ph_penna": leggi_penna(),
        "reset": hw["reset"] is not None and hw["reset"].value() == 0,
    }


def dosa(hw, nome, ml, wdt=None):
    if ml <= 0:
        return 0.0
    secondi = min(ml / config.ML_AL_SECONDO[nome], config.MAX_SECONDI_DOSE)
    pin = hw["dosa_" + nome]
    pin.value(1)
    try:
        time.sleep(secondi)
    finally:
        pin.value(0)                                  # il dosatore si spegne anche se qualcosa va storto
    if wdt is not None:
        wdt.feed()
    return secondi * config.ML_AL_SECONDO[nome]


def presa(hw, nome, acceso):
    url = config.PRESE.get(nome)
    if not url or hw["prese"].get(nome) == acceso:
        return
    try:
        import urequests
        urequests.get(url + ("on" if acceso else "off")).close()
        hw["prese"][nome] = acceso
    except Exception:
        pass                                          # rete giù: si riprova al passo dopo, la presa ha l'orario di riserva


def scrivi(hw, c, wdt=None):
    # in ombra l'ESP32 non comanda niente: pompa e luci vanno collegate a presa/timer propri (LEGGIMI.md)
    if c["modo"] == "ombra":
        for nome in ("pompa", "dosa_a", "dosa_b", "dosa_ph", "rabbocco"):
            hw[nome].value(0)
        return {"a": 0.0, "b": 0.0, "ph": 0.0}
    # prima le uscite di sicurezza (spegnere), poi le accensioni; le dosi una alla volta
    hw["pompa"].value(1 if c["pompa"] else 0)
    hw["rabbocco"].value(1 if c["rabbocco"] else 0)
    fatti = {}
    for nome, chiave in (("a", "dose_a_ml"), ("b", "dose_b_ml"), ("ph", "dose_ph_ml")):
        fatti[nome] = dosa(hw, nome, c[chiave], wdt)
    for nome in ("luci", "estrattore", "stufetta"):
        presa(hw, nome, c[nome])
    return fatti


def carica_memoria():
    try:
        with open(config.FILE_MEMORIA) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def salva_memoria(dati):
    tmp = config.FILE_MEMORIA + ".tmp"
    try:
        with open(tmp, "w") as f:
            json.dump(dati, f)
        os.rename(tmp, config.FILE_MEMORIA)
    except OSError:
        pass


def riga(s, l, c):
    def f(v, fmt):
        return "--" if v is None else fmt % v
    return "s %d  pH %s  EC %s  acqua %s  aria %s  pompa %s  dosi %s/%s/%s  modo %s  allarmi %s" % (
        s, f(l["ph"], "%.2f"), f(l["ec"], "%.2f"), f(l["t_acqua"], "%.1fC"), f(l["t_aria"], "%.1fC"),
        "ON" if c["pompa"] else "off", c["dose_a_ml"], c["dose_b_ml"], c["dose_ph_ml"], c["modo"], ",".join(c["allarmi"]) or "-")


def collega_wifi():
    if not config.WIFI_SSID:
        return
    try:
        import network
        w = network.WLAN(network.STA_IF)
        w.active(True)
        w.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
    except Exception:
        pass


def taratura(secondi=20):
    """Da REPL: import main; main.taratura() con la sonda nella soluzione: stampa i volt per PH_V7, PH_V4, EC_V_1413."""
    hw = crea_hw()
    for _ in range(secondi):
        print("pH volt %.3f   EC volt %.3f" % (volt(hw, "ph") or 0, volt(hw, "ec") or 0))
        time.sleep(1)


def avvia():
    hw = crea_hw()
    collega_wifi()
    ctrl = ControlloIdro(config.PARAMETRI, s_avvio=0, memoria=carica_memoria())
    wdt = WDT(timeout=max(120000, (config.SECONDI_PER_PASSO + config.MAX_SECONDI_DOSE * 3) * 2000))
    s = 0
    while True:
        l = leggi(hw, s)
        c = ctrl.passo(l)
        salva_memoria(ctrl.memoria())                 # prima di dosare: le dosi del giorno sopravvivono al riavvio
        scrivi(hw, c, wdt)
        print(riga(s, l, c))
        wdt.feed()
        time.sleep(config.SECONDI_PER_PASSO)
        s += config.SECONDI_PER_PASSO


if __name__ == "__main__":
    avvia()
