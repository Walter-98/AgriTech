# Audit del progetto AgriTech e roadmap

Fotografia del 21 ottobre 2026, dopo le 10 fasi della roadmap. Ogni funzione ha uno stato esplicito: niente è
dichiarato "validato" finché non è confrontato con misure vere. **Nessuna parte è stata ancora provata su hardware vero
o confrontata con un raccolto vero**: è il prossimo passo, ed è tuo (sezione 8).

## 1. Cosa c'è oggi

| Parte | File | Cosa fa |
|---|---|---|
| Controllo irrigazione | `sistema/controllo.py` | Logica decisionale (soglie, sicurezze, allarmi), compatibile MicroPython: la stessa sull'ESP32 e nel simulatore |
| Simulatore orto | `sistema/modello.py`, `scenari.py`, `simula.py`, `soluzioni.py` | Bilancio idrico giornaliero del terreno, scenari meteo/blackout/allagamento, confronto delle soluzioni |
| Firmware ESP32 | `firmware/esp32-irrigazione/` | Firmware MicroPython per l'irrigazione, con schema per Wokwi |
| Strumenti | `strumenti/` | Simulatore da riga di comando, scaricamento del meteo storico (Open-Meteo) |
| Gemello digitale | `gemello/` (HTML + 10 moduli JS) | Simulatore in browser: orto in terra e idroponica in garage, 3D parametrico, percorso guidato, crescita, luce, idraulica, ricetta, economia, registro e calibrazione, documenti |
| Controllo idroponica | `sistema/idro_controllo.py`, `sistema/idro_modello.py` | Logica di dosaggio e sicurezze (simulazione/ombra/reale) e serbatoio simulato con 12 scenari di guasto |
| Firmware idroponica | `firmware/esp32-idroponica/` | MicroPython: sonde, dosatori con limite hardware, prese smart, MQTT verso Home Assistant |
| Monitoraggio | `monitoraggio/` | ESPHome di sorveglianza (validato), pacchetto e plancia Home Assistant, guida; `strumenti/storico_ha.py` |
| Documenti | `PIANO.md`, `COLLAUDO.md`, `SOLUZIONI.md`, `IDROPONICA.md`, `MODELLI.md` | Piano a fasi, collaudo, soluzioni, guida idroponica, schede dei modelli |
| Test | `test/*.py` (97), `test/js/` (100), contratto `test/contratti/bilancio_idrico.json` (108 casi) | Logica, scenari, firmware con hardware simulato; test numerici del motore idroponico. Girano su GitHub a ogni modifica |

Architettura: due motori separati. Python serve per il controllo e per il simulatore dell'orto (lo stesso
codice va sull'ESP32). JavaScript serve per il gemello nel browser (gratis, senza server, funziona anche offline).
L'interfaccia (`ui.js`) e il 3D (`vista3d.js`) sono separati dai motori (`sim.js`, `idro.js`), che non toccano la pagina.

## 2. Stato delle funzioni

