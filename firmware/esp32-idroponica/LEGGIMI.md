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
| Fungo di emergenza (contatto NC) | 32 | verso GND: aperto = arresto |
| Relè di abilitazione dei dosatori | 23 | in serie all'alimentazione di tutti i dosatori |
| Pompa 12 V | 26 | MOSFET logico (IRLZ44N) con diodo sul carico |
| Dosatori A, B, pH- (peristaltiche 12 V) | 16, 17, 18 | MOSFET con diodo; portata misurata con un cilindro graduato → `ML_AL_SECONDO` |
| Rabbocco (elettrovalvola 12 V) | 25 | MOSFET con diodo |

**L'orologio**: con il Wi-Fi l'ora si prende da Internet (NTP) e `FUSO_ORARIO_H` la porta all'ora italiana. Senza Wi-Fi l'ESP32 non sa che ore sono: metti l'orario delle luci nella presa smart.

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

## Sicurezze hardware indipendenti dal firmware (obbligatorie prima del modo reale)
Il software può sbagliare, bloccarsi o essere configurato male. Un MOSFET o un relè può restare incollato. Per questo
l'alimentazione a 12 V dei dosatori passa da una **catena di interruttori fisici in serie**, e basta che uno si apra
perché nessun dosatore possa girare:

```
12 V ─ fusibile 2 A ─ fungo di emergenza (contatto NC) ─ galleggiante di minimo (chiuso solo con acqua)
     ─ relè del rilevatore di allagamento (NC, apre con acqua sul pavimento, apparecchio autonomo)
     ─ relè temporizzato monostabile (apre dopo 30 s anche se il comando resta attivo)
     ─ relè di abilitazione (PIN_ABILITA_DOSATORI, chiuso dall'ESP32 solo durante una dose)
     ─ MOSFET del singolo dosatore (A, B, pH-)
```

- **Fungo di emergenza** a due contatti NC: uno apre la catena qui sopra, l'altro va al pin `PIN_ARRESTO`. Con il
  fungo premuto o il filo interrotto, il firmware vede "arresto" e spegne tutto (sicuro per guasto). Se non monti il
  fungo devi scrivere `PIN_ARRESTO = None`.
- **Rilevatore di allagamento con uscita a relè**: un apparecchio autonomo, non il sensore letto dall'ESP32. Funziona
  anche se l'ESP32 è spento.
- **Relè temporizzato**: un modulo "delay off" o un relè multifunzione da guida DIN. Si regola appena sopra la dose
  più lunga, così un comando bloccato non diventa una dose infinita.
- **Acido diluito e pompa piccola**: pH- diluito 1:10 e peristaltica da 0,5 mL/s per l'acido. Nel test
  "dosatore bloccato" 20 secondi di acido concentrato bastano a portare il pH sotto 3: con acido diluito e pompa
  piccola lo stesso guasto fa un decimo dei danni.
- **Flaconi**: A, B e acido in contenitori separati e distanti, in una vaschetta di contenimento. Mai mescolare A e B
  concentrati, mai l'acido con i nutrienti concentrati.

Il firmware aggiunge le sue difese, che si sommano a queste ma non le sostituiscono:
- relè di abilitazione chiuso solo durante la dose;
- limite di 20 secondi per dose;
- scoperta del dosatore bloccato: EC +0,3 o pH −0,5 in 10 minuti, che apre il relè di abilitazione;
- limiti giornalieri;
- watchdog.

Nessuna di queste, compresi MQTT, Home Assistant e il watchdog, conta come sicurezza principale.

## Prima del modo reale: collaudo documentato
Il modo reale si attiva solo con tutte queste condizioni:
- `"modo": "reale"` e `"conferma_reale": True`;
- **tutte** le voci di `"collaudo"` a `True`, dopo averle provate davvero (vedi [COLLAUDO_DOSAGGIO.md](COLLAUDO_DOSAGGIO.md));
- una taratura del pH di meno di 30 giorni: dopo la taratura, `main.tarato()`.

Se manca qualcosa resta in ombra e lo scrive (`REALE_NON_ATTIVO: ...`). Anche dopo, `"dosaggio_abilitato": False`
lascia il dosaggio a mano: il controllo propone le dosi, le fai tu. È la scelta consigliata per il primo impianto.

## Sicurezze
Sono in `idro_controllo.py`, valgono anche senza rete. In più, nel firmware:
- **all'accensione** tutte le uscite sono spente;
- **ogni dose dura al massimo `MAX_SECONDI_DOSE`**, qualunque cosa chieda la logica. È un limite del firmware, non
  hardware: quello vero è il relè temporizzato della catena qui sopra;
- **la memoria** (allarmi bloccanti e dosi del giorno) è salvata su file prima di ogni dose: un riavvio non azzera i
  limiti giornalieri;
- **watchdog**: se il programma si blocca, l'ESP32 riparte. Dopo il riavvio niente dosi per 15 minuti.

## Cosa non è ancora provato
Il firmware è provato sul PC con hardware finto (`test/test_firmware_idro.py`), non su una scheda vera. Prima del
modo reale servono le prove a banco del [COLLAUDO](../../COLLAUDO.md): sonde nelle soluzioni di taratura, dosatori con
il cilindro graduato, galleggianti a mano, sensore di perdita con un panno bagnato.
