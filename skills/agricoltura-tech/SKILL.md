---
name: agricoltura-tech
description: Guida chi parte da zero competenze, zero conoscenze e zero soldi a costruire passo passo un orto o una piccola azienda agricola tecnologica - colture a costo zero, compost, registro, poi il sistema di controllo e gestione (irrigazione a zone con ESP32, sensori, cisterna, allarmi) prima simulato e collaudato in virtuale e solo dopo comprato e montato, banco e campo, dati e avvisi sul telefono. Usalo quando l utente vuole iniziare a coltivare, automatizzare l irrigazione, simulare o collaudare l impianto, scegliere e comprare sensori e microcontrollori, o fare agricoltura "smart" con poco budget.
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
Due percorsi nella radice del repository: `README.md` (orto da zero: colture, compost, primi guadagni) e `PIANO.md`
(sistema di controllo: virtuale → banco → campo, con i cancelli di `COLLAUDO.md`). Non saltare fasi: **nessun acquisto
prima del cancello 3** (test automatici e prove Wokwi superati), poi un pezzo alla volta.
1. Orto: proponi le colture con `python3 strumenti/orto_sim.py piano --mese N --spazio ...` e fai partire compost e
   registro (`orto_sim.py registro`).
2. Sistema: fai compilare la scheda requisiti della fase 1 di `PIANO.md`, poi simula le zone dell'utente con
   `python3 -m sistema.simula tutti --zone '[...]' --portata N` e `... normale --rapporto rapporto.html`. Se ci sono ore
   di sofferenza, ristagno o falsi allarmi, regola `--parametri` (vedi `PARAMETRI_DEFAULT` in `sistema/controllo.py`)
   o il dimensionamento (cisterna, portata) e riprova; i valori scelti vanno in `firmware/esp32-irrigazione/config.py`.
   Per meteo estremo, corrente e allagamenti usa gli scenari dedicati e `python3 -m sistema.soluzioni` (riscrive
   `SOLUZIONI.md`); con il meteo vero della zona: `strumenti/scarica_meteo.py` e `--meteo`. Proponi le soluzioni con
   i numeri del confronto (senza / con) e il costo, in ordine di priorità.
3. Modifiche alla logica solo in `sistema/controllo.py` (compatibile MicroPython: niente f-string, dataclass, typing),
   con un test in `test/` per ogni nuova regola o guasto; poi `python3 -m unittest discover -s test -t .` deve dare OK.
4. Hardware: segui `firmware/esp32-irrigazione/LEGGIMI.md` e le prove W, B, C, G di `COLLAUDO.md`; aiuta con taratura
   dei sensori e lettura dei messaggi del monitor seriale.
5. A ogni fase controlla il registro (`orto_sim.py registro riepilogo`): la spesa successiva si fa con il margine
   accumulato.
6. Se l'utente conosce i PLC, proponi la stessa logica su LOGO! con la skill `plc-logo-programmazione` e
   `strumenti/logo_sim.py` del repository `agenti-automazione`.

## Sicurezza e limiti
- Solo bassa tensione (5-12 V) senza tecnico; 230 V, pompe di rete e quadri solo con un elettricista.
- Pompa sempre con tempo massimo e controllo del sensore guasto.
- Vendita di prodotti, trattamenti fitosanitari e bandi di finanziamento: indica le regole generali e manda a
  verificare con Comune, regione, CAA o associazione di categoria; non inventare importi o scadenze di bandi.
- I valori del simulatore sono didattici: vanno confermati osservando le piante.