| Funzione | Stato |
|---|---|
| Logica di controllo irrigazione | Implementata e testata (simulazione), non validata su campo |
| Firmware ESP32 irrigazione | Implementata ma non validata: provata con hardware finto in Python, non su Wokwi né su scheda vera |
| Simulatore orto Python (bilancio idrico) | Implementata e testata, modello euristico |
| Gemello: motore orto (`sim.js`) | Prototipo: senza test propri, duplica il modello Python con formule diverse |
| Gemello: motore idroponica (`idro.js`) | Implementata e testata numericamente (14 test), non validata con raccolti veri |
| Luce: PPFD e DLI dai watt montati | Implementata e testata (fase 1) |
| Luce: distribuzione sul piano, uniformità, distanza | Implementata e testata (fase 4): mappa con sorgenti lambertiane e pareti riflettenti |
| Crescita: risposta alla luce | Implementata, stima euristica dichiarata (MODELLI.md §2) |
| Crescita: biomassa giorno per giorno (lattuga, basilico) | Implementata e testata contro dati pubblicati (fase 3); fasi fenologiche e carenze solo come testo |
| Clima del garage e della tenda | Prototipo: bilancio termico stazionario; ora anche con il meteo vero del comune (Open-Meteo dal browser o CSV) |
| Idraulica: portate, prevalenza, pendenza NFT, traboccamento | Implementata e testata (fase 4): Hazen-Williams, scelta della pompa, consumo calcolato |
| Nutrienti: ricetta per ione dall'analisi dell'acqua | Implementata e testata (fase 4): Hoagland scalato, 5 sali, taniche A/B, acido; microelementi a etichetta |
| Bilancio economico: CAPEX, OPEX, ammortamento, scenari, pareggio | Implementata e testata (fase 1) |
| Giudizio "conviene / fragile / sconsigliato" | Implementata e testata (fase 1) |
| Distinta base | Collegata alle misure (fase 5): canali, tubi in metri, scaffale, tenda e pompa si aggiornano; esportazione CSV per Excel. Prezzi ancora stimati, senza fornitori né link |
| Database colture con fonti | Implementato (fase 3): 27 dati con fonte, condizioni e affidabilità A-D; il resto dei valori di tabella resta C |
| Confronto tra alternative | Prototipo: "confronti rapidi" a una variabile; ottimizzazione da sviluppare |
| Percorso guidato per principianti (scheda Inizia) | Implementata e testata (fase 2): prova circa 400 configurazioni, rispetta i vincoli, propone A/B/C, sa dire di no |
| 3D | Parametrico (fase 5): tenda rettangolare e scaffale con le misure vere in cm, piani, distanza tra i ripiani. Resta una visualizzazione, non un CAD, e non prova niente |
| Logica idroponica (pH, EC, dosaggio, sicurezze, modi simulazione/ombra/reale) | Implementata e testata (fase 6): 16 test su serbatoio simulato con 12 scenari di guasto |
| Firmware idroponica ESP32 | Implementato, provato con hardware finto (9 test); non provato su scheda vera |
| Monitoraggio remoto | Implementato (fase 7): ESPHome di sorveglianza validato con `esphome config`, MQTT con auto-scoperta nel firmware, pacchetto Home Assistant con 6 avvisi e plancia, esportazione dello storico. Non provato con un Home Assistant vero |
| Confronto con dati reali e calibrazione | Implementato e testato (fase 8): scheda Registro, previsione per le stesse date con le temperature misurate, errore, correzione per coltura solo con 2+ cicli, versioni e ritorno indietro, confronto dei kWh |
| Normativa per la vendita | Quadro informativo (fase 10) con norme citate e verifiche da fare presso SUAP, AST, Regione e commercialista; non è un parere legale |
| Documenti ed esportazioni | Implementati (fase 10): relazione di progetto in 17 sezioni stampabile in PDF, Excel (5 fogli), CSV della distinta, pianta in SVG; data, versione, ipotesi e limiti in ogni documento |
| Pianta del locale, ingombri, spazio per lavorare e passaggio | Implementata e testata (fase 5), esportabile in SVG |
| Salvataggio | Solo nel browser (localStorage) |

## 2b. AgriTech 2.0: matrice delle funzioni (30 ottobre 2026)

Stati: **COMPLETATO** (fatto e coperto da test), **SOLO SIMULAZIONE** (funziona sul modello, mai su un impianto vero),
**ATTESA HARDWARE**, **ATTESA DATI REALI**, **NON COMPLETATO**. Affidabilità delle fonti A-D come in MODELLI.md.

