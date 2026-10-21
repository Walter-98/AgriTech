# Agricoltura tecnologica partendo da zero

Percorso pratico per arrivare a un orto/piccola azienda con sensori, irrigazione automatica e dati, partendo da
**zero competenze, zero conoscenze, zero soldi**. Regola d'oro: **ogni fase si paga con la precedente** – si spende
solo ciò che l'orto ha già fatto risparmiare o guadagnare, e si compra tecnologia solo dopo averla provata in
simulazione.

## Sistema di controllo e gestione (prima virtuale, poi reale)
**Il piano passo passo è in [`PIANO.md`](PIANO.md)**: strumenti, requisiti, simulazione e collaudo virtuale a 0 €, e
solo dopo l'acquisto dell'hardware un pezzo alla volta, con le prove di [`COLLAUDO.md`](COLLAUDO.md) come cancello
tra una fase e l'altra.

| Cartella / file | Cosa c'è |
|---|---|
| `gemello/index.html` | **gemello digitale 3D** (si apre con il browser insieme ai file `.js` della cartella). Due modi: **orto in terra** (esterno, serra o interno) e **idroponica in garage** (NFT, torri, DWC, Kratky, flusso e riflusso, goccia su substrato, secchi, microgreens). Schede: **Inizia** (percorso guidato con tre proposte e giudizio), Progetto (misure, colture, luce con mappa, clima, meteo vero, ricetta dei nutrienti, economia), Componenti, Logica, Guasti, Simulazione (crescita giorno per giorno), **Registro** (raccolti veri e calibrazione), Costi (bilancio e scenari), Materiali, Struttura (idraulica, pianta del locale), Gestione, Guida (con le fonti), **Documenti** (relazione in PDF, Excel), Percorso |
| `IDROPONICA.md` | guida da tecnico all'idroponica in garage: sistemi, piante per m², luci e consumi, nutrienti, pH, umidità, semi, automazione, costi |
| `sistema/idro_controllo.py`, `sistema/idro_modello.py` | controllo dell'idroponica (pH, EC, dosaggio, sicurezze, modi simulazione/ombra/reale) e serbatoio simulato con 12 guasti |
| `firmware/esp32-idroponica/` | firmware ESP32 per l'idroponica: sonde, dosatori, prese smart, MQTT; guida di collegamento e taratura |
| `monitoraggio/` | vedere l'impianto dal telefono: ESPHome, Home Assistant (avvisi e plancia), accesso sicuro da fuori |
| `AUDIT.md` | **stato reale del progetto**: cosa è testato e cosa no, errori trovati e corretti, architettura, roadmap, criteri di validazione, risposta al caso "garage, 500 €, Marche" |
| `MODELLI.md` | schede dei modelli del gemello: formula, fonte, ipotesi, limiti, esempio numerico, affidabilità |
| `sistema/controllo.py` | logica di controllo e sicurezze: **la stessa** nel simulatore e sull'ESP32 (provata anche in MicroPython) |
| `sistema/modello.py`, `sistema/scenari.py` | mondo virtuale (terreno, ristagno, piante, meteo ora per ora, cisterna, sensori, quadro, rete o pannello solare) e 22 scenari |
| `sistema/simula.py`, `sistema/rapporto.py` | esegue uno scenario e crea registro CSV e rapporto HTML con grafici |
| `sistema/soluzioni.py` → [`SOLUZIONI.md`](SOLUZIONI.md) | meteo, corrente, allagamenti e guasti simulati **senza e con la soluzione**, con costi e priorità |
| `strumenti/scarica_meteo.py` | meteo reale di un periodo passato (Open-Meteo, gratuito) da usare con `--meteo` |
| `test/` | collaudo virtuale automatico (logica, scenari, firmware con pin finti); gira anche su GitHub Actions |
| `firmware/esp32-irrigazione/` | firmware MicroPython, configurazione, schema Wokwi per l'ESP32 virtuale, istruzioni |
| `strumenti/orto_sim.py` | piano colture del mese, confronto timer/sensore semplice, registro di raccolti, spese e vendite |
| `skills/agricoltura-tech/` | skill per l'agente: ti guida una fase alla volta |

Per iniziare (serve solo Python 3):
```bash
python3 -m unittest discover -s test -t .               # collaudo virtuale: deve finire con OK
node --test test/js/test_*.js                           # test numerici del motore del gemello
python3 -m sistema.simula --elenco                      # scenari disponibili
python3 -m sistema.simula tutti                         # tutti gli scenari, normale e con guasti
python3 -m sistema.simula nubifragio --rapporto rapporto.html
python3 -m sistema.soluzioni                            # problemi e soluzioni a confronto -> SOLUZIONI.md
python3 strumenti/orto_sim.py piano --mese 10           # cosa seminare questo mese
python3 strumenti/orto_sim.py registro aggiungi --attivita raccolto --coltura ravanello --kg 0.3
```

Il resto di questa pagina è il percorso per chi parte da zero con l'orto (colture, compost, primi guadagni).

---

## Fase 0 – Zero euro (mesi 1-2): imparare facendo

**Obiettivo:** far crescere e raccogliere qualcosa, e tenere un registro.

