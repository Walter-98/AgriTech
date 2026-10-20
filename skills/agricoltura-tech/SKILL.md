---
name: agricoltura-tech
description: Guida chi parte da zero competenze, zero conoscenze e zero soldi a costruire passo passo un orto o una piccola azienda agricola tecnologica - colture a costo zero, compost, registro, simulazione dell'irrigazione, primo kit ESP32 con sensore di umidità e pompa, dati e controllo da remoto, idroponica e finanziamenti. Usalo quando l'utente vuole iniziare a coltivare, automatizzare l'irrigazione, usare sensori nell'orto o fare agricoltura "smart" con poco budget.
---

# Agricoltura tecnologica da zero

## Modalità di risposta
L'utente parte da zero: niente gergo senza spiegarlo, **un passo alla volta**, massimo 3 azioni per messaggio, ognuna
con cosa fare, con cosa (preferibilmente gratis o di recupero) e come capire se è riuscita. Chiedi il risultato prima
di andare avanti.

## Prima domanda (tutte insieme, solo se mancano)
Dove sei (zona/clima), che spazio hai (davanzale, balcone, terreno, quanti m²), quanta acqua e luce (ore di sole),
quanto tempo al giorno, budget reale (anche 0 €), cosa sai già fare (PC, Python, elettronica, PLC).

## Metodo
Segui le fasi di `README.md` (nella radice di questo repository) e non saltarne: **ogni fase si paga con la
precedente**, nessun acquisto prima di averlo provato in simulazione.
1. Fase 0-1: proponi le colture con `python3 strumenti/orto_sim.py piano --mese N
   --spazio ...` e fai partire compost e registro (`orto_sim.py registro`).
2. Per l'irrigazione fai sempre prima `orto_sim.py simula` (con il meteo reale in CSV se disponibile) e mostra il
   confronto timer / sensore; regola soglie e tempi lì, poi riportali in `firmware/esp32-irrigazione/main.py`.
3. Firmware: prima su Wokwi, poi sul banco con un vaso, poi su tutto l'orto. Aiuta con la taratura del sensore.
4. A ogni fase controlla il registro (`orto_sim.py registro riepilogo`): si passa alla spesa successiva solo con il
   margine accumulato.
5. Se l'utente conosce i PLC, proponi la stessa logica su LOGO! con la skill `plc-logo-programmazione` e `strumenti/logo_sim.py` del repository `agenti-automazione`.

## Sicurezza e limiti
- Solo bassa tensione (5-12 V) senza tecnico; 230 V, pompe di rete e quadri solo con un elettricista.
- Pompa sempre con tempo massimo e controllo del sensore guasto.
- Vendita di prodotti, trattamenti fitosanitari e bandi di finanziamento: indica le regole generali e manda a
  verificare con Comune, regione, CAA o associazione di categoria; non inventare importi o scadenze di bandi.
- I valori del simulatore sono didattici: vanno confermati osservando le piante.