| Funzione | File | Stato | Fonte | Affid. | Test | Rischio | Miglioramento |
|---|---|---|---|---|---|---|---|
| Clima orario esterno → garage → tenda → serbatoio | `gemello/clima.js` | SOLO SIMULAZIONE, ATTESA DATI REALI | EN ISO 6946, 13790; regola garage = esterno +3 °C | C | `test_clima.js` (9), bilancio energetico <0,1% | errore di qualche °C su un garage vero | calibrare con 2-4 settimane di termometro (già in Registro) |
| Calibrazione del clima (fUA, fSole) | `clima.js` | SOLO SIMULAZIONE | ricerca su griglia | - | sì | pochi dati → correzione sbagliata | più giorni misurati |
| Crescita a LUE sulla luce intercettata, acclimatazione | `idro.js` | ATTESA DATI REALI | letteratura lattuga/basilico | B-C | `test_crescita.js` | resa sovrastimata | raccolti pesati |
| Incertezza Monte Carlo (P10/P50/P90) | `idro.js` | COMPLETATO | intervalli dichiarati | C | sì | intervalli scelti a mano | restringerli coi dati |
| Laboratorio: previsione congelata, calibrazione/validazione alternate, MAE/RMSE/bias | `registro.js` | COMPLETATO (codice), ATTESA DATI REALI | protocollo ChatGPT/AGRITECH 2.0 | - | `test_laboratorio.js` (5) | nessuno finché non ci sono raccolti | fare 3+ cicli |
| Nucleo fisico condiviso Python/browser (acqua nel terreno) | `sistema/nucleo.py`, `sim.js` | COMPLETATO | FAO-56 semplificato | B | contratto 108 casi | - | estendere ai controllori |
| Motore orto unico | `sim.js`, `sistema/modello.py` | NON COMPLETATO | - | - | - | +35% di acqua tra i due | unificare il controllore |
| Simulazione annuale idroponica | `idro.js` | SOLO SIMULAZIONE | - | C | `test_idro.js` | - | - |
| Confronto tra tecnologie + fronte di Pareto (capex, €/kg, rischio, ore) | `progetta.js` | COMPLETATO | ricerca esaustiva su ~400 configurazioni | - | `test_progetta.js` | - | NSGA-II solo se lo spazio cresce: oggi non serve |
| Verifiche fisiche: ingombri, altezza, pesi sui ripiani, ribaltamento | `idro.js` | COMPLETATO | portata da etichetta dello scaffale | B | `test_fase5.js` | senza portata dichiarata il giudizio è "non disponibile" | - |
| Collisioni 3D e percorso dei tubi | `vista3d.js` | NON COMPLETATO | - | - | - | - | - |
| Distinta base | `idro.js` | COMPLETATO (stime) | prezzi stimati | D | sì | prezzi vecchi | prezzi e link da fornitori: NON COMPLETATO |
| VAN (3%) e TIR | `idro.js` | COMPLETATO | formula standard | A | sì | dipende dai prezzi | - |
| Microgreens da vendere (conti per vassoio) | `idro.js` | COMPLETATO (calcolo); vendita = verifiche SUAP/AST | MODELLI.md, IDROPONICA.md | C | sì | autorizzazioni | - |
| Macchina a stati del dosaggio, collaudo in 8 punti, taratura ≤30 giorni | `sistema/idro_controllo.py` | SOLO SIMULAZIONE | - | - | `test_idro_controllo.py` | - | - |
| Dosatore bloccato (EC +0,3 / pH −0,5) → taglio dei dosatori | `idro_controllo.py`, `idro_modello.py` | SOLO SIMULAZIONE | scenario 14 | - | sì | 20 s di acido concentrato bastano a far crollare il pH | acido diluito 1:10, pompa 0,5 mL/s |
| Catena di sicurezza hardware indipendente dal firmware | `firmware/esp32-idroponica/LEGGIMI.md`, `COLLAUDO_DOSAGGIO.md` | ATTESA HARDWARE | - | - | firmware con hardware finto | - | montarla e collaudarla |
| Firmware: relè di abilitazione, arresto NC, ora NTP, taratura | `firmware/esp32-idroponica/` | ATTESA HARDWARE | - | - | `test_firmware_idro.py` | mai su scheda vera | Wokwi, poi scheda |
| Gemello con dati veri (MAE/RMSE/bias) | `registro.js` | ATTESA DATI REALI | - | - | sì | - | - |
| Assistente IA controllata | - | NON COMPLETATO | - | - | - | - | - |
| Modalità principiante/esperto, glossario | `ui.js` | COMPLETATO | - | - | prova in browser | - | - |
| Progetto in JSON con versione dello schema e migrazione | `progetto.js` | COMPLETATO | - | - | sì | - | - |
| Relazione PDF, Excel, CSV, SVG | `documenti.js` | COMPLETATO | - | - | `test_documenti.js` | - | - |
| Preparazione SaaS (account, server, più progetti) | - | NON COMPLETATO | - | - | - | - | serve solo se ci saranno altri utenti |

