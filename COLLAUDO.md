# Collaudo AgriTech – tutte le prove, dal virtuale al campo

Segna l'esito (✅ superata / ❌ non superata + nota) e la data. Non si passa alla fase successiva del `PIANO.md` con
una prova non superata: si corregge, si rilanciano i test automatici e si ripete la prova.

## V – Prove automatiche (fase 3, 0 €)
Comando: `python3 -m unittest discover -s test -t .`

| ID | Cosa prova | File | Esito | Data |
|---|---|---|---|---|
| V1 | Regole del controllo una per una (isteresi, tempo massimo, pausa, zona più secca, galleggiante, sensore guasto, emergenza, irrigazione inefficace, pompa che non eroga, pioggia, gelo/caldo) | `test/test_controllo.py` | | |
| V2 | Scenari di sistema: normale, pioggia, sensore staccato, sensore fuori terra, tubo rotto, pompa guasta (con e senza livello), cisterna vuota, gelo, mancanza corrente | `test/test_scenari.py` | | |
| V3 | Firmware con pin finti: uscite spente all'accensione, relè attivi bassi, galleggiante, letture | `test/test_firmware.py` | | |

## W – ESP32 virtuale su Wokwi (fase 3, 0 €)
Impostazioni per W1-W7: `SECONDI_PER_MINUTO = 1`, `PIN_TRIG = None`, `PIN_ECHO = None` (su Wokwi il livello della
cisterna non scende davvero, quindi il controllo della pompa darebbe sempre allarme). Su Wokwi **la terra sei tu**:
quando la pompa è accesa, gira piano il potenziometro verso "bagnato", come farebbe l'acqua. Il monitor seriale mostra
a ogni minuto umidità, lettura grezza, pompa, stato e allarmi. Lettura 2400 ≈ 35% (secco), 1700 ≈ 76% (bagnato).

| ID | Prova | Atteso | Esito | Data |
|---|---|---|---|---|
| W1 | Avvio con potenziometro 1 su "secco" | LED spenti per i primi 2 minuti, poi pompa + valvola 1 | | |
| W2 | Durante l'irrigazione porta il potenziometro 1 su "bagnato" (oltre 70%) | pompa e valvola si spengono | | |
| W3 | Due zone secche insieme, la 2 più secca | parte prima la zona 2, mai le due valvole insieme | | |
| W4 | Zona secca, durante l'irrigazione fai salire l'umidità di poco ma restando sotto il 70% | si ferma dopo 10 minuti, poi pausa di 60 minuti | | |
| W5 | Potenziometro 1 tutto a un estremo (lettura < 200 o > 4000) | allarme `Z1_SENSORE`, nessuna irrigazione a sensore | | |
| W6 | Durante un'irrigazione chiudi l'interruttore del galleggiante | pompa spenta subito, `SERBATOIO_BASSO` | | |
| W7 | Zona secca e durante l'irrigazione NON giri il potenziometro | dopo 8 minuti `Z1_INEFFICACE`, zona bloccata; il pulsante rosso la sblocca | | |
| W8 | Riattiva `PIN_TRIG = 5` e `PIN_ECHO = 18`, lascia fermo l'HC-SR04 durante un'irrigazione; poi DHT22 a 1 °C | `POMPA_NON_EROGA`; poi `GELO` | | |

## B – Banco con hardware vero (fase 4)
Sul tavolo, con un bicchiere d'acqua, un vaso di terra e un secchio. LED o lampadine al posto di pompa e valvole
finché non arriva il kit 4b.

| ID | Prova | Atteso | Esito | Data |
|---|---|---|---|---|
| B1 | Taratura: `main.taratura()` con sensore in aria e in acqua, 3 volte | letture stabili entro ±30; valori scritti in `config.py` | | |
| B2 | Accendi, premi reset, ricarica il programma più volte | i relè non scattano mai all'accensione | | |
| B3 | Sensore in terra secca, poi bagnata | relè pompa e valvola si attivano, poi si spengono | | |
| B4 | Sensore in terra secca, uscita dell'acqua nel secchio (l'acqua non arriva al sensore) | dopo 8 minuti `Z1_INEFFICACE` | | |
| B5 | Stacca il connettore del sensore | `Z1_SENSORE`, nessuna irrigazione a sensore | | |
| B6 | Alza e abbassa il galleggiante durante un'irrigazione | la pompa si ferma subito | | |
| B7 | Togli la corrente durante un'irrigazione e ridalla | pompa ferma per 2 minuti, poi riparte normalmente | | |
| B8 | Pompa vera nel secchio, poi stacca un filo della pompa (con sensore di livello) | prima eroga; con filo staccato `POMPA_NON_EROGA` | | |
| B9 | Controllo cablaggio: diodo su ogni elettrovalvola, fusibile sul 12 V, cavi fissati, nessun filo scoperto | tutto presente | | |
| B10 | 72 ore di funzionamento con 1 vaso | nessun blocco, nessun riavvio inatteso, vaso mai secco né allagato | | |

## C – Campo (fase 5)

| ID | Prova | Atteso | Esito | Data |
|---|---|---|---|---|
| C1 | 14 giorni su 1 zona con vaso di confronto annaffiato a mano | piante della zona sane almeno come il vaso | | |
| C2 | Acqua usata e umidità reali confrontate con il simulatore (stessi giorni, meteo vero) | differenza spiegata; modello corretto | | |
| C3 | Giornata di pioggia | nessuna irrigazione inutile | | |
| C4 | Guasto provocato: sensore sfilato dalla terra | `Z1_INEFFICACE` entro la prima irrigazione | | |
| C5 | Seconda zona attivata | una valvola alla volta, entrambe le zone in salute per 7 giorni | | |

## G – Gestione (fase 6)

| ID | Prova | Atteso | Esito | Data |
|---|---|---|---|---|
| G1 | Spegni il Wi-Fi per un giorno | l'impianto irriga da solo; i dati riprendono al ritorno | | |
| G2 | Allarme provocato (galleggiante) | avviso sul telefono entro 5 minuti | | |
| G3 | Pioggia prevista dalla centrale | l'ESP32 salta l'irrigazione | | |
