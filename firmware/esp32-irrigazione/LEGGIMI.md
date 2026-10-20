# Firmware ESP32 – irrigazione a zone

File da mettere sull'ESP32 (MicroPython 1.20 o più recente):

| Sul PC | Sull'ESP32 |
|---|---|
| `firmware/esp32-irrigazione/main.py` | `main.py` |
| `firmware/esp32-irrigazione/config.py` | `config.py` |
| `sistema/controllo.py` | `controllo.py` |

`controllo.py` **non si copia a mano né si modifica sull'ESP32**: è la stessa logica provata nel simulatore e nei
test. Le modifiche si fanno nel repository, si rilanciano i test, poi si ricopia.

## 1. Prova su Wokwi (gratis, senza hardware)
1. Apri wokwi.com e crea un nuovo progetto **MicroPython on ESP32**.
2. Nella scheda `diagram.json` incolla il contenuto di `diagram.json` di questa cartella.
3. Crea i file `main.py`, `config.py` e `controllo.py` e incolla i contenuti (tabella sopra).
4. In `config.py` metti `SECONDI_PER_MINUTO = 1`: un minuto di impianto diventa un secondo.
5. Avvia. Cosa c'è nello schema virtuale:
   - 2 potenziometri = sensori di umidità (zona 1 su GPIO34, zona 2 su GPIO35). Girati verso un estremo
     simulano un sensore staccato o in corto;
   - LED blu = pompa, LED verdi = valvole (accesi = relè eccitato);
   - interruttore a slitta = galleggiante della cisterna (chiuso = acqua al minimo);
   - pulsante rosso = reset degli allarmi bloccanti;
   - DHT22 = temperatura aria (cliccalo per cambiarla); HC-SR04 = livello cisterna (cliccalo per cambiare la distanza);
   - interruttore "pioggia" su GPIO23 (attivo solo con `PIN_PIOGGIA = 23` in `config.py`) e interruttore "acqua nel
     quadro" su GPIO33 (chiuso = acqua sul fondo del quadro).
6. Esegui le prove W1–W11 di `COLLAUDO.md` e segna l'esito.

Il file `stato.json` lo crea il firmware da solo: è la memoria che fa sopravvivere blocchi e conteggio dei riavvii
alle mancanze di corrente. Per ripartire da zero cancellalo (`mpremote rm :stato.json`) o premi il pulsante di reset
allarmi.

Il file `diagram.json` è stato scritto a mano e non ancora aperto su Wokwi: se un pin o un componente non
corrisponde, correggi il collegamento nell'editor di Wokwi e aggiorna il file nel repository.

## 2. Sull'ESP32 vero (fase 4 del piano)
1. Installa MicroPython sull'ESP32 (firmware ufficiale da micropython.org, con `esptool`).
2. Installa `mpremote` sul PC (`pip install mpremote`) e copia i file:
   ```bash
   mpremote cp sistema/controllo.py :controllo.py
   mpremote cp firmware/esp32-irrigazione/config.py :config.py
   mpremote cp firmware/esp32-irrigazione/main.py :main.py
   ```
3. **Taratura** di ogni sensore: senza pompa collegata, da REPL (`mpremote repl`, poi Ctrl-C per fermare il
   programma) scrivi `import main; main.taratura()`. Annota la lettura con il sensore in aria (`adc_secco`) e
   immerso in un bicchiere d'acqua fino alla riga (`adc_bagnato`). Scrivile in `config.py` → `PARAMETRI`.
4. Riavvia (`mpremote reset`) e guarda le righe stampate ogni minuto con `mpremote repl`.

## Collegamenti
| Funzione | GPIO | Note |
|---|---|---|
| Sensore umidità zona 1 / 2 | 34 / 35 | sensore capacitivo alimentato a 3,3 V; usare solo pin ADC1 (32-39) |
| Pompa | 26 | modulo relè o MOSFET; pompa con alimentatore suo |
| Valvola zona 1 / 2 | 25 / 27 | elettrovalvole 12 V con diodo di ricircolo (o modulo relè che lo ha) |
| Galleggiante di minimo | 14 | contatto verso GND, pull-up interno |
| Pulsante reset allarmi | 13 | verso GND |
| DHT22 | 4 | |
| Sonda acqua nel quadro | 33 | due fili sul fondo del quadro, uno al GPIO e uno a GND: l'acqua li collega |
| Sensore di pioggia (facoltativo) | 23 | uscita digitale del modulo; `PIN_PIOGGIA = 23` |
| Flussimetro YF-S201 (facoltativo) | 19 | uscita impulsi a 5 V: partitore 10 kΩ + 20 kΩ verso l'ESP32; `PIN_FLUSSIMETRO = 19` |
| Tensione batteria (facoltativo) | 39 | partitore 40 kΩ + 10 kΩ dalla batteria 12 V; `PIN_BATTERIA = 39` |
| Ultrasuoni TRIG / ECHO | 5 / 18 | se il sensore è a 5 V, ECHO con partitore (es. 1 kΩ + 2 kΩ) verso l'ESP32 |

## Alimentazione (vedi SOLUZIONI.md, "Calo di tensione")
- Alimentatore 12 V con almeno il 50% di margine sulla corrente della pompa.
- ESP32 dal suo step-down 12→5 V, non dallo stesso 5 V della pompa; condensatore 470-1000 µF sul 5 V vicino all'ESP32.
- Cavi della pompa corti e di sezione adeguata; diodo di ricircolo su pompa ed elettrovalvole.
- Quadro stagno IP65 a 50 cm o più da terra, pressacavi rivolti verso il basso.

Solo bassa tensione (5-12 V). Niente 230 V senza un elettricista e un quadro a norma.