Errore trovato in questa fase: `etGiorno` era dichiarato sia in `sim.js` sia in `ui.js` e nel browser la pagina non
partiva più (i test Node caricano i moduli separati e non se ne accorgevano). Corretto, con un test nuovo
(`test_script_unici.js`) che cerca i nomi doppi tra tutti gli script della pagina.

## 3. Errori trovati

### Corretti nella fase 1
1. **La luce non limitava mai la crescita.** I watt venivano calcolati dall'obiettivo di luce, quindi le piante
   ricevevano sempre la luce giusta. Ora si possono indicare i **watt montati**: il motore calcola il PPFD e il DLI
   che arrivano davvero e la resa segue la luce. Con metà dei watt, metà della luce e circa metà del raccolto.
2. **Crescita con la luce a gradino.** Prima la resa era piena appena si toccava il DLI minimo. Ora la resa è
   proporzionale al DLI fino al massimo della coltura (efficienza d'uso della luce) e oltre non cresce. Avvisa se la
   luce è troppa: solo corrente in più e, per la lattuga, bruciature ai bordi.
3. **Raccolto senza perdite.** Mancavano mortalità, giorni fermi tra un ciclo e l'altro e scarto. Ora sono parametri
   (default 5%, 2 giorni, 10%).
4. **Tutto il raccolto valutato al prezzo del negozio.** Ora vale solo quello che la famiglia mangia davvero
   (consumo per persona, modificabile). Quello venduto vale il prezzo di vendita, il resto è eccedenza. Prima 139 kg di
   microgreens valevano 4.000 € "in casa"; ora 140 €, a meno di venderli.
5. **Spese senza ricambi, ammortamento e lavoro.** Aggiunti il ricambio delle lampade a fine vita (ore di vita per tipo),
   la pompa ogni 3 anni, l'ammortamento in N anni e le ore di lavoro (con un valore orario facoltativo).
6. **Nessun caso peggiore.** Aggiunti gli scenari pessimistico, centrale e ottimistico.
7. **Il software non sapeva dire di no.** Ora dà un giudizio con i motivi, coltura per coltura (costo al kg contro il
   prezzo del negozio).
8. Codice morto nel calcolo del valore e nessun test sul motore JavaScript: rimosso e aggiunti 14 test.

### Noti e non ancora corretti
1. Due motori per l'orto (Python e JavaScript). Il bilancio idrico del giorno ora è lo stesso (`sistema/nucleo.py` e
   `etGiorno` in `sim.js`, stesso contratto di 108 casi), ma i due **controllori** restano diversi (blocco per gelo,
   fattore del sensore 0,92, orari): sullo stesso anno di meteo il Python dà 2619 L e il browser 3537 L (+35%).
   Unificare anche il controllore non è fatto.
2. ~~Clima solo su medie mensili~~: ora si può usare un anno vero del proprio comune (fase 4).
3. ~~Manca la versione "zero elettronica"~~: aggiunta nella fase 2 (timer, penne, termometro min/max).
4. Moltiplicatori di stress a soglia (caldo × 0,5 ecc.), senza fonte.
5. Tolleranze ai blackout per sistema dalla pratica, non misurate.
6. Prezzi dei componenti stimati, senza data né fornitore.
7. Firmware ESP32 mai provato su hardware vero.

## 4. La tua domanda: garage, 500 €, Marche, lattuga, basilico o fragole

Il gemello (dopo le fasi 1-10) risponde così; la scheda **Inizia** fa questo confronto da sola. Zona Centro, garage non isolato, tenda, LED bianchi, corrente 0,28 €/kWh, famiglia
di 3 persone. I 15 m² non sono un limite: lo è la corrente.

