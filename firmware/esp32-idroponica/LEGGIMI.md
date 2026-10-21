# Firmware idroponico per ESP32

Legge le sonde (pH, EC, temperatura dell'acqua, aria), i galleggianti, il sensore di perdita e il flussimetro.
Chiama la logica di controllo `sistema/idro_controllo.py`, la stessa provata nel simulatore e nei test. Comanda
pompa, dosatori, rabbocco e le prese smart di luci e clima.

## Prima di collegare qualcosa
1. Prova la logica sul PC: `python3 -m unittest test.test_idro_controllo test.test_firmware_idro`. I test
   provano 12 scenari: sonda che deriva, sonda bloccata, flacone vuoto, perdita, pompa guasta, blackout, acqua calda.
2. Lascia `"modo": "ombra"` in `config.py` per almeno una settimana. In ombra l'ESP32 **non comanda niente**: legge,
   decide e stampa cosa farebbe (la chiave `proposti`). In questa fase pompa e luci vanno su una presa con timer
   propria.
3. Solo quando le proposte sono quelle che faresti tu: `"modo": "reale"` **e** `"conferma_reale": True`.

## File da copiare sull'ESP32
`main.py`, `config.py` e `sistema/idro_controllo.py` (nella radice dell'ESP32, con Thonny o `mpremote cp`).

## Collegamenti (bassa tensione)
| Cosa | Pin | Note |
|---|---|---|
| ADS1115 (pH su A0, EC su A1) | SDA 21, SCL 22 | indirizzo 0x48; schede pH ed EC alimentate a 3,3 o 5 V secondo modello |
| Sensore aria SHT31 | stesso I2C | indirizzo 0x44 |
| Temperatura acqua DS18B20 | 4 | 1-Wire, resistenza 4,7 kΩ tra dato e 3,3 V |
| Galleggiante minimo | 14 | verso GND, contatto chiuso = acqua sopra il minimo |
| Galleggiante massimo | 27 | verso GND, contatto chiuso = pieno |
| Sensore di perdita a pavimento | 33 | verso GND, bagnato = 0 |
| Flussimetro YF-S201 sul ritorno | 19 | 450 impulsi/L, da tarare con un secchio |
| Pulsante di reset | 13 | verso GND |
| Pompa 12 V | 26 | MOSFET logico (IRLZ44N) con diodo sul carico |
| Dosatori A, B, pH- (peristaltiche 12 V) | 16, 17, 18 | MOSFET con diodo; portata misurata con un cilindro graduato → `ML_AL_SECONDO` |
| Rabbocco (elettrovalvola 12 V) | 25 | MOSFET con diodo |

**Non tenere accese le sonde pH ed EC nello stesso serbatoio senza isolarle**: si disturbano. Usa schede isolate
o un isolatore di alimentazione sulla scheda EC.

**Carichi a 230 V** (luci, estrattore, stufetta) solo con **prese smart certificate**, comandate via rete locale. Per
le Shelly: `http://IP/relay/0?turn=`. Imposta nella presa anche un **orario di riserva** per le luci: se l'ESP32 o la
rete si fermano, le luci continuano a orario. Mai relè fai da te a 230 V.

## Taratura delle sonde
1. **pH**:
   - sonda nella soluzione pH 7,00, `import main; main.taratura()`, e il valore dei volt va in `PH_V7`;
   - sciacqua, poi soluzione pH 4,00, e il valore va in `PH_V4`;
   - ripeti ogni 30 giorni; sonda nuova ogni 12-18 mesi.
2. **EC**: soluzione 1413 µS/cm a 25 °C, e il valore dei volt va in `EC_V_1413`. La compensazione di temperatura
   (2% per °C) usa la DS18B20.
3. **Ogni settimana** misura con la penna pH tarata e scrivi `main.penna(6.1)`. Se sonda e penna differiscono di più
   di 0,3, il dosaggio del pH si blocca (`SONDA_PH_DA_TARARE`) finché non tari. È l'unica difesa contro la sonda che
   deriva piano: senza la penna, il limite giornaliero di pH- impedisce comunque il disastro (vedi test).

## Sicurezze
Sono in `idro_controllo.py`, valgono anche senza rete. In più, nel firmware:
- **all'accensione** tutte le uscite sono spente;
- **ogni dose dura al massimo `MAX_SECONDI_DOSE`**, qualunque cosa chieda la logica: è un limite hardware
  indipendente;
- **la memoria** (allarmi bloccanti e dosi del giorno) è salvata su file prima di ogni dose: un riavvio non azzera i
  limiti giornalieri;
- **watchdog**: se il programma si blocca, l'ESP32 riparte. Dopo il riavvio niente dosi per 15 minuti.

## Cosa non è ancora provato
Il firmware è provato sul PC con hardware finto (`test/test_firmware_idro.py`), non su una scheda vera. Prima del
modo reale servono le prove a banco del [COLLAUDO](../../COLLAUDO.md): sonde nelle soluzioni di taratura, dosatori con
il cilindro graduato, galleggianti a mano, sensore di perdita con un panno bagnato.
