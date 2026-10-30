"""Nucleo fisico condiviso tra il simulatore Python e il gemello nel browser (gemello/sim.js, funzione etGiorno).

Bilancio dell'acqua nel terreno durante un giorno senza pioggia né irrigazione:
    du/dt = -r * min(1, u / 0.5),  con r = et0 * kc / capacità  (frazione di capacità al giorno)
La pianta beve a pieno ritmo finché l'umidità u è sopra il 50%, poi in proporzione (terreno secco: beve meno).
Soluzione esatta: lineare fino a u = 0,5, poi esponenziale. Le due implementazioni (Python e JavaScript) devono dare
gli stessi numeri sui casi di test/contratti/bilancio_idrico.json, rigenerati con:
    python3 -m sistema.nucleo > test/contratti/bilancio_idrico.json
"""
import json
import math


def et_giorno(u, et0, kc, capacita):
    """-> (umidità a fine giorno, mm evapotraspirati). u in 0..1, et0 mm/giorno, capacità mm."""
    if capacita <= 0 or et0 <= 0 or kc <= 0 or u <= 0:
        return max(u, 0.0), 0.0
    r = et0 * kc / capacita
    if u >= 0.5:
        t1 = (u - 0.5) / r
        fine = u - r if t1 >= 1 else 0.5 * math.exp(-(r / 0.5) * (1 - t1))
    else:
        fine = u * math.exp(-2 * r)
    return fine, (u - fine) * capacita


CASI = [(u, et0, kc, cap) for u in (1.0, 0.8, 0.55, 0.5, 0.3, 0.05) for et0 in (0.5, 3.0, 6.5) for kc in (0.25, 1.0, 1.15) for cap in (30.0, 60.0)]


def contratto():
    return [{"u": u, "et0": et0, "kc": kc, "capacita": cap, "u_fine": et_giorno(u, et0, kc, cap)[0], "et_mm": et_giorno(u, et0, kc, cap)[1]}
            for (u, et0, kc, cap) in CASI]


if __name__ == "__main__":
    print(json.dumps({"descrizione": "Casi di riferimento del bilancio idrico giornaliero (sistema/nucleo.py)", "casi": contratto()}, indent=1))