| Proposta | Piante | Per iniziare | Spese/anno | Corrente/anno | Raccolto utile | Costo al kg | Valore in casa | Giudizio economico |
|---|---|---|---|---|---|---|---|---|
| A · minimo investimento: Kratky 120×60, lattuga e basilico, controllo a mano | 17 | 441–757 € | 513 € | 1699 kWh (luci 584, clima 1073) | 16 kg | 38,5 € | 94 € | sconsigliato |
| A senza stufetta (d'inverno cresce poco) | 17 | 421–717 € | 252 € | 782 kWh (luci 584, clima 156) | 12 kg | 30,4 € | 69 € | sconsigliato |
| B · rapporto costo/prestazioni: NFT 1 piano 120×60, lattuga e basilico, UPS e galleggianti | 17 | 569–981 € | 534 € | 1759 kWh (luci 584, clima 1050) | 16 kg | 42,4 € | 94 € | sconsigliato |
| C · più automazione: NFT 2 piani, pH/EC e dosaggio automatici | 35 | 843–1485 € | 732 € | 2233 kWh (luci 1168, clima 926) | 36 kg | 26,8 € | 184 € | sconsigliato |
| Fragole: 2 secchi olandesi (8 piante) | 8 | 558–978 € | 533 € | 1670 kWh (luci 562, clima 1035) | 4 kg | 157,0 € | 35 € | sconsigliato |

Cosa ne segue:
- **Per autoconsumo nessuna versione si ripaga**: la lattuga costa 27-42 €/kg contro 3 €/kg al negozio. Si fa per
  imparare, non per risparmiare.
- **Nelle Marche d'inverno la stufetta consuma più delle luci** (tenda 120×120 a 17 °C). Senza stufetta le spese
  scendono a meno della metà, ma d'inverno si raccoglie poco.
- **Fragole al chiuso: sconsigliate.** Vogliono molta luce, 8 piante danno pochi kg e il costo supera i 100 €/kg.
- **Il basilico vale molto, ma una famiglia ne mangia poco**: conviene solo se ne vendi una parte.
- **Consiglio**: la proposta A, ma senza tenda e senza elettronica, nella stagione mite (da marzo a giugno e da
  settembre a novembre), per 80-180 €. Cosa misurare:
  - la presa con contatore, per i kWh;
  - un termometro con memoria;
  - la bilancia, per pesare le teste;
  - i litri rabboccati.
  Con questi dati il gemello si calibra (fase 8) e solo dopo si decide se ingrandire.
- **Confronto con l'orto all'aperto** (scheda Inizia, "Confronto tra tecnologie"): con 20 m² di terra la lattuga costa
  circa 1,3 €/kg, contro 15-90 €/kg in idroponica al chiuso. Se hai un pezzo di terra, l'orto vince sul costo; il garage
  serve per l'inverno, per imparare o per vendere prodotti di valore (microgreens).

## 5. Architettura proposta

Scelta: **evolvere quello che c'è, senza un server finché non serve**.
- **Motore scientifico** in moduli JavaScript puri (`gemello/*.js`), senza pagina, testati in Node. Gira nel browser,
  gratis e offline. È la fonte unica dei numeri del gemello: va unificato con il modello Python dell'orto (fase 4),
  portando lì le formule validate e generando i test dagli stessi casi di riferimento.
- **Controllo in campo** in Python/MicroPython (`sistema/controllo.py` e firmware). Interblocchi e limiti restano
  deterministici e locali sull'ESP32. Nessuna previsione o AI comanda pompe e dosatori.
- **Monitoraggio** (fase 7) con ESPHome + Home Assistant in locale, senza cloud. Accesso da fuori via VPN o Home
  Assistant Cloud, mai porte dell'ESP32 aperte su Internet. Un backend proprio (FastAPI + SQLite) solo quando servirà
  confrontare misure e simulazioni in modo automatico.
- **Interfaccia**: resta HTML + JS. Il passaggio a React/TypeScript conviene quando ci saranno editor CAD e più
  pagine, non prima.
- **Dati**: `IDRO_PIANTE` diventerà un file dati versionato con fonte, unità e affidabilità per ogni valore (fase 3).

## 6. Roadmap

Ordine per importanza, ognuna con test di accettazione.
1. **Audit e calcoli** ✅ fatta. Accettazione: 14 test numerici verdi, luce → resa, bilancio con ammortamento e giudizio.
2. ✅ **Percorso guidato e confronto delle tecnologie.** Domande essenziali (luogo, spazio, budget, tempo, colture,
   obiettivo) → tre proposte A/B/C, compresa la versione senza elettronica, e un giudizio. Accettazione: per 10 casi
   di prova le proposte rispettano budget e spazio, e almeno un caso viene sconsigliato con motivo.
3. ✅ **Database colture con fonti e modello di crescita** per lattuga e basilico: biomassa giornaliera da luce e
   temperatura, con intervalli. Accettazione: riproduce entro ±20% le rese pubblicate per DLI e temperatura note.
4. ✅ **Luce, clima, acqua, nutrienti** (unificazione con il modello Python dell'orto ancora da fare): mappa PPFD sul ripiano, clima con meteo orario vero (Open-Meteo), NFT con
   portata e pendenza, ricetta nutritiva da analisi dell'acqua. Unificazione con il modello Python dell'orto.
5. ✅ **3D parametrico collegato alla distinta** (con pianta del locale in SVG; niente esportazione CAD): ripiani, canali e tubi dimensionati che aggiornano quantità e costi.
6. ✅ **Automazione simulata**: modalità simulazione / shadow / controllo reale, guasti e interblocchi, firmware
   idroponica con dosaggio limitato, a piccole dosi, con attesa di miscelazione e blocchi.
7. ✅ **Hardware e monitoraggio** (configurazioni pronte e validate; prova su hardware vero a carico tuo): ESPHome + Home Assistant, storico, allarmi.
8. ✅ **Dati reali e calibrazione** (pronto: servono i tuoi raccolti): registro colture, confronto previsto/misurato, ricalibrazione con versioni e
   ritorno indietro.
9. ✅ Altre colture e tecnologie: flusso e riflusso, goccia su substrato, cetriolo, peperone (valori C, da verificare).
10. ✅ Documenti in PDF/XLSX/CSV e quadro delle regole per vendere (D.Lgs. 228/2001, Reg. CE 852/2004, 178/2002,
    Reg. UE 208-210/2013, 1169/2011; SUAP e AST).

## 7. Come si validano le simulazioni

- **Casi di riferimento calcolabili a mano**: energia, PPFD, DLI, bilancio economico, acqua. Sono già nei test.
- **Coerenza fisica**:
  - meno luce, meno resa;
  - oltre la saturazione, nessun guadagno;
  - mortalità proporzionale;
  - numeri finiti e non negativi per ogni sistema e lampada.
- **Confronto con la letteratura** (fase 3): rese di lattuga e basilico a DLI noti.
- **Confronto con il primo impianto vero**. Tolleranze per dire "il modello regge":

| Grandezza | Strumento | Tolleranza |
|---|---|---|
| kWh | presa con contatore | ±5% |
| Temperatura media in tenda | termometro con memoria | ±2 °C |
| Acqua rabboccata | litri segnati sul serbatoio | ±20% |
| Peso medio delle teste | bilancia | ±25% |
| Giorni al raccolto | registro colture | ±5 giorni |

  Fuori tolleranza si ricalibra solo con almeno 2 cicli di dati.

## 8. Prima versione davvero utilizzabile con budget minimo

| Passo | Spesa | Risultato |
|---|---|---|
| 1. Gemello e collaudo virtuale | 0 € | Scegliere coltura, sistema e luce; vedere costi e rischi |
| 2. Kratky di prova, 6-8 piante | 40-100 € | Contenitore scuro, vasetti, lana di roccia, nutrienti, penne pH ed EC, una lampada LED da 30-50 W |
| 3. Misure | 20-40 € | Presa con contatore, termometro con memoria, bilancia (spesso già in casa) |
| 4. Primo ciclo misurato | 0 € | 5-6 settimane: confronto con il gemello |
| 5. Elettronica di monitoraggio | 30-60 € | ESP32, temperatura aria e acqua, perdita a pavimento, con ESPHome |
| 6. Ampliamento (NFT o DWC) | da preventivare | Solo se i numeri veri lo giustificano |
