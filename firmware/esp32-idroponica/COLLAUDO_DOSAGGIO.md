# Collaudo del dosaggio automatico

Ogni prova si fa sull'impianto vero, con acqua (senza piante per le prove 1-6) e si **scrive**: data, chi l'ha fatta,
risultato. Solo dopo aver superato la prova la voce di `collaudo` in `config.py` va a `True`. I test sul PC
(`python3 -m unittest test.test_idro_controllo test.test_firmware_idro`) provano la logica con hardware finto: **non
sostituiscono nessuna di queste prove**.

| # | Voce di `collaudo` | Prova | Superata se |
|---|---|---|---|
| 1 | `portata_dosatori_misurata` | Ogni dosatore 10 secondi in un cilindro graduato, 3 volte | La portata varia meno del 10% tra le prove; il valore medio va in `ML_AL_SECONDO` |
| 2 | `taglio_hardware_provato` | Con un dosatore comandato acceso: premi il fungo, poi metti a secco il galleggiante, poi bagna il rilevatore di allagamento, poi lascia scadere il relè temporizzato | In ognuno dei 4 casi il dosatore si ferma **anche con l'ESP32 che continua a comandarlo** (scollega il filo del pin per esserne certo) |
| 3 | `arresto_emergenza_provato` | Fungo premuto durante il funzionamento; poi filo del fungo staccato | Tutto spento entro un passo, allarme ARRESTO_EMERGENZA, il reset non funziona finché il fungo è premuto |
| 4 | `prova_perdita` | Panno bagnato sul sensore a pavimento | Pompe, rabbocco e dosatori spenti entro un minuto; allarme sul telefono |
| 5 | `prova_galleggianti` | Galleggiante di minimo a mano; poi quello di massimo | Minimo: pompa e dosatori fermi. Massimo: rabbocco fermo |
| 6 | `prova_flusso` | Chiudi la mandata con la pompa accesa | FLUSSO_ASSENTE entro 2 minuti, pompa ferma dopo 3 tentativi |
| 7 | `prova_blackout` | Stacca la corrente 10 minuti durante il funzionamento | Al ritorno: uscite spente all'accensione, niente dosi per 15 minuti, allarmi e dosi del giorno ancora in memoria |
| 8 | `settimana_in_ombra` | Una settimana in modo ombra con le piante | Le dosi proposte sono quelle che faresti tu con le penne; nessun allarme non spiegato |

## Prove hardware-in-the-loop (prima di collegare i dosatori ai flaconi)
Con il firmware sull'ESP32 e i sensori sostituiti da segnali noti:
- **pH**: un generatore di tensione o un partitore regolabile al posto della sonda, per simulare deriva, salto, valore
  bloccato, scheda staccata;
- **EC**: soluzioni di taratura;
- **flusso**: un generatore di impulsi o il flussimetro soffiato;
- **attuatori**: LED al posto delle pompe.

Si verifica che a ogni guasto simulato corrisponda lo stesso comportamento dei 14 scenari del simulatore
(`sistema/idro_modello.py`).

## Dopo il collaudo
- `"modo": "reale"`, `"conferma_reale": True`, taratura del pH (`main.tarato()`).
- Si può lasciare `"dosaggio_abilitato": False` e dosare a mano seguendo le proposte. Si passa a `True` solo dopo
  qualche settimana senza sorprese.
- Ogni mese: taratura del pH. Ogni settimana: penna (`main.penna(6.1)`). Ogni 3 mesi: ripeti le prove 2 e 3.