| Serve | Come averlo gratis |
|---|---|
| Spazio | balcone, davanzale; poi orti urbani del Comune, terreni incolti in comodato d'uso gratuito (chiedi in Comune, ad anziani del paese, a parrocchie; alcune regioni hanno una "banca della terra" – in Sardegna chiedi all'agenzia regionale Laore) |
| Contenitori | cassette della frutta (chiedile al fruttivendolo), bottiglie e taniche tagliate con fori sul fondo |
| Terra | compost fatto in casa con scarti di cucina + foglie secche; terra di scavo migliorata con il compost |
| Semi e piante | pomodori maturi, peperoncini secchi, fagioli e fave secchi, patate germogliate, aglio, base di cipollotti, talee di basilico; scambio semi con vicini e gruppi locali |
| Acqua | raccolta dell'acqua piovana da grondaie in taniche; acqua di lavaggio delle verdure |
| Conoscenza | `orto_sim.py piano`, video gratuiti, l'agricoltore anziano del paese (la fonte migliore), corsi gratuiti di Laore/regione, app gratuite di riconoscimento piante e malattie |

Da fare:
1. `python3 strumenti/orto_sim.py piano --mese <mese>` → scegli **3 colture veloci** (ravanello, rucola, microgreens).
2. Avvia il compost subito (serve 2-3 mesi).
3. Ogni giorno 5 minuti: guarda, tocca la terra con un dito (asciutta a 2 cm = annaffia), annota.
4. Registro: `orto_sim.py registro aggiungi --attivita raccolto --coltura ravanello --kg 0.3`.

**Fatto quando:** hai raccolto almeno 3 colture diverse e sai riconoscere terra secca, pianta assetata, pianta con troppa acqua.

## Fase 1 – Tecnologia a costo zero (in parallelo alla fase 0)

Tutto software, gratis:
- **Simulazione irrigazione:** `orto_sim.py simula --mese 7` confronta un timer fisso con un controllo a sensore. Con i
  valori di prova: a luglio il timer da 10 min/giorno lascia le piante in stress per centinaia di ore; ad aprile spreca
  da un terzo a due terzi dell'acqua (dipende dalla pioggia: prova `--seme 1`, `--seme 3`) e fa ristagno. È il motivo per cui si misura invece di "dare acqua a orario".
- **Meteo reale:** Open-Meteo offre gratuitamente evapotraspirazione (ET0) e pioggia; salvale in un CSV
  `giorno,et0_mm,pioggia_mm` e usale con `--meteo`.
- **Elettronica senza comprare nulla:** il simulatore online Wokwi permette di provare un ESP32 con sensori e relè
  virtuali: istruzioni in `firmware/esp32-irrigazione/LEGGIMI.md`, sistema completo e piano in `PIANO.md`.
- Impara le basi in quest'ordine: Python (piccoli script) → cos'è un sensore analogico → cos'è un relè → MicroPython.

**Fatto quando:** il firmware gira su Wokwi e sai spiegare a parole perché servono isteresi e tempo massimo pompa.

## Fase 2 – Primi guadagni (mesi 2-6): far pagare la tecnologia all'orto

Colture con ciclo breve e prezzo alto per poco spazio:
- **Microgreens** (10-14 giorni, vassoi riciclati, si vendono a ristoranti e conoscenti);
- **piantine da trapianto** in primavera (pomodori, peperoncini, basilico da seme o talea);
- **aromatiche** in vaso (basilico, prezzemolo, rosmarino da talea).

Prima di vendere informati sulle regole (vendita diretta di prodotti agricoli, eventuali obblighi fiscali e
igienico-sanitari): chiedi a un'associazione di categoria o al CAF. Registra ogni euro: `--attivita spesa/vendita`,
poi `orto_sim.py registro riepilogo`.

**Obiettivo:** ~20 € di margine per il kit minimo da banco (fase 4 di `PIANO.md`), poi il resto.

## Fase 3 – Il sistema tecnologico (prima virtuale, poi reale)

Segui **[`PIANO.md`](PIANO.md)**: simulazione del tuo orto e collaudo virtuale a 0 €, poi banco (~20-50 €) e campo
(~40-90 €), un pezzo alla volta e solo dopo aver superato le prove di [`COLLAUDO.md`](COLLAUDO.md). Lì ci sono anche
la lista della spesa, i dati sul telefono, il meteo e gli avvisi. Se conosci i PLC: la stessa logica su un LOGO! 8 è
un ottimo esercizio (skill `plc-logo-programmazione` e simulatore `strumenti/logo_sim.py` nel repository
`agenti-automazione`) e il passaggio naturale verso impianti più grandi.

## Fase 4 – Crescere davvero

- **Idroponica senza pompa (metodo Kratky):** contenitore scuro, soluzione nutritiva, rete; ottima per lattughe ed erbe.
  Poi NFT/acquaponica con pompa e controllo di pH ed EC.
- **Serra o tunnel** con apertura ventilazione automatica in base alla temperatura.
- **Finanziamenti:** per giovani che si insediano in agricoltura esistono bandi regionali (sviluppo rurale) e misure
  nazionali (es. ISMEA per giovani agricoltori). Cambiano spesso: verifica i bandi aperti con la regione, un CAA o
  un'associazione di categoria. Il registro di raccolti, spese e vendite delle fasi precedenti è la base del business plan.

---

## Errori tipici da evitare
- Comprare kit costosi prima di aver fatto crescere qualcosa a mano.
- Troppe colture all'inizio: meglio 3 fatte bene.
- Annaffiare a orario invece di misurare (vedi simulazione).
- Sensori resistivi economici: si corrodono in poche settimane.
- Pompa senza tempo massimo: un sensore staccato svuota il serbatoio o allaga.
- Non annotare: senza registro non sai cosa funziona e cosa ti costa.
